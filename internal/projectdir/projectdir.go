// Package projectdir keeps the projects in memory for the public pages, which
// resolve the project from the request's host, and for the links in e-mails,
// which point at the project's own domain (YZN-214, lot 5).
package projectdir

import (
	"net"
	"net/url"
	"strings"
	"sync"

	"github.com/knadh/listmonk/internal/manager"
	"github.com/knadh/listmonk/models"
)

// Dir is an in-memory directory of projects.
type Dir struct {
	mu sync.RWMutex

	rootURL  string
	rootPath string
	scheme   string
	port     string

	byID   map[int]models.Project
	byHost map[string]int
	bySlug map[string]int
}

// New returns a directory for an instance served at rootURL, whose path
// component is rootPath ("/" when served at the root).
func New(rootURL, rootPath string) *Dir {
	// A project's domain is served by the same server: same scheme and port.
	scheme, port := "https", ""
	if p, err := url.Parse(rootURL); err == nil && p.Scheme != "" {
		scheme, port = p.Scheme, p.Port()
	}

	return &Dir{rootURL: rootURL, rootPath: rootPath, scheme: scheme, port: port,
		byID: map[int]models.Project{}, byHost: map[string]int{}, bySlug: map[string]int{}}
}

// Set replaces the projects.
func (d *Dir) Set(projects []models.Project) {
	byID := make(map[int]models.Project, len(projects))
	byHost := map[string]int{}
	bySlug := make(map[string]int, len(projects))
	for _, p := range projects {
		byID[p.ID] = p
		bySlug[p.Slug] = p.ID
		if p.Domain.Valid && p.Domain.String != "" {
			byHost[strings.ToLower(p.Domain.String)] = p.ID
		}
	}

	d.mu.Lock()
	d.byID, d.byHost, d.bySlug = byID, byHost, bySlug
	d.mu.Unlock()
}

// Get returns a project by ID.
func (d *Dir) Get(id int) (models.Project, bool) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	p, ok := d.byID[id]
	return p, ok
}

// FromHost returns the project whose domain is the given Host header, if any.
func (d *Dir) FromHost(host string) (int, bool) {
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	host = strings.ToLower(strings.TrimSuffix(host, "."))

	d.mu.RLock()
	defer d.mu.RUnlock()

	id, ok := d.byHost[host]
	return id, ok
}

// FromSlug returns a project ID by slug.
func (d *Dir) FromSlug(slug string) (int, bool) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	id, ok := d.bySlug[strings.ToLower(slug)]
	return id, ok
}

// RootURL is the root of a project's public pages: its own domain if it has
// one, otherwise the instance's root URL.
func (d *Dir) RootURL(id int) string {
	p, ok := d.Get(id)
	if !ok || !p.Domain.Valid || p.Domain.String == "" {
		return d.rootURL
	}

	host := strings.ToLower(p.Domain.String)
	if d.port != "" {
		host = net.JoinHostPort(host, d.port)
	}

	return d.scheme + "://" + host + strings.TrimSuffix(d.rootPath, "/")
}

// ArchiveIndexURL is the URL of a project's public archive. Projects without
// a domain share the instance's archive page, filtered with ?project=.
func (d *Dir) ArchiveIndexURL(id int) string {
	base := d.RootURL(id) + "/archive"
	if p, ok := d.Get(id); ok && id != models.DefaultProjectID && (!p.Domain.Valid || p.Domain.String == "") {
		return base + "?project=" + url.QueryEscape(p.Slug)
	}

	return base
}

// ArchiveCampaignURL is the public URL of an archived campaign (by slug or UUID).
func (d *Dir) ArchiveCampaignURL(c models.Campaign) string {
	id := c.UUID
	if c.ArchiveSlug.Valid && c.ArchiveSlug.String != "" {
		id = c.ArchiveSlug.String
	}

	out, _ := url.JoinPath(d.RootURL(c.ProjectID)+"/archive", id)
	return out
}

// Rebase moves a URL built on the instance's root URL onto a project's root.
func (d *Dir) Rebase(id int, u string) string {
	if !strings.HasPrefix(u, d.rootURL) {
		return u
	}

	return d.RootURL(id) + strings.TrimPrefix(u, d.rootURL)
}

// ManagerURLs lists the public URLs of every project for the campaign manager.
func (d *Dir) ManagerURLs() map[int]manager.ProjectURLs {
	d.mu.RLock()
	ids := make([]int, 0, len(d.byID))
	for id := range d.byID {
		ids = append(ids, id)
	}
	d.mu.RUnlock()

	out := make(map[int]manager.ProjectURLs, len(ids))
	for _, id := range ids {
		out[id] = manager.ProjectURLs{Root: d.RootURL(id), Archive: d.ArchiveIndexURL(id)}
	}

	return out
}
