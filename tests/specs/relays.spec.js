import { test, expect } from '@playwright/test';
import { clearMail, getMail, resetDB } from '../helpers.js';

// Sending relays: SMTP per project, cadence, warm-up and the system relay (YZN-214, lot 4).
const HEADER = 'X-Listmonk-Project';
const MAILHOG = { host: process.env.MAILHOG_SMTP_HOST || 'localhost', port: Number(process.env.MAILHOG_SMTP_PORT || 1025) };

async function api(page, method, url, { project, body } = {}) {
  const headers = project ? { [HEADER]: String(project) } : {};
  const res = await page.request.fetch(url, { method, headers, data: body });
  const json = await res.json().catch(() => ({}));
  return { status: res.status(), data: json.data, message: json.message };
}

// Settings and relay changes reload the app: wait until it answers again.
async function waitForReload(page) {
  await page.waitForTimeout(800);
  await expect.poll(async () => (await page.request.get('/api/health').catch(() => null))?.status() ?? 0, { timeout: 15000 }).toBe(200);
}

function smtp(name) {
  return {
    name, enabled: true, exclude_from_default: false, host: MAILHOG.host, port: MAILHOG.port, auth_protocol: 'none',
    username: '', password: '', hello_hostname: '', max_conns: 5, idle_timeout: '15s', wait_timeout: '5s',
    max_msg_retries: 2, msg_retry_delay: '10ms', tls_type: 'none', tls_skip_verify: false, email_headers: [], from_addresses: [],
  };
}

test.describe.configure({ mode: 'serial' });

test.describe('Relays', () => {
  let sport;
  let sportRelay;

  test.beforeAll(async ({ browser }) => {
    await resetDB(browser);
  });

  test('sets up a shared relay and a relay reserved to a project', async ({ page }) => {
    const settings = (await api(page, 'GET', '/api/settings')).data;
    settings.smtp = [smtp('partage'), smtp('sport')];
    expect((await api(page, 'PUT', '/api/settings', { body: settings })).status).toBe(200);
    await waitForReload(page);

    sport = (await api(page, 'POST', '/api/projects', { body: { name: 'Sport', slug: 'sport' } })).data.id;
    const relays = (await api(page, 'GET', '/api/relays')).data;
    sportRelay = relays.find((r) => r.name === 'email-sport');
    expect(sportRelay).toBeTruthy();

    const res = await api(page, 'PUT', `/api/relays/${sportRelay.uuid}`, {
      body: { project_id: sport, cadence: { per_minute: 0, per_hour: 0, per_day: 2, days: [], from_hour: 0, to_hour: 0, timezone: 'Europe/Paris' }, warmup: { enabled: false }, system: false },
    });
    expect(res.status).toBe(200);
    await waitForReload(page);
  });

  test('offers a project relay to its project only', async ({ page }) => {
    const def = await api(page, 'GET', '/api/config');
    expect(def.data.messengers).not.toContain('email-sport');
    const inSport = await api(page, 'GET', '/api/config', { project: sport });
    expect(inSport.data.messengers).toEqual(expect.arrayContaining(['email', 'email-partage', 'email-sport']));

    // The default pool only holds shared servers.
    const relays = (await api(page, 'GET', '/api/relays', { project: sport })).data;
    expect(relays.find((r) => r.pool).servers).toBe(1);
    expect(relays.find((r) => r.name === 'email-sport').in_default_pool).toBe(false);

    const cross = await api(page, 'POST', '/api/campaigns', {
      body: { name: 'x', subject: 'x', lists: [1], content_type: 'richtext', body: '<p>x</p>', messenger: 'email-sport' },
    });
    expect(cross.status).toBe(400);
    expect(cross.message).toContain('email-sport');
  });

  test('rejects invalid cadences and system relays', async ({ page }) => {
    const bad = await api(page, 'PUT', `/api/relays/${sportRelay.uuid}`, {
      body: { project_id: sport, cadence: { from_hour: 18, to_hour: 8 }, warmup: { enabled: false } },
    });
    expect(bad.status).toBe(400);

    const badWarmup = await api(page, 'PUT', `/api/relays/${sportRelay.uuid}`, {
      body: { project_id: sport, cadence: {}, warmup: { enabled: true, start: 50, growth: 10, cap: 20, since: '2026-01-01' } },
    });
    expect(badWarmup.status).toBe(400);

    // The system relay must be shared by every project.
    const sys = await api(page, 'PUT', `/api/relays/${sportRelay.uuid}`, {
      body: { project_id: sport, cadence: {}, warmup: { enabled: false }, system: true },
    });
    expect(sys.status).toBe(400);
  });

  test('edits a relay cadence from the relays screen', async ({ page, context }) => {
    await context.addCookies([{ name: 'relais_project', value: String(sport), url: test.info().project.use.baseURL }]);
    await page.addInitScript((id) => { try { localStorage.setItem('relais.project', String(id)); } catch { /* none */ } }, sport);

    await page.goto('/app/relais');
    await page.getByRole('button', { name: /sport/ }).click();
    await expect(page.locator('.relay-detail h2')).toHaveText('sport');
    await expect(page.getByLabel('Par jour')).toHaveValue('2');

    await page.getByLabel('Par minute').fill('30');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByRole('status')).toContainText('Enregistré');
    await waitForReload(page);

    const relay = (await api(page, 'GET', '/api/relays', { project: sport })).data.find((r) => r.name === 'email-sport');
    expect(relay.cadence.per_minute).toBe(30);
    expect(relay.cadence.per_day).toBe(2);
    expect(relay.project_id).toBe(sport);
  });

  test('stops a campaign at its relay daily quota without blocking the others', async ({ page }) => {
    await clearMail();
    const list = (await api(page, 'POST', '/api/lists', { project: sport, body: { name: 'Clubs', type: 'private' } })).data;
    for (let i = 1; i <= 3; i += 1) {
      await api(page, 'POST', '/api/subscribers', {
        project: sport, body: { email: `club${i}@example.com`, name: `Club ${i}`, lists: [list.id], status: 'enabled', preconfirm_subscriptions: true },
      });
    }
    const camp = (await api(page, 'POST', '/api/campaigns', {
      project: sport,
      body: { name: 'Quota', subject: 'Quota sport', lists: [list.id], content_type: 'richtext', body: '<p>Bonjour</p>', messenger: 'email-sport' },
    })).data;
    const free = (await api(page, 'POST', '/api/campaigns', {
      body: { name: 'Libre', subject: 'Relais libre', lists: [1], content_type: 'richtext', body: '<p>Bonjour</p>', messenger: 'email-partage' },
    })).data;

    await api(page, 'PUT', `/api/campaigns/${camp.id}/status`, { project: sport, body: { status: 'running' } });
    await api(page, 'PUT', `/api/campaigns/${free.id}/status`, { body: { status: 'running' } });

    const count = async (subject) => (await getMail()).filter((m) => m.Content.Headers.Subject?.[0] === subject).length;
    await expect.poll(() => count('Quota sport'), { timeout: 20000 }).toBe(2);
    await expect.poll(() => count('Relais libre'), { timeout: 20000 }).toBe(1);

    // The third message waits for tomorrow: the campaign keeps running.
    await page.waitForTimeout(6000);
    expect(await count('Quota sport')).toBe(2);
    const c = (await api(page, 'GET', `/api/campaigns/${camp.id}`, { project: sport })).data;
    expect(c.status).toBe('running');

    const relay = (await api(page, 'GET', '/api/relays', { project: sport })).data.find((r) => r.name === 'email-sport');
    expect(relay.status.sent_today).toBe(2);
    expect(relay.status.limit_today).toBe(2);
    expect(new Date(relay.status.next_send_at).getTime()).toBeGreaterThan(Date.now());

    // Changing a relay while the campaign only waits reloads the app at once,
    // without losing or repeating any send.
    const change = await api(page, 'PUT', `/api/relays/${sportRelay.uuid}`, {
      body: { project_id: sport, cadence: { per_minute: 30, per_hour: 100, per_day: 2, days: [], from_hour: 0, to_hour: 0, timezone: 'Europe/Paris' }, warmup: { enabled: false }, system: false },
    });
    expect(change.status).toBe(200);
    expect(change.data).toBe(true);
    await waitForReload(page);
    await page.waitForTimeout(7000);
    expect(await count('Quota sport')).toBe(2);
    const after = (await api(page, 'GET', `/api/campaigns/${camp.id}`, { project: sport })).data;
    expect(after.status).toBe('running');
    expect(after.sent).toBe(2);

    // Pause it so that it doesn't send tomorrow if the suite runs past midnight.
    await api(page, 'PUT', `/api/campaigns/${camp.id}/status`, { project: sport, body: { status: 'paused' } });
  });

  test('shows the relays quotas on the home screen and estimates the end of a campaign', async ({ page, context }) => {
    await context.addCookies([{ name: 'relais_project', value: String(sport), url: test.info().project.use.baseURL }]);
    await page.addInitScript((id) => { try { localStorage.setItem('relais.project', String(id)); } catch { /* none */ } }, sport);

    await page.goto('/app');
    const panel = page.locator('.panel').filter({ hasText: 'Envois du jour, par relais' });
    await expect(panel.locator('.relay-today-item').filter({ hasText: 'sport' })).toContainText('Quota atteint');

    await page.goto('/app/campagnes/nouvelle');
    await page.getByText('Clubs', { exact: true }).click();
    await page.getByRole('button', { name: 'Continuer' }).click();
    await page.getByRole('button', { name: 'Continuer' }).click();
    await page.getByLabel('sport').check();
    await expect(page.locator('.estimate')).toContainText('Fin ');
    await expect(page.locator('.estimate')).toContainText('2 / jour');
  });

  test('sends system notifications through the chosen shared relay', async ({ page }) => {
    const partage = (await api(page, 'GET', '/api/relays')).data.find((r) => r.name === 'email-partage');
    const res = await api(page, 'PUT', `/api/relays/${partage.uuid}`, { body: { project_id: 0, cadence: {}, warmup: { enabled: false }, system: true } });
    expect(res.status).toBe(200);
    await waitForReload(page);

    const relays = (await api(page, 'GET', '/api/relays')).data;
    expect(relays.find((r) => r.name === 'email-partage').system).toBe(true);
    expect(relays.find((r) => r.pool).system).toBe(false);
  });

  test('fills a relay from a provider preset and explains the settings', async ({ page, context }) => {
    await context.addCookies([{ name: 'relais_project', value: String(sport), url: test.info().project.use.baseURL }]);
    await page.addInitScript((id) => { try { localStorage.setItem('relais.project', String(id)); } catch { /* none */ } }, sport);

    await page.goto('/app/relais');
    await page.getByRole('button', { name: /sport/ }).click();
    await page.getByLabel('Partir d’une préconfiguration').selectOption({ label: 'OVHcloud (MX Plan, Email Pro)' });
    await expect(page.locator('.preset-card')).toContainText('200 e-mails par heure');
    await page.getByRole('button', { name: 'Appliquer' }).click();
    await expect(page.getByLabel('Par heure')).toHaveValue('180');
    await expect(page.getByLabel('Par minute')).toHaveValue('3');
    await expect(page.getByLabel('Par jour')).toHaveValue('0');

    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Enregistré' })).toBeVisible();
    await waitForReload(page);
    const relay = (await api(page, 'GET', '/api/relays', { project: sport })).data.find((r) => r.name === 'email-sport');
    expect(relay.cadence).toMatchObject({ per_minute: 3, per_hour: 180, per_day: 0 });
    expect(relay.warmup.enabled).toBe(false);

    // The relay now reads as following the preset, and every setting has its explanation.
    await page.reload();
    await page.getByRole('button', { name: /sport/ }).click();
    await expect(page.getByText('Réglages actuels : « OVHcloud (MX Plan, Email Pro) »')).toBeVisible();
    await page.getByText('C’est quoi, le warm-up ? En ai-je besoin ?').click();
    await page.getByRole('link', { name: 'Lire la suite dans le guide' }).last().click();
    await expect(page).toHaveURL(/\/app\/guide#warmup$/);
    await expect(page.getByRole('heading', { name: 'Le warm-up' })).toBeInViewport();
    await expect(page.locator('#warmup .ladder li').first()).toContainText('50');
  });
});
