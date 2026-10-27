import { test, expect, request } from '@playwright/test';
import { resetDB } from '../helpers.js';

// Projects (workspaces): nothing of one project may be seen or changed from another.
// These tests go through the JSON API with the admin session and the project header.

const HEADER = 'X-Listmonk-Project';

// API call helper: returns { status, data, message }.
async function api(page, method, url, { project, body } = {}) {
  const headers = project ? { [HEADER]: String(project) } : {};
  const res = await page.request.fetch(url, { method, headers, data: body });
  const json = await res.json().catch(() => ({}));
  return { status: res.status(), data: json.data, message: json.message };
}

test.describe.configure({ mode: 'serial' });

test.describe('Projects', () => {
  let projectB;
  let listB;
  let publicListB;
  let subB;
  let defaultLists;

  test.beforeAll(async ({ browser }) => {
    await resetDB(browser);
  });

  test('creates a second project with its own default template', async ({ page }) => {
    const res = await api(page, 'POST', '/api/projects', { body: { name: 'Sport', slug: 'sport' } });
    expect(res.status).toBe(200);
    projectB = res.data.id;

    const tpls = await api(page, 'GET', '/api/templates', { project: projectB });
    expect(tpls.data).toHaveLength(1);
    expect(tpls.data[0].is_default).toBe(true);
    expect(tpls.data[0].project_id).toBe(projectB);

    const defTpls = await api(page, 'GET', '/api/templates');
    expect(defTpls.data.length).toBeGreaterThan(1);
    expect(defTpls.data.every((t) => t.project_id === 1)).toBe(true);
  });

  test('accepts the project by slug and rejects unknown projects', async ({ page }) => {
    expect((await api(page, 'GET', '/api/lists', { project: 'sport' })).status).toBe(200);
    expect((await api(page, 'GET', '/api/lists', { project: 'nope' })).status).toBe(400);
  });

  test('keeps lists apart', async ({ page }) => {
    listB = (await api(page, 'POST', '/api/lists', { project: projectB, body: { name: 'Clubs B', type: 'private' } })).data;
    publicListB = (await api(page, 'POST', '/api/lists', { project: projectB, body: { name: 'Newsletter B', type: 'public', optin: 'single' } })).data;
    expect(listB.project_id).toBe(projectB);

    const inB = await api(page, 'GET', '/api/lists?per_page=all', { project: projectB });
    expect(inB.data.results.map((l) => l.name).sort()).toEqual(['Clubs B', 'Newsletter B']);

    const inDefault = await api(page, 'GET', '/api/lists?per_page=all');
    defaultLists = inDefault.data.results;
    expect(defaultLists.map((l) => l.name)).not.toContain('Clubs B');

    // A list of another project is not found, for reads and writes alike.
    expect((await api(page, 'GET', `/api/lists/${listB.id}`)).status).toBe(400);
    expect((await api(page, 'PUT', `/api/lists/${listB.id}`, { body: { name: 'Hijacked' } })).status).toBe(400);
    expect((await api(page, 'DELETE', `/api/lists/${listB.id}`)).status).toBe(400);
    expect((await api(page, 'GET', `/api/lists/${listB.id}`, { project: projectB })).data.name).toBe('Clubs B');
  });

  test('lets the same e-mail exist in two projects, each with its own data', async ({ page }) => {
    const res = await api(page, 'POST', '/api/subscribers', {
      project: projectB,
      body: { email: 'john@example.com', name: 'John B', lists: [listB.id], status: 'enabled' },
    });
    expect(res.status).toBe(200);
    subB = res.data;
    expect(subB.project_id).toBe(projectB);

    // Default project's John is untouched.
    const john = await api(page, 'GET', '/api/subscribers?search=john@example.com');
    expect(john.data.results).toHaveLength(1);
    expect(john.data.results[0].name).toBe('John Doe');

    // Project B only sees its own subscriber.
    const inB = await api(page, 'GET', '/api/subscribers', { project: projectB });
    expect(inB.data.results.map((s) => s.name)).toEqual(['John B']);

    // The same e-mail can't be added twice to one project.
    const dup = await api(page, 'POST', '/api/subscribers', { project: projectB, body: { email: 'JOHN@example.com', name: 'Dup', status: 'enabled' } });
    expect(dup.status).toBe(409);
  });

  test('scopes advanced SQL searches to the current project', async ({ page }) => {
    const q = encodeURIComponent("subscribers.email LIKE '%example.com'");
    const inB = await api(page, 'GET', `/api/subscribers?query=${q}`, { project: projectB });
    expect(inB.data.results.map((s) => s.name)).toEqual(['John B']);

    const inDefault = await api(page, 'GET', `/api/subscribers?query=${q}`);
    expect(inDefault.data.results.map((s) => s.name).sort()).toEqual(['Anon Doe', 'John Doe']);
  });

  test('refuses subscribers and lists of another project in bulk actions', async ({ page }) => {
    const johnDefault = (await api(page, 'GET', '/api/subscribers?search=john@example.com')).data.results[0];

    // Add a default-project subscriber to project B's list.
    const cross = await api(page, 'PUT', '/api/subscribers/lists', {
      body: { action: 'add', ids: [johnDefault.id], target_list_ids: [listB.id], status: 'confirmed' },
    });
    expect(cross.status).toBe(400);

    // Blocklist or delete project B's subscriber from the default project.
    expect((await api(page, 'PUT', '/api/subscribers/blocklist', { body: { ids: [subB.id] } })).status).toBe(400);
    expect((await api(page, 'GET', `/api/subscribers/${subB.id}`)).status).toBe(400);
    expect((await api(page, 'DELETE', `/api/subscribers/${subB.id}`)).status).toBe(400);

    // Bulk blocklist by query in project B touches only project B.
    const byQuery = await api(page, 'PUT', '/api/subscribers/query/blocklist', {
      project: projectB, body: { query: "subscribers.email = 'john@example.com'", list_ids: [] },
    });
    expect(byQuery.status).toBe(200);
    const after = (await api(page, 'GET', '/api/subscribers?search=john@example.com')).data.results[0];
    expect(after.status).toBe('enabled');
    expect((await api(page, 'GET', `/api/subscribers/${subB.id}`, { project: projectB })).data.status).toBe('blocklisted');
  });

  test('keeps campaigns, their lists and templates in one project', async ({ page }) => {
    const camp = { name: 'B campaign', subject: 'Hello', from_email: 'B <b@example.com>', content_type: 'richtext', body: '<p>Hi</p>', messenger: 'email' };

    // A default-project campaign can't use project B's list.
    const cross = await api(page, 'POST', '/api/campaigns', { body: { ...camp, lists: [listB.id] } });
    expect(cross.status).toBe(400);

    // A project B campaign can't use a default-project list.
    const cross2 = await api(page, 'POST', '/api/campaigns', { project: projectB, body: { ...camp, lists: [defaultLists[0].id] } });
    expect(cross2.status).toBe(400);

    const ok = await api(page, 'POST', '/api/campaigns', { project: projectB, body: { ...camp, lists: [listB.id] } });
    expect(ok.status).toBe(200);
    expect(ok.data.project_id).toBe(projectB);
    expect(ok.data.lists.map((l) => l.id)).toEqual([listB.id]);

    const inDefault = await api(page, 'GET', '/api/campaigns?per_page=all');
    expect(inDefault.data.results.map((c) => c.name)).not.toContain('B campaign');
    expect((await api(page, 'GET', `/api/campaigns/${ok.data.id}`)).status).toBe(400);
    expect((await api(page, 'PUT', `/api/campaigns/${ok.data.id}/status`, { body: { status: 'running' } })).status).toBe(400);

    const inB = await api(page, 'GET', '/api/campaigns?per_page=all', { project: projectB });
    expect(inB.data.results.map((c) => c.name)).toEqual(['B campaign']);
  });

  test('computes the dashboard per project', async ({ page }) => {
    const b = await api(page, 'GET', '/api/dashboard/counts', { project: projectB });
    expect(b.data.subscribers.total).toBe(1);
    expect(b.data.lists.total).toBe(2);
    expect(b.data.campaigns.total).toBe(1);

    const def = await api(page, 'GET', '/api/dashboard/counts');
    expect(def.data.subscribers.total).toBe(2);
  });

  test('subscribes public visitors in the project of the chosen lists', async ({ page }) => {
    const optin = defaultLists.find((l) => l.type === 'public');

    // Lists of two projects at once are refused.
    const mixed = await api(page, 'POST', '/api/public/subscription', {
      body: { email: 'visitor@example.com', name: 'Visitor', list_uuids: [optin.uuid, publicListB.uuid] },
    });
    expect(mixed.status).toBe(400);

    // An e-mail already known in the default project is created afresh in project B.
    const res = await api(page, 'POST', '/api/public/subscription', {
      body: { email: 'anon@example.com', name: 'Anon B', list_uuids: [publicListB.uuid] },
    });
    expect(res.status).toBe(200);

    const inB = await api(page, 'GET', '/api/subscribers?search=anon@example.com', { project: projectB });
    expect(inB.data.results.map((s) => s.name)).toEqual(['Anon B']);
    const inDefault = await api(page, 'GET', '/api/subscribers?search=anon@example.com');
    expect(inDefault.data.results.map((s) => s.name)).toEqual(['Anon Doe']);
  });

  test('only deletes empty projects', async ({ page }) => {
    expect((await api(page, 'DELETE', `/api/projects/${projectB}`)).status).toBe(400);
  });

  test('denies projects a user has no access to', async ({ page }) => {
    // An API user restricted to the default project.
    const role = await api(page, 'POST', '/api/roles/users', { body: { name: 'Lists reader', permissions: ['lists:get_all'] } });
    const user = await api(page, 'POST', '/api/users', {
      body: { username: 'reader', email: 'reader@example.com', name: 'Reader', type: 'api', user_role_id: role.data.id, status: 'enabled' },
    });
    expect(user.status).toBe(200);

    // A cookie-less client: with a session cookie, listmonk ignores API tokens.
    const client = await request.newContext({
      baseURL: test.info().project.use.baseURL,
      storageState: { cookies: [], origins: [] },
      extraHTTPHeaders: { Authorization: `token reader:${user.data.password}` },
    });
    expect((await client.get('/api/lists')).status()).toBe(200);
    expect((await client.get('/api/lists', { headers: { [HEADER]: String(projectB) } })).status()).toBe(403);
    expect((await client.get('/api/lists', { headers: { [HEADER]: 'sport' } })).status()).toBe(403);
    await client.dispose();
  });
});
