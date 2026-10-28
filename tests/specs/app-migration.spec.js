import { test, expect } from '@playwright/test';
import { resetDB } from '../helpers.js';

// "Importer depuis listmonk" (/app/migration). The instance under test is its
// own source: its default project is copied into another project.
test.describe.configure({ mode: 'serial' });

const data = async (r) => (await r.json()).data;

test.describe('Import from listmonk', () => {
  let user;
  let target;

  test.beforeAll(async ({ browser }) => {
    await resetDB(browser);
    const page = await browser.newPage();
    user = await data(await page.request.post('/api/users', { data: {
      username: 'migration', name: 'Migration', type: 'api', status: 'enabled', user_role_id: 1,
    } }));
    target = await data(await page.request.post('/api/projects', { data: { name: 'Copie', slug: 'copie', description: '' } }));
    // A draft campaign on the default list.
    await page.request.post('/api/campaigns', { data: {
      name: 'Gazette', subject: 'Bonjour', lists: [1], content_type: 'richtext', body: '<p>Bonjour</p>', messenger: 'email',
    } });
    // An unsubscription, which must come along.
    await page.request.put('/api/subscribers/lists', { data: { ids: [1], action: 'unsubscribe', target_list_ids: [1] } });
    await page.close();
  });

  test('reads the other instance and imports its lists, contacts and campaigns', async ({ page, baseURL }) => {
    await page.goto('/app/maintenance');
    await page.getByRole('link', { name: 'Ouvrir l’import' }).click();
    await page.getByLabel('Adresse de l’instance').fill(baseURL);
    await page.getByLabel('Utilisateur API', { exact: true }).fill(user.username);
    await page.getByLabel('Jeton de l’utilisateur API').fill(user.password);
    await page.getByRole('button', { name: 'Se connecter et lire le contenu' }).click();

    await expect(page.getByText(/2 contacts, \d+ listes/)).toBeVisible();
    await page.getByLabel('Default list').selectOption({ label: 'Copie' });
    await page.getByLabel('Opt-in list').selectOption({ label: 'Copie' });
    await page.getByRole('button', { name: /^Importer 2 listes/ }).click();

    const progress = page.getByRole('region', { name: 'Avancement de l’import' });
    await expect(progress).toContainText('Terminé', { timeout: 30000 });
    await expect(progress).toContainText('listes créées');
    await expect(progress).toContainText('contacts importés');
    await expect(progress).toContainText('campagnes créées en brouillon');

    const headers = { 'X-Listmonk-Project': String(target.id) };
    const lists = (await data(await page.request.get('/api/lists?per_page=all', { headers }))).results;
    expect(lists.map((l) => l.name).sort()).toEqual(['Default list', 'Opt-in list']);
    const subs = (await data(await page.request.get('/api/subscribers?per_page=all', { headers }))).results;
    expect(subs).toHaveLength(2);
    const defaultList = lists.find((l) => l.name === 'Default list');
    const john = subs.find((s) => s.lists.some((l) => l.id === defaultList.id && l.subscription_status === 'unsubscribed'));
    expect(john).toBeTruthy();
    const camps = (await data(await page.request.get('/api/campaigns?per_page=all', { headers }))).results;
    expect(camps.some((c) => c.name === 'Gazette' && c.status === 'draft')).toBe(true);
  });

  test('imports again without duplicating anything', async ({ page, baseURL }) => {
    const plan = {
      source: { url: baseURL, username: user.username, token: user.password },
      lists: [{ id: 1, project_id: target.id }, { id: 2, project_id: target.id }], templates: [], campaigns: true,
    };
    await page.request.post('/api/import/listmonk', { data: plan });
    await expect.poll(async () => (await data(await page.request.get('/api/import/listmonk'))).step, { timeout: 30000 }).toBe('Terminé');
    const run = await data(await page.request.get('/api/import/listmonk'));
    expect(run.counts.lists_existing).toBe(2);
    expect(run.counts.subscribers_existing).toBe(2);
    expect(run.counts.subscribers ?? 0).toBe(0);
    const headers = { 'X-Listmonk-Project': String(target.id) };
    expect((await data(await page.request.get('/api/subscribers?per_page=all', { headers }))).results).toHaveLength(2);
  });

  test('refuses a wrong token', async ({ page, baseURL }) => {
    const r = await page.request.post('/api/import/listmonk/check', { data: { url: baseURL, username: user.username, token: 'faux' } });
    expect(r.status()).toBe(502);
    expect((await r.json()).message).toContain('accès refusé');
  });
});
