// Package appurls maps the legacy admin's addresses (/admin/...) to the
// screens of the Relais app (/app/...), so that old links, bookmarks and
// notification e-mails keep working once the legacy admin is turned off.
package appurls

import (
	"regexp"
	"strings"
)

const (
	adminURI = "/admin"
	appURI   = "/app"
)

// The Relais screen of each legacy admin page, most specific first.
var legacyAdminRoutes = []struct {
	re  *regexp.Regexp
	app string
}{
	{regexp.MustCompile(`^/lists/forms`), "/formulaire"},
	{regexp.MustCompile(`^/lists`), "/listes"},
	{regexp.MustCompile(`^/campaigns/new`), "/campagnes/nouvelle"},
	{regexp.MustCompile(`^/campaigns/media`), "/medias"},
	{regexp.MustCompile(`^/campaigns/templates`), "/modeles"},
	{regexp.MustCompile(`^/campaigns/(\d+)`), "/campagnes/$1"},
	{regexp.MustCompile(`^/campaigns`), "/campagnes"},
	{regexp.MustCompile(`^/templates/(\d+)`), "/modeles/$1"},
	{regexp.MustCompile(`^/templates`), "/modeles"},
	{regexp.MustCompile(`^/subscribers/import`), "/audience/import"},
	{regexp.MustCompile(`^/subscribers/bounces`), "/rebonds"},
	{regexp.MustCompile(`^/subscribers/new`), "/audience/nouveau"},
	{regexp.MustCompile(`^/subscribers/lists/(\d+)`), "/audience?liste=$1"},
	{regexp.MustCompile(`^/subscribers/(\d+)`), "/audience/$1"},
	{regexp.MustCompile(`^/subscribers`), "/audience"},
	{regexp.MustCompile(`^/users/roles`), "/equipe?onglet=roles"},
	{regexp.MustCompile(`^/users`), "/equipe"},
	{regexp.MustCompile(`^/user/profile`), "/compte"},
	{regexp.MustCompile(`^/settings/(logs|maintenance)`), "/maintenance"},
	{regexp.MustCompile(`^/settings`), "/reglages"},
}

// ForAdmin returns the Relais address of a legacy /admin page.
func ForAdmin(uri string) string {
	p := strings.TrimPrefix(uri, adminURI)
	if i := strings.IndexAny(p, "?#"); i >= 0 {
		p = p[:i]
	}
	for _, r := range legacyAdminRoutes {
		if m := r.re.FindStringSubmatchIndex(p); m != nil {
			return appURI + string(r.re.ExpandString(nil, r.app, p, m))
		}
	}
	return appURI
}

// IsLegacyAdmin tells whether a path is a legacy admin page (not one of
// the sign-in pages, which stay under /admin).
func IsLegacyAdmin(uri string) bool {
	if uri != adminURI && !strings.HasPrefix(uri, adminURI+"/") {
		return false
	}
	for _, p := range []string{"/login", "/forgot", "/reset", "/custom."} {
		if strings.HasPrefix(uri, adminURI+p) {
			return false
		}
	}
	return true
}
