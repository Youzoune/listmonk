package main

import (
	"net/http"

	"github.com/knadh/listmonk/internal/appurls"
	"github.com/labstack/echo/v5"
)

const (
	// uriApp is where the React admin (static/app) is served.
	uriApp = "/app"

	// uriLanding is where people land after signing in when no page was asked
	// for: the Relais app.
	uriLanding = uriApp

	appIndexFile = "/app/index.html"
)

// ServeApp serves the React admin's index page for every client-side route
// under /app. Its hashed assets are served by the static file server.
func (a *App) ServeApp(c *echo.Context) error {
	b, err := a.fs.Read(appIndexFile)
	if err != nil {
		a.log.Printf("error reading %s: %v (build it with `make build-app`)", appIndexFile, err)
		return echo.NewHTTPError(http.StatusNotFound, "The new admin is not built. Run `make build-app`.")
	}

	// The index references hashed asset names, so it must never be cached.
	c.Response().Header().Set("Cache-Control", "no-cache")
	return c.HTMLBlob(http.StatusOK, b)
}

// legacyAdmin tells whether the legacy server-rendered admin pages under
// /admin are served (LISTMONK_relais__legacy_admin=true, for the upstream e2e tests).
// Otherwise every /admin page sends people to its Relais screen. The sign-in
// pages under /admin (login, 2FA, password reset) are always served.
func legacyAdmin() bool {
	return ko.Bool("relais.legacy_admin")
}

// RedirectToApp sends a legacy admin page to its Relais screen.
func (a *App) RedirectToApp(c *echo.Context) error {
	return c.Redirect(http.StatusFound, appurls.ForAdmin(c.Request().URL.Path))
}
