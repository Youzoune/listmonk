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
  // Host of the project's pages, "" when they're on the instance's address.
  host: string;
  kind: 'custom' | 'subdomain' | 'instance';
}

const DEFAULT_PROJECT_ID = 1;

// The automatic host of a project, <slug>.<base>, as the server gives it
// (internal/projectdir): none for the default project or without a base domain.
export function projectSubdomain(p: { id: number; slug: string }, base: string | undefined): string {
  const b = (base ?? '').trim().toLowerCase().replace(/^\.+|\.+$/g, '');
  if (!b || p.id === DEFAULT_PROJECT_ID || !p.slug || p.slug.length > 63) return '';
  return `${p.slug}.${b}`;
}

// The public addresses of a project: its custom domain, else its subdomain
// (same scheme, port and path as the instance), else the instance's address
// with ?project=<slug> (none for the default project).
export function publicURLs(p: { id: number; slug: string; domain: string | null }, rootURL: string, base?: string): PublicURLs {
  const root = rootURL.replace(/\/+$/, '');
  const custom = (p.domain ?? '').toLowerCase();
  const host = custom || projectSubdomain(p, base);
  if (host) {
    let r = `https://${host}`;
    try {
      const u = new URL(root);
      r = `${u.protocol}//${host}${u.port ? `:${u.port}` : ''}${u.pathname.replace(/\/+$/, '')}`;
    } catch { /* keep https */ }
    return { root: r, form: `${r}/subscription/form`, archive: `${r}/archive`, feed: `${r}/archive.xml`, host, kind: custom ? 'custom' : 'subdomain' };
  }

  const q = p.id === DEFAULT_PROJECT_ID ? '' : `?project=${encodeURIComponent(p.slug)}`;
  return { root, form: `${root}/subscription/form${q}`, archive: `${root}/archive${q}`, feed: `${root}/archive.xml${q}`, host: '', kind: 'instance' };
}

// The host the project's domain should point to (CNAME target).
export function rootHost(rootURL: string): string {
  try {
    return new URL(rootURL).hostname;
  } catch {
    return '';
  }
}

// A custom domain can't sit under the base domain: those subdomains are automatic.
export function isUnderBase(domain: string, base: string | undefined): boolean {
  const d = domain.trim().toLowerCase();
  const b = (base ?? '').trim().toLowerCase();
  return Boolean(b && d && (d === b || d.endsWith(`.${b}`)));
}
