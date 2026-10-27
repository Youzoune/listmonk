package core

import (
	"net/http"

	"github.com/jmoiron/sqlx/types"
	"github.com/labstack/echo/v5"
)

// GetDashboardCharts returns chart data points to render on the dashboard.
// projectID 0 returns the instance-wide charts from the cache.
func (c *Core) GetDashboardCharts(projectID int) (types.JSONText, error) {
	var out types.JSONText
	if projectID > 0 {
		if err := c.q.GetProjectDashboardCharts.Get(&out, projectID); err != nil {
			return nil, echo.NewHTTPError(http.StatusInternalServerError,
				c.i18n.Ts("globals.messages.errorFetching", "name", "dashboard charts", "error", pqErrMsg(err)))
		}
		return out, nil
	}

	_ = c.refreshCache(matDashboardCharts, false)
	if err := c.q.GetDashboardCharts.Get(&out); err != nil {
		return nil, echo.NewHTTPError(http.StatusInternalServerError,
			c.i18n.Ts("globals.messages.errorFetching", "name", "dashboard charts", "error", pqErrMsg(err)))
	}

	return out, nil
}

// GetDashboardCounts returns stats counts to show on the dashboard.
// projectID 0 returns the instance-wide counts from the cache.
func (c *Core) GetDashboardCounts(projectID int) (types.JSONText, error) {
	var out types.JSONText
	if projectID > 0 {
		if err := c.q.GetProjectDashboardCounts.Get(&out, projectID); err != nil {
			return nil, echo.NewHTTPError(http.StatusInternalServerError,
				c.i18n.Ts("globals.messages.errorFetching", "name", "dashboard stats", "error", pqErrMsg(err)))
		}
		return out, nil
	}

	_ = c.refreshCache(matDashboardCounts, false)
	if err := c.q.GetDashboardCounts.Get(&out); err != nil {
		return nil, echo.NewHTTPError(http.StatusInternalServerError,
			c.i18n.Ts("globals.messages.errorFetching", "name", "dashboard stats", "error", pqErrMsg(err)))
	}

	return out, nil
}
