package appurls

import "testing"

func TestForAdmin(t *testing.T) {
	for in, want := range map[string]string{
		"/admin":                         "/app",
		"/admin/":                        "/app",
		"/admin/campaigns":               "/app/campagnes",
		"/admin/campaigns/12":            "/app/campagnes/12",
		"/admin/campaigns/12/content":    "/app/campagnes/12",
		"/admin/campaigns/new":           "/app/campagnes/nouvelle",
		"/admin/campaigns/media":         "/app/medias",
		"/admin/subscribers/7?x=1":       "/app/audience/7",
		"/admin/subscribers/lists/3":     "/app/audience?liste=3",
		"/admin/subscribers/bounces":     "/app/rebonds",
		"/admin/users/roles/lists":       "/app/equipe?onglet=roles",
		"/admin/user/profile":            "/app/compte",
		"/admin/settings/logs":           "/app/maintenance",
		"/admin/settings":                "/app/reglages",
		"/admin/lists/forms":             "/app/formulaire",
		"/admin/something/never/written": "/app",
	} {
		if got := ForAdmin(in); got != want {
			t.Errorf("ForAdmin(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestIsLegacyAdmin(t *testing.T) {
	for in, want := range map[string]bool{
		"/admin":             true,
		"/admin/campaigns":   true,
		"/admin/login":       false,
		"/admin/login/twofa": false,
		"/admin/forgot":      false,
		"/admin/reset?t=1":   false,
		"/administration":    false,
		"/app/campagnes":     false,
		"/admin/custom.css":  false,
	} {
		if got := IsLegacyAdmin(in); got != want {
			t.Errorf("IsLegacyAdmin(%q) = %v, want %v", in, got, want)
		}
	}
}
