import { test, expect } from '@playwright/test';
import { psql, resetDB } from '../helpers.js';

// Team (users and roles), media and bounces in the Relais app.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test.describe.configure({ mode: 'serial' });

test.describe('Relais team, media and bounces', () => {
  test.beforeAll(async ({ browser }) => {
    await resetDB(browser);
  });

  test('creates a role with plain-word permissions', async ({ page }) => {
    await page.goto('/app/equipe?onglet=roles');
    await page.getByRole('button', { name: 'Nouveau rôle' }).click();
    await page.getByLabel('Nom du rôle').fill('Rédaction');
    await page.getByLabel('Voir toutes les campagnes').check();
    await page.getByLabel('Gérer toutes les campagnes').check();
    await page.getByRole('button', { name: 'Créer le rôle' }).click();
    await expect(page.locator('tr').filter({ hasText: 'Rédaction' })).toContainText('2 permissions');
  });

  test('creates a user and an API access with its token', async ({ page }) => {
    await page.goto('/app/equipe');
    await page.getByRole('button', { name: 'Nouvel utilisateur' }).click();
    await page.getByLabel('Identifiant', { exact: true }).fill('camille');
    await page.getByLabel('Nom affiché').fill('Camille');
    await page.getByLabel('E-mail').fill('camille@exemple.fr');
    await page.getByLabel('Mot de passe', { exact: true }).fill('court');
    await page.getByLabel('Rôle', { exact: true }).selectOption({ label: 'Rédaction' });
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('.field-error').filter({ hasText: 'Au moins 8 caractères.' })).toBeVisible();
    await page.getByLabel('Mot de passe', { exact: true }).fill('motdepasse-solide');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('tr').filter({ hasText: 'Camille' })).toContainText('Rédaction');

    await page.getByRole('button', { name: 'Nouvel utilisateur' }).click();
    await page.getByLabel('Un accès API').check();
    await page.getByLabel('Identifiant', { exact: true }).fill('site-web');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.getByRole('heading', { name: 'Accès API créé' })).toBeVisible();
    await expect(page.locator('pre')).not.toBeEmpty();
    await page.getByRole('button', { name: 'J’ai copié le jeton' }).click();
    await expect(page.locator('tr').filter({ hasText: 'site-web' })).toContainText('Accès API');

    const row = page.locator('tr').filter({ hasText: 'site-web' });
    await row.getByRole('button', { name: 'Supprimer' }).click();
    await row.getByRole('button', { name: 'Supprimer' }).click();
    await expect(row).toHaveCount(0);
  });

  test('uploads, copies and deletes a media file', async ({ page }) => {
    await page.goto('/app/medias');
    await page.locator('#media-upload').setInputFiles({ name: 'logo-club.png', mimeType: 'image/png', buffer: PNG });
    const card = page.locator('.media-card').filter({ hasText: 'logo-club' });
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.getByRole('button', { name: /Supprimer/ }).click();
    await card.getByRole('button', { name: 'Confirmer' }).click();
    await expect(card).toHaveCount(0);
  });

  test('lists bounces and blocklists the contacts', async ({ page }) => {
    psql("INSERT INTO bounces (subscriber_id, type, source) VALUES (2, 'hard', 'api');");
    await page.goto('/app/rebonds');
    const row = page.locator('tr').filter({ hasText: 'anon@example.com' });
    await expect(row).toContainText('Définitif');
    await row.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Mettre les contacts en liste noire' }).click();
    await expect.poll(async () => (await (await page.request.get('/api/subscribers/2')).json()).data.status).toBe('blocklisted');
  });
});
