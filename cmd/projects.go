package main

import (
	"net/http"
	"regexp"
	"slices"
	"strings"

	"github.com/knadh/listmonk/internal/auth"
	"github.com/knadh/listmonk/models"
	"github.com/labstack/echo/v5"
)

var (
	regexpProjectSlug   = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)
	regexpProjectDomain = regexp.MustCompile(`^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$`)
)

const projectSlugMaxLen = 64

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
