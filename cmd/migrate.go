package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/knadh/listmonk/models"
	"github.com/labstack/echo/v5"
	null "gopkg.in/volatiletech/null.v6"
)

// Importing another listmonk instance (the one Relais replaces) through its
// API: lists, subscribers with their subscription statuses, templates and
// campaigns (as drafts). The data goes from server to server; the browser
// only sends the plan and reads the progress. SMTP servers are listed by the
// check, and the screen adds them (their passwords can't be read).

// lmSource is the other instance and an API user of it.
type lmSource struct {
	URL      string `json:"url"`
	Username string `json:"username"`
	Token    string `json:"token"`
}

var lmClient = &http.Client{Timeout: 60 * time.Second}

func (s lmSource) base() (string, error) {
	u, err := url.Parse(strings.TrimSpace(s.URL))
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Host == "" {
		return "", errors.New("adresse invalide : elle doit commencer par https://")
	}
	return u.Scheme + "://" + u.Host, nil
}

// get reads an API response's "data" into out.
func (s lmSource) get(path string, out any) error {
	base, err := s.base()
	if err != nil {
		return err
	}
	req, err := http.NewRequest(http.MethodGet, base+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "token "+strings.TrimSpace(s.Username)+":"+strings.TrimSpace(s.Token))
	req.Header.Set("Accept", "application/json")
	resp, err := lmClient.Do(req)
	if err != nil {
		return fmt.Errorf("l’instance ne répond pas : %v", err)
	}
	defer resp.Body.Close()
	switch {
	case resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden:
		return fmt.Errorf("accès refusé (%d) : vérifiez l’utilisateur API, son jeton et ses droits", resp.StatusCode)
	case resp.StatusCode != http.StatusOK:
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 300))
		return fmt.Errorf("%s : erreur %d %s", path, resp.StatusCode, strings.TrimSpace(string(b)))
	}
	var env struct {
		Data json.RawMessage `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&env); err != nil {
		return fmt.Errorf("%s : réponse illisible : %v", path, err)
	}
	return json.Unmarshal(env.Data, out)
}

type lmList struct {
	ID              int      `json:"id"`
	Name            string   `json:"name"`
	Type            string   `json:"type"`
	Optin           string   `json:"optin"`
	Status          string   `json:"status"`
	Tags            []string `json:"tags"`
	Description     string   `json:"description"`
	SubscriberCount int      `json:"subscriber_count"`
}

type lmTemplate struct {
	ID         int         `json:"id"`
	Name       string      `json:"name"`
	Type       string      `json:"type"`
	Subject    string      `json:"subject"`
	Body       string      `json:"body"`
	BodySource null.String `json:"body_source"`
	IsDefault  bool        `json:"is_default"`
}

type lmCampaign struct {
	ID          int            `json:"id"`
	Name        string         `json:"name"`
	Subject     string         `json:"subject"`
	FromEmail   string         `json:"from_email"`
	Body        string         `json:"body"`
	BodySource  null.String    `json:"body_source"`
	AltBody     null.String    `json:"altbody"`
	ContentType string         `json:"content_type"`
	Status      string         `json:"status"`
	Type        string         `json:"type"`
	Tags        []string       `json:"tags"`
	Headers     models.Headers `json:"headers"`
	TemplateID  null.Int       `json:"template_id"`
	Messenger   string         `json:"messenger"`
	Sent        int            `json:"sent"`
	UpdatedAt   null.Time      `json:"updated_at"`
	Lists       []struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	} `json:"lists"`
	Attribs json.RawMessage `json:"attribs"`
}

type lmSubscriber struct {
	Email   string          `json:"email"`
	Name    string          `json:"name"`
	Status  string          `json:"status"`
	Attribs json.RawMessage `json:"attribs"`
	Lists   []struct {
		ID                 int    `json:"id"`
		SubscriptionStatus string `json:"subscription_status"`
	} `json:"lists"`
}

type lmSMTP struct {
	Name          string `json:"name"`
	Enabled       bool   `json:"enabled"`
	Host          string `json:"host"`
	Port          int    `json:"port"`
	AuthProtocol  string `json:"auth_protocol"`
	Username      string `json:"username"`
	TLSType       string `json:"tls_type"`
	TLSSkipVerify bool   `json:"tls_skip_verify"`
	MaxConns      int    `json:"max_conns"`
	IdleTimeout   string `json:"idle_timeout"`
	WaitTimeout   string `json:"wait_timeout"`
	MaxMsgRetries int    `json:"max_msg_retries"`
	MsgRetryDelay string `json:"msg_retry_delay"`
	HelloHostname string `json:"hello_hostname"`
}

// migrationRun is the progress of the running (or last) import.
type migrationRun struct {
	Running    bool           `json:"running"`
	Step       string         `json:"step"`
	Counts     map[string]int `json:"counts"`
	Total      int            `json:"total_subscribers"`
	Errors     []string       `json:"errors"`
	StartedAt  time.Time      `json:"started_at"`
	FinishedAt *time.Time     `json:"finished_at"`
}

var migration = struct {
	sync.Mutex
	run *migrationRun
}{}

func (m *migrationRun) note(err string) {
	migration.Lock()
	defer migration.Unlock()
	if len(m.Errors) < 200 {
		m.Errors = append(m.Errors, err)
	}
}

func (m *migrationRun) add(k string, n int) {
	migration.Lock()
	defer migration.Unlock()
	m.Counts[k] += n
}

func (m *migrationRun) step(s string) {
	migration.Lock()
	defer migration.Unlock()
	m.Step = s
}

// CheckListmonkImport connects to the other instance and describes what
// can be imported.
func (a *App) CheckListmonkImport(c *echo.Context) error {
	var src lmSource
	if err := c.Bind(&src); err != nil {
		return err
	}

	var (
		lists struct {
			Results []lmList `json:"results"`
		}
		templates []lmTemplate
		campaigns struct {
			Results []lmCampaign `json:"results"`
		}
		subs struct {
			Total int `json:"total"`
		}
	)
	if err := src.get("/api/lists?per_page=all&minimal=false", &lists); err != nil {
		return echo.NewHTTPError(http.StatusBadGateway, err.Error())
	}
	if err := src.get("/api/subscribers?per_page=1", &subs); err != nil {
		return echo.NewHTTPError(http.StatusBadGateway, err.Error())
	}
	if err := src.get("/api/templates?no_body=true", &templates); err != nil {
		return echo.NewHTTPError(http.StatusBadGateway, err.Error())
	}
	if err := src.get("/api/campaigns?per_page=all&no_body=true", &campaigns); err != nil {
		return echo.NewHTTPError(http.StatusBadGateway, err.Error())
	}

	// The SMTP servers need settings:get on the other side: optional.
	var settings struct {
		SMTP []lmSMTP `json:"smtp"`
	}
	smtpErr := ""
	if err := src.get("/api/settings", &settings); err != nil {
		smtpErr = err.Error()
	}

	type camp struct {
		ID     int      `json:"id"`
		Name   string   `json:"name"`
		Status string   `json:"status"`
		Sent   int      `json:"sent"`
		Lists  []int    `json:"lists"`
		Names  []string `json:"list_names"`
	}
	cs := make([]camp, 0, len(campaigns.Results))
	for _, x := range campaigns.Results {
		cc := camp{ID: x.ID, Name: x.Name, Status: x.Status, Sent: x.Sent, Lists: []int{}, Names: []string{}}
		for _, l := range x.Lists {
			cc.Lists = append(cc.Lists, l.ID)
			cc.Names = append(cc.Names, l.Name)
		}
		cs = append(cs, cc)
	}
	ts := make([]map[string]any, 0, len(templates))
	for _, t := range templates {
		ts = append(ts, map[string]any{"id": t.ID, "name": t.Name, "type": t.Type, "is_default": t.IsDefault})
	}

	return c.JSON(http.StatusOK, okResp{map[string]any{
		"lists":       lists.Results,
		"subscribers": subs.Total,
		"templates":   ts,
		"campaigns":   cs,
		"smtp":        settings.SMTP,
		"smtp_error":  smtpErr,
	}})
}

// planItem sends a list or a template of the other instance to a project
// here (0: not imported).
type planItem struct {
	ID        int `json:"id"`
	ProjectID int `json:"project_id"`
}

// migrationPlan says where each list and template of the other instance goes.
type migrationPlan struct {
	Source    lmSource   `json:"source"`
	Lists     []planItem `json:"lists"`
	Templates []planItem `json:"templates"`
	Campaigns bool       `json:"campaigns"`
}

// StartListmonkImport starts the import in the background.
func (a *App) StartListmonkImport(c *echo.Context) error {
	var p migrationPlan
	if err := json.NewDecoder(c.Request().Body).Decode(&p); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	if _, err := p.Source.base(); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	projects := map[int]bool{}
	for _, l := range append(append([]planItem{}, p.Lists...), p.Templates...) {
		if l.ProjectID == 0 || projects[l.ProjectID] {
			continue
		}
		if _, err := a.core.GetProject(l.ProjectID, "", ""); err != nil {
			return err
		}
		projects[l.ProjectID] = true
	}

	migration.Lock()
	if migration.run != nil && migration.run.Running {
		migration.Unlock()
		return echo.NewHTTPError(http.StatusConflict, "Un import est déjà en cours.")
	}
	run := &migrationRun{Running: true, Step: "Démarrage", Counts: map[string]int{}, Errors: []string{}, StartedAt: time.Now()}
	migration.run = run
	migration.Unlock()

	go a.runListmonkImport(p, run)
	return c.JSON(http.StatusOK, okResp{run})
}

// GetListmonkImport returns the progress of the running or last import.
func (a *App) GetListmonkImport(c *echo.Context) error {
	migration.Lock()
	defer migration.Unlock()
	if migration.run == nil {
		return c.JSON(http.StatusOK, okResp{nil})
	}
	out := *migration.run
	out.Counts = map[string]int{}
	for k, v := range migration.run.Counts {
		out.Counts[k] = v
	}
	out.Errors = append([]string{}, migration.run.Errors...)
	return c.JSON(http.StatusOK, okResp{out})
}

func (a *App) runListmonkImport(p migrationPlan, run *migrationRun) {
	defer func() {
		if r := recover(); r != nil {
			run.note(fmt.Sprintf("arrêt inattendu : %v", r))
		}
		migration.Lock()
		now := time.Now()
		run.Running = false
		run.FinishedAt = &now
		if run.Step != "Terminé" {
			run.Step = "Interrompu"
		}
		migration.Unlock()
		a.log.Printf("listmonk import finished: %v", run.Counts)
	}()

	src := p.Source
	target := map[int]int{}
	for _, l := range p.Lists {
		if l.ProjectID > 0 {
			target[l.ID] = l.ProjectID
		}
	}

	// 1. Lists, reused by name when they already exist in the project.
	run.step("Listes")
	var lists struct {
		Results []lmList `json:"results"`
	}
	if err := src.get("/api/lists?per_page=all&minimal=false", &lists); err != nil {
		run.note(err.Error())
		return
	}
	newList := map[int]int{}
	for _, l := range lists.Results {
		pid, ok := target[l.ID]
		if !ok {
			continue
		}
		var id int
		if err := a.db.Get(&id, `SELECT id FROM lists WHERE project_id=$1 AND name=$2 LIMIT 1`, pid, l.Name); err == nil {
			newList[l.ID] = id
			run.add("lists_existing", 1)
			continue
		}
		typ := l.Type
		if typ != models.ListTypePublic {
			typ = models.ListTypePrivate
		}
		out, err := a.core.CreateList(models.List{Name: l.Name, Type: typ, Optin: l.Optin, Status: l.Status, Tags: l.Tags, Description: l.Description, ProjectID: pid})
		if err != nil {
			run.note(fmt.Sprintf("liste « %s » : %v", l.Name, err))
			continue
		}
		newList[l.ID] = out.ID
		run.add("lists", 1)
	}

	// 2. Subscribers, page by page, with their subscription status per list.
	run.step("Contacts")
	const perPage = 500
	for page := 1; ; page++ {
		var res struct {
			Results []lmSubscriber `json:"results"`
			Total   int            `json:"total"`
		}
		if err := src.get(fmt.Sprintf("/api/subscribers?per_page=%d&page=%d&order_by=id&order=asc", perPage, page), &res); err != nil {
			run.note(err.Error())
			break
		}
		migration.Lock()
		run.Total = res.Total
		migration.Unlock()
		for _, s := range res.Results {
			a.importSubscriber(s, target, newList, run)
		}
		if len(res.Results) < perPage {
			break
		}
	}

	// 3. Templates.
	newTpl := map[int]int{}
	tplProject := map[int]int{}
	if len(p.Templates) > 0 {
		run.step("Modèles")
	}
	for _, t := range p.Templates {
		if t.ProjectID == 0 {
			continue
		}
		var tpl lmTemplate
		if err := src.get(fmt.Sprintf("/api/templates/%d", t.ID), &tpl); err != nil {
			run.note(err.Error())
			continue
		}
		var id int
		if err := a.db.Get(&id, `SELECT id FROM templates WHERE project_id=$1 AND name=$2 LIMIT 1`, t.ProjectID, tpl.Name); err == nil {
			newTpl[t.ID], tplProject[t.ID] = id, t.ProjectID
			run.add("templates_existing", 1)
			continue
		}
		out, err := a.core.CreateTemplate(tpl.Name, tpl.Type, tpl.Subject, []byte(tpl.Body), tpl.BodySource, t.ProjectID)
		if err != nil {
			run.note(fmt.Sprintf("modèle « %s » : %v", tpl.Name, err))
			continue
		}
		newTpl[t.ID], tplProject[t.ID] = out.ID, t.ProjectID
		run.add("templates", 1)
	}

	// 4. Campaigns, always as drafts: nothing is sent.
	if p.Campaigns {
		run.step("Campagnes")
		a.importCampaigns(src, target, newList, newTpl, tplProject, run)
	}

	run.step("Terminé")
}

func (a *App) importSubscriber(s lmSubscriber, target, newList map[int]int, run *migrationRun) {
	// Group the subscriptions by project, then by status.
	byProject := map[int]map[string][]int{}
	for _, l := range s.Lists {
		pid, ok := target[l.ID]
		nid, ok2 := newList[l.ID]
		if !ok || !ok2 {
			continue
		}
		st := l.SubscriptionStatus
		if st != models.SubscriptionStatusUnconfirmed && st != models.SubscriptionStatusUnsubscribed {
			st = models.SubscriptionStatusConfirmed
		}
		if byProject[pid] == nil {
			byProject[pid] = map[string][]int{}
		}
		byProject[pid][st] = append(byProject[pid][st], nid)
	}
	if len(byProject) == 0 {
		run.add("subscribers_skipped", 1)
		return
	}

	status := s.Status
	if status != models.SubscriberStatusBlockListed && status != "disabled" {
		status = "enabled"
	}
	attribs := models.JSON{}
	if len(s.Attribs) > 0 {
		_ = json.Unmarshal(s.Attribs, &attribs)
	}

	for pid, statuses := range byProject {
		sub, _, err := a.core.InsertSubscriber(models.Subscriber{
			Email: strings.TrimSpace(s.Email), Name: s.Name, Status: status, Attribs: attribs, ProjectID: pid,
		}, nil, nil, true, false)
		existing := false
		if err != nil {
			var he *echo.HTTPError
			if !errors.As(err, &he) || he.Code != http.StatusConflict {
				run.note(fmt.Sprintf("contact %s : %v", s.Email, err))
				continue
			}
			if sub, err = a.core.GetSubscriber(0, "", strings.TrimSpace(s.Email), pid); err != nil {
				run.note(fmt.Sprintf("contact %s : %v", s.Email, err))
				continue
			}
			existing = true
		}
		for st, ids := range statuses {
			if err := a.core.AddSubscriptions([]int{sub.ID}, ids, st); err != nil {
				run.note(fmt.Sprintf("abonnements de %s : %v", s.Email, err))
			}
		}
		if existing {
			run.add("subscribers_existing", 1)
		} else {
			run.add("subscribers", 1)
		}
	}
}

func (a *App) importCampaigns(src lmSource, target, newList, newTpl, tplProject map[int]int, run *migrationRun) {
	var res struct {
		Results []lmCampaign `json:"results"`
	}
	if err := src.get("/api/campaigns?per_page=all", &res); err != nil {
		run.note(err.Error())
		return
	}

	// The messengers known here: an old campaign keeps its relay if a relay of
	// the same name exists (or is added from the other instance's servers).
	for _, oc := range res.Results {
		// The project of the campaign: the one of its first imported list.
		pid := 0
		for _, l := range oc.Lists {
			if p, ok := target[l.ID]; ok {
				pid = p
				break
			}
		}
		if pid == 0 {
			run.add("campaigns_skipped", 1)
			run.note(fmt.Sprintf("campagne « %s » ignorée : aucune de ses listes n’est importée", oc.Name))
			continue
		}
		var listIDs []int
		for _, l := range oc.Lists {
			if p, ok := target[l.ID]; ok && p == pid {
				if id, ok := newList[l.ID]; ok {
					listIDs = append(listIDs, id)
				}
			}
		}

		name := oc.Name
		if oc.Status == models.CampaignStatusFinished || oc.Sent > 0 {
			when := ""
			if oc.UpdatedAt.Valid {
				when = " le " + oc.UpdatedAt.Time.Format("02/01/2006")
			}
			name = fmt.Sprintf("%s (envoyée%s sur l’ancienne instance, %d e-mails)", oc.Name, when, oc.Sent)
		}
		var n int
		if err := a.db.Get(&n, `SELECT COUNT(*) FROM campaigns WHERE project_id=$1 AND name=$2`, pid, name); err == nil && n > 0 {
			run.add("campaigns_existing", 1)
			continue
		}

		tplID := null.Int{}
		if oc.TemplateID.Valid {
			if id, ok := newTpl[oc.TemplateID.Int]; ok && tplProject[oc.TemplateID.Int] == pid {
				tplID = null.IntFrom(id)
			}
		}
		if !tplID.Valid && oc.ContentType != models.CampaignContentTypeVisual {
			// The default campaign template of the instance.
			var id int
			if err := a.db.Get(&id, `SELECT id FROM templates WHERE type='campaign' AND is_default=true LIMIT 1`); err == nil {
				tplID = null.IntFrom(id)
			}
		}

		messenger := oc.Messenger
		if messenger == "" {
			messenger = "email"
		}
		typ := oc.Type
		if typ == "" {
			typ = models.CampaignTypeRegular
		}
		attribs := models.JSON{}
		if len(oc.Attribs) > 0 {
			_ = json.Unmarshal(oc.Attribs, &attribs)
		}

		_, err := a.core.CreateCampaign(models.Campaign{
			Type: typ, Name: name, Subject: oc.Subject, FromEmail: oc.FromEmail, Body: oc.Body, BodySource: oc.BodySource,
			AltBody: oc.AltBody, ContentType: oc.ContentType, Tags: oc.Tags, Headers: oc.Headers, Attribs: attribs,
			TemplateID: tplID, Messenger: messenger, ArchiveMeta: json.RawMessage("{}"), ProjectID: pid,
		}, listIDs, nil)
		if err != nil {
			run.note(fmt.Sprintf("campagne « %s » : %v", oc.Name, err))
			continue
		}
		run.add("campaigns", 1)
	}
}
