package main

import (
	"net/http"

	"github.com/knadh/listmonk/internal/core"
	"github.com/knadh/listmonk/internal/projectdir"
	"github.com/knadh/listmonk/models"
	"github.com/labstack/echo/v5"
)

// publicProjectCtxKey holds the project a public page belongs to, once the
// handler knows it (the subscriber's or the campaign's).
const publicProjectCtxKey = "public_project_id"

// loadProjects (re)reads all projects into the directory.
func loadProjects(d *projectdir.Dir, co *core.Core) error {
	all, err := co.GetProjects(true, 0)
	if err != nil {
		return err
	}
	d.Set(all)

	return nil
}

// refreshProjects reloads the projects after one is created, changed or deleted.
func (a *App) refreshProjects() {
	if err := loadProjects(a.projects, a.core); err != nil {
		a.log.Printf("error reloading projects: %v", err)
		return
	}
	a.manager.SetProjectURLs(a.projects.ManagerURLs())
}

// hostProject returns the project whose domain the request came on, if any.
func (a *App) hostProject(c *echo.Context) (int, bool) {
	return a.projects.FromHost(c.Request().Host)
}

// publicProjectID is the project of a public page that isn't about one
// subscriber or one campaign (lists, subscription form, archive): the
// project of the domain, else the one named by ?project=<slug>, else the
// default project.
func (a *App) publicProjectID(c *echo.Context) int {
	if id, ok := a.hostProject(c); ok {
		return id
	}
	if slug := c.QueryParam("project"); slug != "" {
		if id, ok := a.projects.FromSlug(slug); ok {
			return id
		}
	}

	return models.DefaultProjectID
}

// onHostProject tells whether a subscriber's or a campaign's project can be
// shown on the request's host: a project's domain only serves that project.
func (a *App) onHostProject(c *echo.Context, projectID int) bool {
	id, ok := a.hostProject(c)
	return !ok || id == projectID
}

// notFoundPage renders the public "not found" page.
func (a *App) notFoundPage(c *echo.Context, msg string) error {
	return c.Render(http.StatusNotFound, tplMessage, makeMsgTpl(a.i18n.T("globals.terms.notFound"), "", msg))
}
