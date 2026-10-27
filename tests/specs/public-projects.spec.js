import { test, expect } from '@playwright/test';
import { clearMail, getMail, resetDB } from '../helpers.js';

// Public pages per project (YZN-214, lot 5). Chromium resolves *.localhost to
// this machine, so a project's domain can be served by the test instance.
const HEADER = 'X-Listmonk-Project';
const PORT = new URL(process.env.LISTMONK_URL || 'http://localhost:9000').port || '9000';
const SPORT = 'sport.localhost';
const CULTURE = 'culture.localhost';
const on = (host, path) => `http://${host}:${PORT}${path}`;

async function api(page, method, url, { project, body } = {}) {
  const headers = project ? { [HEADER]: String(project) } : {};
  const res = await page.request.fetch(url, { method, headers, data: body });
  const json = await res.json().catch(() => ({}));
  return { status: res.status(), data: json.data, message: json.message };
}

// MailHog keeps the raw quoted-printable body.
const decodeQP = (s) => s.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

test.describe.configure({ mode: 'serial' });

test.describe('Public pages per project', () => {
  let sport;
  let sportList;
  let defaultList;
  let sportSub;
  let camp;

  test.beforeAll(async ({ browser }) => {
    await resetDB(browser);
  });

  test('sets up two projects with their own domain and public lists', async ({ page }) => {
    sport = (await api(page, 'POST', '/api/projects', { body: { name: 'Club Sport', slug: 'sport', domain: SPORT } })).data.id;
    expect((await api(page, 'POST', '/api/projects', { body: { name: 'Culture', slug: 'culture', domain: CULTURE } })).status).toBe(200);

    sportList = (await api(page, 'POST', '/api/lists', { project: sport, body: { name: 'Gazette du club', type: 'public', optin: 'single' } })).data;
    defaultList = (await api(page, 'POST', '/api/lists', { body: { name: 'Lettre principale', type: 'public', optin: 'single' } })).data;
    expect(sportList.uuid).toBeTruthy();
    expect(defaultList.uuid).toBeTruthy();
  });

  test('shows each domain its own project on the subscription form', async ({ page }) => {
    await page.goto(on(SPORT, '/subscription/form'));
    await expect(page.getByText('Gazette du club')).toBeVisible();
    await expect(page.getByText('Lettre principale')).toHaveCount(0);
    await expect(page).toHaveTitle(/Club Sport/);

    await page.goto('/subscription/form');
    await expect(page.getByText('Lettre principale')).toBeVisible();
    await expect(page.getByText('Gazette du club')).toHaveCount(0);

    // Without a domain, ?project= picks the project.
    const lists = await (await page.request.get('/api/public/lists?project=sport')).json();
    expect(lists.map((l) => l.name)).toEqual(['Gazette du club']);
  });

  test('subscribes into the project of the domain only', async ({ page }) => {
    // Another project's list can't be joined from a project's domain.
    const cross = await page.request.post(on(SPORT, '/api/public/subscription'), {
      data: { name: 'Intrus', email: 'intrus@example.com', list_uuids: [defaultList.uuid] },
    });
    expect(cross.status()).toBe(400);

    // The form's public lists are ticked by default.
    await page.goto(on(SPORT, '/subscription/form'));
    await expect(page.locator('ul.lists input[type=checkbox]')).toHaveCount(1);
    await page.locator('input[name=email]').fill('lea@example.com');
    await page.locator('input[name=name]').fill('Léa');
    await Promise.all([page.waitForLoadState(), page.locator('button[type=submit]').click()]);
    await expect(page.locator('body')).toContainText(/has been sent|successfully|retry/i);
    expect(new URL(page.url()).hostname).toBe(SPORT);

    const subs = (await api(page, 'GET', '/api/subscribers?query=' + encodeURIComponent("subscribers.email = 'lea@example.com'"), { project: sport })).data.results;
    expect(subs).toHaveLength(1);
    sportSub = subs[0];
    expect(sportSub.lists.map((l) => l.name)).toEqual(['Gazette du club']);

    // Same address in the default project, on its main list.
    const res = await api(page, 'POST', '/api/subscribers', {
      body: { email: 'lea@example.com', name: 'Léa', lists: [defaultList.id], status: 'enabled', preconfirm_subscriptions: true },
    });
    expect(res.status).toBe(200);
  });

  test('puts the project domain in the links of its e-mails', async ({ page }) => {
    await clearMail();
    camp = (await api(page, 'POST', '/api/campaigns', {
      project: sport,
      body: {
        name: 'Gazette n°1', subject: 'Gazette 1', lists: [sportList.id], content_type: 'html',
        body: '<p>Bonjour</p><a href="{{ UnsubscribeURL }}">Se désinscrire</a> <a href="{{ MessageURL }}">En ligne</a>',
        archive: true, archive_slug: 'gazette-1',
      },
    })).data;
    expect((await api(page, 'PUT', `/api/campaigns/${camp.id}/status`, { project: sport, body: { status: 'running' } })).status).toBe(200);

    let mail;
    await expect.poll(async () => {
      mail = (await getMail()).find((m) => m.Content.Headers.Subject?.[0] === 'Gazette 1');
      return Boolean(mail);
    }, { timeout: 20000 }).toBe(true);

    const body = decodeQP(mail.Content.Body);
    const unsub = on(SPORT, `/subscription/${camp.uuid}/${sportSub.uuid}`);
    expect(body).toContain(unsub);
    expect(body).toContain(on(SPORT, `/campaign/${camp.uuid}/${sportSub.uuid}`));
    expect(body).not.toContain(`localhost:${PORT}/subscription/`.replace(/^/, 'http://'));
    expect(mail.Content.Headers['List-Unsubscribe']?.[0]).toBe(`<${unsub}>`);
  });

  test('serves a subscriber only on the domain of its project', async ({ page }) => {
    const path = `/subscription/${camp.uuid}/${sportSub.uuid}`;
    await page.goto(on(SPORT, path));
    await expect(page).toHaveTitle(/Club Sport/);

    const other = await page.goto(on(CULTURE, path));
    expect(other.status()).toBe(404);
  });

  test('unsubscribes from the project only', async ({ page }) => {
    const res = await page.request.post(on(SPORT, `/subscription/${camp.uuid}/${sportSub.uuid}`), { form: { unsubscribe: 'true' } });
    expect(res.status()).toBe(200);

    const inSport = (await api(page, 'GET', `/api/subscribers/${sportSub.id}`, { project: sport })).data;
    expect(inSport.lists[0].subscription_status).toBe('unsubscribed');

    const inDefault = (await api(page, 'GET', '/api/subscribers?query=' + encodeURIComponent("subscribers.email = 'lea@example.com'"))).data.results;
    expect(inDefault).toHaveLength(1);
    expect(inDefault[0].lists[0].subscription_status).toBe('confirmed');
  });

  test('keeps each project archive on its own domain', async ({ page }) => {
    await page.goto(on(SPORT, '/archive'));
    await expect(page.getByText('Gazette 1', { exact: true })).toBeVisible();

    await page.goto('/archive');
    await expect(page.getByText('Gazette 1', { exact: true })).toHaveCount(0);
    await page.goto('/archive?project=sport');
    await expect(page.getByText('Gazette 1', { exact: true })).toBeVisible();

    expect((await page.goto(on(SPORT, '/archive/gazette-1'))).status()).toBe(200);
    expect((await page.goto(on(CULTURE, '/archive/gazette-1'))).status()).toBe(404);

    const feed = await (await page.request.get(on(SPORT, '/archive.xml'))).text();
    expect(feed).toContain(on(SPORT, '/archive/gazette-1'));
    expect(feed).toContain('<title>Club Sport</title>');
  });

  test('shows the public addresses on the project screen', async ({ page }) => {
    await page.goto(`/app/projets/${sport}`);
    const panel = page.locator('.public-pages');
    await expect(panel).toContainText(SPORT);
    await expect(panel.getByRole('link', { name: on(SPORT, '/subscription/form') })).toBeVisible();
    await panel.getByText('Brancher le domaine, étape par étape').click();
    await expect(panel).toContainText('CNAME');
  });
});
