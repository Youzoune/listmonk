package main

import (
	"net/http"
	"regexp"
	"slices"
	"strconv"
	"strings"

	"github.com/knadh/listmonk/internal/auth"
	"github.com/knadh/listmonk/internal/core"
	"github.com/knadh/listmonk/models"
	"github.com/labstack/echo/v5"
)

var (
	regexpProjectSlug   = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)
	regexpProjectDomain = regexp.MustCompile(`^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$`)
)

const (
	projectSlugMaxLen = 64

	// projectHeader carries the current project (ID or slug) on API requests.
	// Requests without it work on the default project.
	projectHeader = "X-Listmonk-Project"

	// projectCookie is set by the React admin when switching projects so that
	// the legacy admin pages follow the same project.
	projectCookie = "relais_project"

	projectCtxKey = "project_id"
)

// projectMiddleware resolves the request's current project from the
// X-Listmonk-Project header (or the relais_project cookie) and checks that
// the user can access it.
func (a *App) projectMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c *echo.Context) error {
		id := models.DefaultProjectID

		h := strings.TrimSpace(c.Request().Header.Get(projectHeader))
		if h == "" {
			if ck, err := c.Cookie(projectCookie); err == nil {
				h = strings.TrimSpace(ck.Value)
			}
		}
		if h != "" {
			if n, err := strconv.Atoi(h); err == nil && n > 0 {
				id = n
			} else {
				p, err := a.core.GetProject(0, "", strings.ToLower(h))
				if err != nil {
					return err
				}
				id = p.ID
			}
		}

		user, ok := c.Get(auth.UserHTTPCtxKey).(auth.User)
		if !ok {
			return echo.NewHTTPError(http.StatusForbidden, a.i18n.Ts("globals.messages.permissionDenied", "name", "{globals.terms.project}"))
		}
		if err := a.hasProjectAccess(user, id); err != nil {
			return err
		}

		c.Set(projectCtxKey, id)
		return next(c)
	}
}

// projectID returns the request's current project. Requests that didn't go
// through projectMiddleware (the legacy admin pages) use the default project.
func projectID(c *echo.Context) int {
	if id, ok := c.Get(projectCtxKey).(int); ok {
		return id
	}
	return models.DefaultProjectID
}

// GetProjects returns the projects the user has access to. Users who can
// manage projects see all of them.
func (a *App) GetProjects(c *echo.Context) error {
	user := auth.GetUser(c)

	out, err := a.core.GetProjects(user.HasPerm(auth.PermProjectsManage), user.ID)
	if err != nil {
		return err
	}

	return c.JSON(http.StatusOK, okResp{out})
}

// GetProject returns a single project.
func (a *App) GetProject(c *echo.Context) error {
	id := getID(c)
	if err := a.hasProjectAccess(auth.GetUser(c), id); err != nil {
		return err
	}

	out, err := a.core.GetProject(id, "", "")
	if err != nil {
		return err
	}

	return c.JSON(http.StatusOK, okResp{out})
}

// CreateProject creates a new project.
func (a *App) CreateProject(c *echo.Context) error {
	var p models.Project
	if err := c.Bind(&p); err != nil {
		return err
	}

	p, err := a.validateProject(p)
	if err != nil {
		return err
	}

	out, err := a.core.CreateProject(p)
	if err != nil {
		return err
	}

	return c.JSON(http.StatusOK, okResp{out})
}

// UpdateProject updates a project.
func (a *App) UpdateProject(c *echo.Context) error {
	var p models.Project
	if err := c.Bind(&p); err != nil {
		return err
	}

	p, err := a.validateProject(p)
	if err != nil {
		return err
	}

	out, err := a.core.UpdateProject(getID(c), p)
	if err != nil {
		return err
	}

	return c.JSON(http.StatusOK, okResp{out})
}

// DeleteProject deletes an empty project.
func (a *App) DeleteProject(c *echo.Context) error {
	if err := a.core.DeleteProject(getID(c)); err != nil {
		return err
	}

	return c.JSON(http.StatusOK, okResp{true})
}

// GetUserProjects returns the IDs of the projects a user has access to.
func (a *App) GetUserProjects(c *echo.Context) error {
	out, err := a.core.GetUserProjectIDs(getID(c))
	if err != nil {
		return err
	}

	return c.JSON(http.StatusOK, okResp{out})
}

// UpdateUserProjects replaces the projects a user has access to.
func (a *App) UpdateUserProjects(c *echo.Context) error {
	var req struct {
		ProjectIDs []int `json:"project_ids"`
	}
	if err := c.Bind(&req); err != nil {
		return err
	}
	if req.ProjectIDs == nil {
		req.ProjectIDs = []int{}
	}

	id := getID(c)
	if err := a.core.SetUserProjects(id, req.ProjectIDs); err != nil {
		return err
	}

	out, err := a.core.GetUserProjectIDs(id)
	if err != nil {
		return err
	}

	return c.JSON(http.StatusOK, okResp{out})
}

// hasProjectAccess checks whether the user can access the given project.
func (a *App) hasProjectAccess(user auth.User, projectID int) error {
	if user.HasPerm(auth.PermProjectsManage) {
		return nil
	}

	ids, err := a.core.GetUserProjectIDs(user.ID)
	if err != nil {
		return err
	}
	if !slices.Contains(ids, projectID) {
		return echo.NewHTTPError(http.StatusForbidden,
			a.i18n.Ts("globals.messages.permissionDenied", "name", "{globals.terms.project}"))
	}

	return nil
}

// validateProject validates and normalizes a project's fields.
func (a *App) validateProject(p models.Project) (models.Project, error) {
	p.Name = strings.TrimSpace(p.Name)
	p.Slug = strings.ToLower(strings.TrimSpace(p.Slug))
	p.Domain.String = strings.ToLower(strings.TrimSpace(p.Domain.String))
	p.Domain.Valid = p.Domain.String != ""

	if !strHasLen(p.Name, 1, stdInputMaxLen) {
		return p, echo.NewHTTPError(http.StatusBadRequest, a.i18n.T("globals.messages.invalidName"))
	}
	if len(p.Slug) > projectSlugMaxLen || !regexpProjectSlug.MatchString(p.Slug) {
		return p, echo.NewHTTPError(http.StatusBadRequest, a.i18n.T("projects.invalidSlug"))
	}
	if p.Domain.Valid && (len(p.Domain.String) > 253 || !regexpProjectDomain.MatchString(p.Domain.String)) {
		return p, echo.NewHTTPError(http.StatusBadRequest, a.i18n.T("projects.invalidDomain"))
	}
	if !strHasLen(p.Description, 0, stdInputMaxLen) {
		return p, echo.NewHTTPError(http.StatusBadRequest,
			a.i18n.Ts("globals.messages.invalidFields", "name", "description"))
	}

	return p, nil
}

// entityTerms maps owned entities to their i18n names for error messages.
var entityTerms = map[string]string{
	core.EntityList:       "{globals.terms.list}",
	core.EntityCampaign:   "{globals.terms.campaign}",
	core.EntitySubscriber: "{globals.terms.subscriber}",
	core.EntityTemplate:   "{globals.terms.template}",
	core.EntityMedia:      "{globals.terms.media}",
	core.EntityBounce:     "{globals.terms.bounce}",
}

// requireOwned checks that every given row belongs to the request's project.
// Rows of other projects get the same response as missing rows (listmonk
// answers 400 for those) so that their existence doesn't leak across projects.
func (a *App) requireOwned(c *echo.Context, entity string, ids ...int) error {
	if len(ids) == 0 {
		return nil
	}

	owned, err := a.core.FilterOwned(entity, ids, projectID(c))
	if err != nil {
		return err
	}

	for _, id := range ids {
		if !slices.Contains(owned, id) {
			return echo.NewHTTPError(http.StatusBadRequest,
				a.i18n.Ts("globals.messages.notFound", "name", entityTerms[entity]))
		}
	}

	return nil
}

// owned wraps a handler for an /:id route so that it only runs when the
// row belongs to the request's project.
func (a *App) owned(entity string, next echo.HandlerFunc) echo.HandlerFunc {
	return func(c *echo.Context) error {
		if err := a.requireOwned(c, entity, getID(c)); err != nil {
			return err
		}
		return next(c)
	}
}
