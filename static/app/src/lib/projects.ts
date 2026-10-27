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
