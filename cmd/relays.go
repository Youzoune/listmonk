package main

import (
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/knadh/koanf/v2"
	"github.com/knadh/listmonk/internal/manager"
	"github.com/knadh/listmonk/internal/messenger/email"
	"github.com/knadh/listmonk/models"
	"github.com/labstack/echo/v5"
)

// relayResp is a sending relay as shown in the relays API: an SMTP server
// with its project, cadence, warm-up and today's usage.
type relayResp struct {
	UUID      string              `json:"uuid"`
	Name      string              `json:"name"`
	Host      string              `json:"host"`
	Port      int                 `json:"port"`
	Enabled   bool                `json:"enabled"`
	Pool      bool                `json:"pool"`
	InPool    bool                `json:"in_default_pool"`
	ProjectID int                 `json:"project_id"`
	System    bool                `json:"system"`
	Cadence   models.RelayCadence `json:"cadence"`
	Warmup    models.RelayWarmup  `json:"warmup"`
	Servers   int                 `json:"servers,omitempty"`

	// Example tells a server is one of the installer's placeholders
	// (smtp.yoursite.com…): it can't send anything.
	Example bool `json:"example"`
	// Members are the servers of the default relay (the pool only).
	Members []relayResp `json:"members,omitempty"`

	Status *manager.RelayStatus `json:"status"`
}

// relayLimits turns a relay's settings into the manager's limits.
func relayLimits(c models.RelayCadence, w models.RelayWarmup) manager.RelayLimits {
	tz := c.Timezone
	if tz == "" {
		tz = models.DefaultRelayTimezone
	}
	loc, err := time.LoadLocation(tz)
	if err != nil {
		lo.Printf("invalid relay timezone %q, using UTC: %v", tz, err)
		loc = time.UTC
	}

	out := manager.RelayLimits{
		PerMinute: c.PerMinute,
		PerHour:   c.PerHour,
		PerDay:    c.PerDay,
		Days:      c.Days,
		FromHour:  c.FromHour,
		ToHour:    c.ToHour,
		Location:  loc,
	}

	if w.Enabled {
		since, err := time.ParseInLocation(time.DateOnly, w.Since, loc)
		if err != nil {
			// A warm-up without a valid start day starts today.
			since = time.Now().In(loc)
		}
		out.Warmup = manager.Warmup{Enabled: true, Start: w.Start, Growth: w.Growth, Cap: w.Cap, Since: since}
	}

	return out
}

// smtpRelays reads the SMTP servers from the config.
func smtpRelays(ko *koanf.Koanf) []relayResp {
	var out []relayResp
	for _, item := range ko.Slices("smtp") {
		var r relayResp
		if err := item.UnmarshalWithConf("", &r, koanf.UnmarshalConf{Tag: "json"}); err != nil {
			lo.Printf("error reading SMTP relay config: %v", err)
			continue
		}
		r.InPool = r.Enabled && !item.Bool("exclude_from_default") && r.ProjectID == 0
		r.Example = isExampleServer(r.Host, item.String("username"))
		out = append(out, r)
	}
	return out
}

// initRelays gives every messenger its cadence and warm-up. Messengers
// without any are only counted.
func initRelays(mgr *manager.Manager, msgrs []manager.Messenger, ko *koanf.Koanf) {
	limits := map[string]manager.RelayLimits{}
	for _, r := range smtpRelays(ko) {
		if r.Enabled && r.Name != "" {
			limits[r.Name] = relayLimits(r.Cadence, r.Warmup)
		}
	}

	for _, m := range msgrs {
		lim, ok := limits[m.Name()]
		if !ok {
			lim = manager.RelayLimits{Location: time.UTC}
		}
		mgr.SetRelayLimits(m.Name(), lim)
	}
}

// relayAllowed tells whether a project may send through a messenger: the
// default pool and shared relays are open to every project, a project's
// relays to that project only.
func (a *App) relayAllowed(name string, projectID int) bool {
	if name == email.MessengerName {
		return true
	}
	for _, r := range smtpRelays(ko) {
		if r.Name == name {
			return r.ProjectID == 0 || r.ProjectID == projectID
		}
	}

	// Postback messengers aren't tied to projects.
	return a.manager.HasMessenger(name)
}

func (a *App) checkRelay(c *echo.Context, name string) error {
	if !a.relayAllowed(name, projectID(c)) {
		return echo.NewHTTPError(http.StatusBadRequest, a.i18n.Ts("relays.notAllowed", "name", name))
	}
	return nil
}

// GetRelays returns the relays available in the current project, with their usage.
func (a *App) GetRelays(c *echo.Context) error {
	var (
		pid      = projectID(c)
		statuses = map[string]manager.RelayStatus{}
		system   = ko.String("app.system_messenger")
	)
	for _, s := range a.manager.RelayStatuses() {
		statuses[s.Name] = s
	}
	if system == "" {
		system = email.MessengerName
	}

	all := smtpRelays(ko)
	pool := relayResp{Name: email.MessengerName, Pool: true, Enabled: true, System: system == email.MessengerName, Example: true}
	for _, r := range all {
		if r.InPool {
			pool.Servers++
			pool.Members = append(pool.Members, r)
			// The default relay can send as soon as one of its servers is real.
			pool.Example = pool.Example && r.Example
		}
	}
	if s, ok := statuses[pool.Name]; ok {
		pool.Status = &s
	}

	out := []relayResp{pool}
	for _, r := range all {
		if r.ProjectID != 0 && r.ProjectID != pid {
			continue
		}
		r.System = r.Name != "" && r.Name == system
		if s, ok := statuses[r.Name]; ok && r.Enabled {
			r.Status = &s
		}
		out = append(out, r)
	}

	return c.JSON(http.StatusOK, okResp{out})
}

// UpdateRelay changes the project, cadence and warm-up of an SMTP relay, and
// whether it carries the system notifications.
func (a *App) UpdateRelay(c *echo.Context) error {
	var req struct {
		ProjectID int                 `json:"project_id"`
		Cadence   models.RelayCadence `json:"cadence"`
		Warmup    models.RelayWarmup  `json:"warmup"`
		System    bool                `json:"system"`
	}
	if err := c.Bind(&req); err != nil {
		return err
	}

	if err := a.validateRelayCadence(req.Cadence, req.Warmup); err != nil {
		return err
	}
	if req.ProjectID != 0 {
		if _, err := a.core.GetProject(req.ProjectID, "", ""); err != nil {
			return err
		}
	}

	set, err := a.core.GetSettings()
	if err != nil {
		return err
	}

	uuid := c.Param("uuid")
	i := slices.IndexFunc(set.SMTP, func(s models.SMTPServer) bool { return s.UUID == uuid })
	if i < 0 {
		return echo.NewHTTPError(http.StatusBadRequest, a.i18n.Ts("globals.messages.notFound", "name", "SMTP"))
	}
	s := &set.SMTP[i]
	if req.ProjectID != 0 && s.Name == "" {
		return echo.NewHTTPError(http.StatusBadRequest, a.i18n.T("relays.projectNameRequired"))
	}

	// The system relay is shared by every project.
	if req.System && (req.ProjectID != 0 || s.Name == "" || !s.Enabled) {
		return echo.NewHTTPError(http.StatusBadRequest, a.i18n.Ts("relays.invalidSystemRelay", "name", s.Name))
	}

	s.ProjectID = req.ProjectID
	s.Cadence = req.Cadence
	s.Warmup = req.Warmup
	switch {
	case req.System:
		set.AppSystemMessenger = s.Name
	case set.AppSystemMessenger == s.Name:
		set.AppSystemMessenger = ""
	}

	// The default pool needs at least one shared server.
	has := false
	for _, srv := range set.SMTP {
		if srv.Enabled && !srv.ExcludeFromDefault && srv.ProjectID == 0 {
			has = true
		}
	}
	if !has {
		return echo.NewHTTPError(http.StatusBadRequest, a.i18n.T("settings.smtp.defaultRequired"))
	}

	if err := a.core.UpdateSettings(set); err != nil {
		return err
	}

	return a.handleSettingsRestart(c)
}

// validateRelayCadence checks a relay's cadence and warm-up values.
func (a *App) validateRelayCadence(c models.RelayCadence, w models.RelayWarmup) error {
	bad := func(field string) error {
		return echo.NewHTTPError(http.StatusBadRequest, a.i18n.Ts("relays.invalidCadence", "name", field))
	}

	if c.PerMinute < 0 || c.PerHour < 0 || c.PerDay < 0 {
		return bad("rate")
	}
	for _, d := range c.Days {
		if d < 0 || d > 6 {
			return bad("days")
		}
	}
	if c.FromHour < 0 || c.FromHour > 23 || c.ToHour < 0 || c.ToHour > 24 || (c.ToHour != 0 && c.ToHour <= c.FromHour) {
		return bad("hours")
	}
	if c.Timezone != "" {
		if _, err := time.LoadLocation(c.Timezone); err != nil {
			return bad("timezone")
		}
	}

	if w.Enabled {
		badW := func(field string) error {
			return echo.NewHTTPError(http.StatusBadRequest, a.i18n.Ts("relays.invalidWarmup", "name", field))
		}
		if w.Start < 1 {
			return badW("start")
		}
		if w.Growth < 0 || w.Growth > 1000 {
			return badW("growth")
		}
		if w.Cap < w.Start {
			return badW("cap")
		}
		if _, err := time.Parse(time.DateOnly, w.Since); err != nil {
			return badW("since")
		}
	}

	return nil
}

// isExampleServer tells the installer's placeholder SMTP servers (schema.sql)
// from real ones, so that the app can say nothing can be sent yet.
func isExampleServer(host, username string) bool {
	h := strings.ToLower(strings.TrimSpace(host))
	u := strings.ToLower(strings.TrimSpace(username))
	return h == "" || h == "smtp.yoursite.com" || strings.HasSuffix(h, ".yoursite.com") ||
		u == "username" || u == "username@gmail.com"
}

// relayConfigured tells whether an SMTP relay exists in the settings, even
// turned off.
func relayConfigured(name string) bool {
	for _, r := range smtpRelays(ko) {
		if r.Name == name {
			return true
		}
	}
	return false
}
