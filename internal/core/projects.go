package core

import (
	"database/sql"
	"errors"
	"net/http"

	"github.com/gofrs/uuid/v5"
	"github.com/knadh/listmonk/models"
	"github.com/labstack/echo/v5"
	"github.com/lib/pq"
)

const (
	pqErrUniqueViolation = "23505"
	pqErrFKViolation     = "23503"
)

// GetProjects returns all projects (getAll) or only the ones the given user has access to.
func (c *Core) GetProjects(getAll bool, userID int) ([]models.Project, error) {
	out := []models.Project{}
	if err := c.q.GetProjects.Select(&out, getAll, userID); err != nil {
		c.log.Printf("error fetching projects: %v", err)
		return nil, echo.NewHTTPError(http.StatusInternalServerError,
			c.i18n.Ts("globals.messages.errorFetching", "name", "{globals.terms.projects}", "error", pqErrMsg(err)))
	}

	return out, nil
}

// GetProject returns a project by its ID, UUID or slug.
func (c *Core) GetProject(id int, uuid, slug string) (models.Project, error) {
	var out models.Project
	if err := c.q.GetProject.Get(&out, id, uuid, slug); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return models.Project{}, echo.NewHTTPError(http.StatusBadRequest,
				c.i18n.Ts("globals.messages.notFound", "name", "{globals.terms.project}"))
		}

		c.log.Printf("error fetching project: %v", err)
		return models.Project{}, echo.NewHTTPError(http.StatusInternalServerError,
			c.i18n.Ts("globals.messages.errorFetching", "name", "{globals.terms.project}", "error", pqErrMsg(err)))
	}

	return out, nil
}

// CreateProject creates a new project.
func (c *Core) CreateProject(p models.Project) (models.Project, error) {
	uu, err := uuid.NewV4()
	if err != nil {
		c.log.Printf("error generating UUID: %v", err)
		return models.Project{}, echo.NewHTTPError(http.StatusInternalServerError,
			c.i18n.Ts("globals.messages.errorUUID", "error", err.Error()))
	}

	var newID int
	if err := c.q.CreateProject.Get(&newID, uu.String(), p.Name, p.Slug, p.Domain.String, p.Description); err != nil {
		if e := c.projectConflictErr(err); e != nil {
			return models.Project{}, e
		}

		c.log.Printf("error creating project: %v", err)
		return models.Project{}, echo.NewHTTPError(http.StatusInternalServerError,
			c.i18n.Ts("globals.messages.errorCreating", "name", "{globals.terms.project}", "error", pqErrMsg(err)))
	}

	return c.GetProject(newID, "", "")
}

// UpdateProject updates a project.
func (c *Core) UpdateProject(id int, p models.Project) (models.Project, error) {
	res, err := c.q.UpdateProject.Exec(id, p.Name, p.Slug, p.Domain.String, p.Description)
	if err != nil {
		if e := c.projectConflictErr(err); e != nil {
			return models.Project{}, e
		}

		c.log.Printf("error updating project: %v", err)
		return models.Project{}, echo.NewHTTPError(http.StatusInternalServerError,
			c.i18n.Ts("globals.messages.errorUpdating", "name", "{globals.terms.project}", "error", pqErrMsg(err)))
	}

	if n, _ := res.RowsAffected(); n == 0 {
		return models.Project{}, echo.NewHTTPError(http.StatusBadRequest,
			c.i18n.Ts("globals.messages.notFound", "name", "{globals.terms.project}"))
	}

	return c.GetProject(id, "", "")
}

// DeleteProject deletes an empty project. The default project can't be deleted.
func (c *Core) DeleteProject(id int) error {
	if id == models.DefaultProjectID {
		return echo.NewHTTPError(http.StatusBadRequest, c.i18n.T("projects.cantDeleteDefault"))
	}

	res, err := c.q.DeleteProject.Exec(id)
	if err != nil {
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == pqErrFKViolation {
			return echo.NewHTTPError(http.StatusBadRequest, c.i18n.T("projects.notEmpty"))
		}

		c.log.Printf("error deleting project: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError,
			c.i18n.Ts("globals.messages.errorDeleting", "name", "{globals.terms.project}", "error", pqErrMsg(err)))
	}

	if n, _ := res.RowsAffected(); n == 0 {
		return echo.NewHTTPError(http.StatusBadRequest,
			c.i18n.Ts("globals.messages.notFound", "name", "{globals.terms.project}"))
	}

	return nil
}

// GetUserProjectIDs returns the IDs of the projects a user has been given access to.
func (c *Core) GetUserProjectIDs(userID int) ([]int, error) {
	var out pq.Int64Array
	if err := c.q.GetUserProjectIDs.Get(&out, userID); err != nil {
		c.log.Printf("error fetching user projects: %v", err)
		return nil, echo.NewHTTPError(http.StatusInternalServerError,
			c.i18n.Ts("globals.messages.errorFetching", "name", "{globals.terms.projects}", "error", pqErrMsg(err)))
	}

	ids := make([]int, len(out))
	for i, v := range out {
		ids[i] = int(v)
	}

	return ids, nil
}

// SetUserProjects replaces the projects a user has access to.
func (c *Core) SetUserProjects(userID int, projectIDs []int) error {
	if _, err := c.q.SetUserProjects.Exec(userID, pq.Array(projectIDs)); err != nil {
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == pqErrFKViolation {
			return echo.NewHTTPError(http.StatusBadRequest,
				c.i18n.Ts("globals.messages.notFound", "name", "{globals.terms.project}"))
		}

		c.log.Printf("error setting user projects: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError,
			c.i18n.Ts("globals.messages.errorUpdating", "name", "{globals.terms.projects}", "error", pqErrMsg(err)))
	}

	return nil
}

// projectConflictErr returns a user facing error if err is a unique violation
// on the project slug or domain, and nil otherwise.
func (c *Core) projectConflictErr(err error) error {
	pqErr, ok := err.(*pq.Error)
	if !ok || pqErr.Code != pqErrUniqueViolation {
		return nil
	}

	switch pqErr.Constraint {
	case "projects_slug_key":
		return echo.NewHTTPError(http.StatusConflict, c.i18n.T("projects.slugExists"))
	case "projects_domain_key":
		return echo.NewHTTPError(http.StatusConflict, c.i18n.T("projects.domainExists"))
	}

	return nil
}
