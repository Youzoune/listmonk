// Project helpers. The rules mirror the server's validation (cmd/projects.go).

export const SLUG_MAX = 64;

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DOMAIN_RE = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

// "Clubs sportifs — Île-de-France" → "clubs-sportifs-ile-de-france".
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, '');
}

export function isValidSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= SLUG_MAX && SLUG_RE.test(slug);
}

// An empty domain is valid: the project then has no public domain yet.
export function isValidDomain(domain: string): boolean {
  const d = domain.trim().toLowerCase();
  return d === '' || (d.length <= 253 && DOMAIN_RE.test(d));
}

const SUPER_ADMIN_ROLE = 1;

// Users who see every project regardless of their project access list.
export function hasAllProjects(role: { id: number; permissions: string[] } | undefined): boolean {
  if (!role) return false;
  return role.id === SUPER_ADMIN_ROLE || role.permissions.includes('projects:manage');
}

// Returns ids with id added or removed.
export function toggleId(ids: number[], id: number, on: boolean): number[] {
  const rest = ids.filter((x) => x !== id);
  return on ? [...rest, id].sort((a, b) => a - b) : rest;
}

export interface PublicURLs {
  root: string;
  form: string;
  archive: string;
  feed: string;
  // The project has its own domain.
  ownDomain: boolean;
}

// The public addresses of a project, as the server builds them
// (internal/projectdir): its own domain (same scheme, port and path) if it has one, otherwise the
// instance's address with ?project=<slug> (none for the default project).
export function publicURLs(p: { id: number; slug: string; domain: string | null }, rootURL: string): PublicURLs {
  const root = rootURL.replace(/\/+$/, '');
  if (p.domain) {
    let base = `https://${p.domain.toLowerCase()}`;
    try {
      const u = new URL(root);
      base = `${u.protocol}//${p.domain.toLowerCase()}${u.port ? `:${u.port}` : ''}${u.pathname.replace(/\/+$/, '')}`;
    } catch { /* keep https */ }
    return { root: base, form: `${base}/subscription/form`, archive: `${base}/archive`, feed: `${base}/archive.xml`, ownDomain: true };
  }

  const q = p.id === 1 ? '' : `?project=${encodeURIComponent(p.slug)}`;
  return { root, form: `${root}/subscription/form${q}`, archive: `${root}/archive${q}`, feed: `${root}/archive.xml${q}`, ownDomain: false };
}

// The host the project's domain should point to (CNAME target).
export function rootHost(rootURL: string): string {
  try {
    return new URL(rootURL).hostname;
  } catch {
    return '';
  }
}
