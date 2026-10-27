// Thin fetch wrapper around the listmonk JSON API.

export const PROJECT_HEADER = 'X-Listmonk-Project';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let currentProject: number | null = null;

export const PROJECT_COOKIE = 'relais_project';

// The project every request is scoped to. Sent as a header on each call, and
// kept in a cookie so that the legacy admin pages open on the same project.
export function setCurrentProject(id: number | null) {
  currentProject = id;
  if (typeof document === 'undefined') return;
  document.cookie = id === null
    ? `${PROJECT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
    : `${PROJECT_COOKIE}=${id}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function loginURL(next: string) {
  return `/admin/login?next=${encodeURIComponent(next)}`;
}

// An expired or missing session comes back as 403 "invalid session".
export function isSessionError(status: number, message: string) {
  return status === 401 || (status === 403 && /session/i.test(message));
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (currentProject !== null) headers.set(PROJECT_HEADER, String(currentProject));

  let body = init.body;
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(init.json);
  }

  const res = await fetch(path, { ...init, headers, body, credentials: 'same-origin' });
  const text = await res.text();
  let data: { data?: T; message?: string } = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(res.status, `Réponse inattendue du serveur (${res.status}).`);
  }

  if (!res.ok) {
    const message = data.message || `Erreur ${res.status}`;
    if (isSessionError(res.status, message)) {
      window.location.assign(loginURL(window.location.pathname + window.location.search));
    }
    throw new ApiError(res.status, message);
  }

  return data.data as T;
}

// Like api(), for endpoints that answer with HTML (template and campaign previews).
export async function apiHTML(path: string, form: Record<string, string>): Promise<string> {
  const headers = new Headers({ 'Content-Type': 'application/x-www-form-urlencoded' });
  if (currentProject !== null) headers.set(PROJECT_HEADER, String(currentProject));
  const res = await fetch(path, { method: 'POST', headers, body: new URLSearchParams(form), credentials: 'same-origin' });
  const text = await res.text();
  if (!res.ok) {
    let message = `Erreur ${res.status}`;
    try { message = JSON.parse(text).message || message; } catch { /* HTML error */ }
    throw new ApiError(res.status, message);
  }
  return text;
}

export function query(params: Record<string, string | number | boolean | undefined | (string | number)[]>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    if (Array.isArray(v)) v.forEach((x) => q.append(k, String(x)));
    else q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}
