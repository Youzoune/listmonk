package projectdir

import (
	"testing"

	"github.com/knadh/listmonk/models"
	null "gopkg.in/volatiletech/null.v6"
)

var testProjects = []models.Project{
	{Base: models.Base{ID: 1}, Name: "Default", Slug: "default"},
	{Base: models.Base{ID: 2}, Name: "Sport", Slug: "sport", Domain: null.StringFrom("News.Sport.fr")},
	{Base: models.Base{ID: 3}, Name: "Culture", Slug: "culture"},
}

func testDir() *Dir {
	d := New("https://lists.example.org", "/")
	d.Set(testProjects)
	return d
}

func TestProjectDirHosts(t *testing.T) {
	d := testDir()
	for host, want := range map[string]int{"news.sport.fr": 2, "NEWS.Sport.fr:443": 2, "news.sport.fr.": 2, "lists.example.org": 0, "[::1]:9000": 0} {
		id, _ := d.FromHost(host)
		if id != want {
			t.Errorf("fromHost(%q) = %d, want %d", host, id, want)
		}
	}
}

func TestProjectDirURLs(t *testing.T) {
	d := testDir()

	cases := []struct{ got, want string }{
		{d.RootURL(1), "https://lists.example.org"},
		{d.RootURL(2), "https://news.sport.fr"},
		{d.RootURL(3), "https://lists.example.org"},
		{d.RootURL(99), "https://lists.example.org"},
		{d.ArchiveIndexURL(1), "https://lists.example.org/archive"},
		{d.ArchiveIndexURL(2), "https://news.sport.fr/archive"},
		{d.ArchiveIndexURL(3), "https://lists.example.org/archive?project=culture"},
		{d.Rebase(2, "https://lists.example.org/subscription/a/b"), "https://news.sport.fr/subscription/a/b"},
		{d.Rebase(3, "https://lists.example.org/subscription/a/b"), "https://lists.example.org/subscription/a/b"},
		{d.Rebase(2, "https://elsewhere.org/x"), "https://elsewhere.org/x"},
		{d.ArchiveCampaignURL(models.Campaign{UUID: "u-1", ProjectID: 2}), "https://news.sport.fr/archive/u-1"},
		{d.ArchiveCampaignURL(models.Campaign{UUID: "u-1", ProjectID: 1, ArchiveSlug: null.StringFrom("octobre")}), "https://lists.example.org/archive/octobre"},
	}
	for i, c := range cases {
		if c.got != c.want {
			t.Errorf("case %d: got %q, want %q", i, c.got, c.want)
		}
	}

	urls := d.ManagerURLs()
	if urls[2].Root != "https://news.sport.fr" || urls[3].Archive != "https://lists.example.org/archive?project=culture" {
		t.Errorf("unexpected manager URLs: %+v", urls)
	}
}

func TestProjectDirPort(t *testing.T) {
	d := New("http://localhost:9000", "/")
	d.Set(testProjects)
	if got := d.RootURL(2); got != "http://news.sport.fr:9000" {
		t.Errorf("rootURL with a port = %q", got)
	}
	if id, _ := d.FromHost("news.sport.fr:9000"); id != 2 {
		t.Errorf("FromHost with a port = %d", id)
	}
}

func TestProjectDirSubPath(t *testing.T) {
	d := New("http://example.org/listmonk", "/listmonk")
	d.Set(testProjects)
	if got := d.RootURL(2); got != "http://news.sport.fr/listmonk" {
		t.Errorf("rootURL with a sub-path = %q", got)
	}
}
