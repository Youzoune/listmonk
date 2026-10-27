package manager

import "testing"

func TestProjectURL(t *testing.T) {
	m := &Manager{cfg: Config{RootURL: "https://lists.example.org", ArchiveURL: "https://lists.example.org/archive"}}
	m.SetProjectURLs(map[int]ProjectURLs{
		1: {Root: "https://lists.example.org", Archive: "https://lists.example.org/archive"},
		2: {Root: "https://news.sport.fr", Archive: "https://news.sport.fr/archive"},
	})

	cases := []struct{ got, want string }{
		{m.projectURL(2, "https://lists.example.org/subscription/c/s"), "https://news.sport.fr/subscription/c/s"},
		{m.projectURL(1, "https://lists.example.org/subscription/c/s"), "https://lists.example.org/subscription/c/s"},
		{m.projectURL(9, "https://lists.example.org/link/l/c/s"), "https://lists.example.org/link/l/c/s"},
		{m.projectURL(2, "https://elsewhere.org/page"), "https://elsewhere.org/page"},
		{m.projectArchiveURL(2), "https://news.sport.fr/archive"},
		{m.projectArchiveURL(9), "https://lists.example.org/archive"},
	}
	for i, c := range cases {
		if c.got != c.want {
			t.Errorf("case %d: got %q, want %q", i, c.got, c.want)
		}
	}
}
