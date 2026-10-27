import { test, expect } from '@playwright/test';
import { clearMail, getMail, resetDB } from '../helpers.js';

// The campaign page of the Relais app (/app/campagnes/:id).
test.describe.configure({ mode: 'serial' });

test.describe('Relais campaign page', () => {
  let id;

  test.beforeAll(async ({ browser }) => {
    await resetDB(browser);
  });

  test('edits a draft written as text, with a live preview', async ({ page }) => {
    const c = (await (await page.request.post('/api/campaigns', {
      data: {
        name: 'Gazette', subject: 'Bonjour {{ .Subscriber.FirstName }}', lists: [1], content_type: 'richtext',
        body: '<p>Bonjour {{ .Subscriber.FirstName }},</p>\n<p>Voici la gazette.</p>', messenger: 'email',
      },
    })).json()).data;
    id = c.id;

    await page.goto(`/app/campagnes/${id}`);
    await expect(page.getByRole('heading', { name: /Gazette/ })).toBeVisible();
    await expect(page.getByLabel('Objet')).toHaveValue('Bonjour {prénom}');
    await expect(page.getByLabel('Message', { exact: true })).toHaveValue('Bonjour {prénom},\n\nVoici la gazette.');
    await expect(page.frameLocator('.tpl-preview iframe').locator('body')).toContainText('Voici la gazette', { timeout: 10000 });

    await page.getByLabel('Message', { exact: true }).fill('Bonjour {prénom},\n\nNouvelle édition.');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Enregistré' })).toBeVisible();
    const saved = (await (await page.request.get(`/api/campaigns/${id}`)).json()).data;
    expect(saved.body).toBe('<p>Bonjour {{ .Subscriber.FirstName }},</p>\n<p>Nouvelle édition.</p>');
  });

  test('sends a test to a contact of the project', async ({ page }) => {
    await clearMail();
    await page.goto(`/app/campagnes/${id}`);
    await page.getByLabel('Adresses de test').fill('john@example.com');
    await page.getByRole('button', { name: 'Envoyer le test' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Test envoyé' })).toBeVisible();
    await expect.poll(async () => (await getMail()).some((m) => m.Content.Headers.To?.[0]?.includes('john@example.com')), { timeout: 15000 }).toBe(true);
  });

  test('schedules, unschedules and launches the campaign', async ({ page }) => {
    await page.goto(`/app/campagnes/${id}`);
    await page.getByRole('button', { name: 'Programmer' }).click();
    await page.getByRole('button', { name: 'Confirmer la programmation' }).click();
    await expect(page.locator('h1')).toContainText('Planifiée');

    await page.getByRole('button', { name: 'Annuler la programmation' }).click();
    await expect(page.locator('h1')).toContainText('Brouillon');

    await clearMail();
    await page.getByRole('button', { name: 'Lancer maintenant' }).click();
    await expect(page.locator('h1')).toContainText(/En cours|Terminée/);
    await expect.poll(async () => (await (await page.request.get(`/api/campaigns/${id}`)).json()).data.status, { timeout: 30000 }).toBe('finished');
    await page.reload();
    await expect(page.locator('.kpis')).toContainText('Envoyés');
    await expect(page.getByLabel('Objet')).toHaveCount(0);
  });

  test('duplicates and deletes a campaign', async ({ page }) => {
    await page.goto(`/app/campagnes/${id}`);
    await page.getByRole('button', { name: 'Dupliquer' }).click();
    await expect(page.getByRole('heading', { name: /Copie de Gazette/ })).toBeVisible();
    await expect(page.locator('h1')).toContainText('Brouillon');

    await page.getByRole('button', { name: 'Supprimer la campagne…' }).click();
    await page.getByRole('button', { name: 'Supprimer définitivement' }).click();
    await expect(page).toHaveURL(/\/app\/campagnes$/);
    const all = (await (await page.request.get('/api/campaigns?per_page=all')).json()).data.results;
    expect(all.map((c) => c.name)).not.toContain('Copie de Gazette');
  });
});
