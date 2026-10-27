import { test, expect } from '@playwright/test';
import { resetDB } from '../helpers.js';

// Lists, contacts and imports in the Relais app.
test.describe.configure({ mode: 'serial' });

test.describe('Relais audience', () => {
  test.beforeAll(async ({ browser }) => {
    await resetDB(browser);
  });

  test('creates, edits and deletes a list', async ({ page }) => {
    await page.goto('/app/listes');
    await page.getByRole('button', { name: 'Nouvelle liste' }).click();
    await page.getByRole('button', { name: 'Créer la liste' }).click();
    await expect(page.getByText('Donnez un nom à la liste.')).toBeVisible();

    await page.getByLabel('Nom').fill('Adhérents 2026');
    await page.getByLabel('Visibilité').selectOption('public');
    await page.getByLabel('Confirmation d’inscription').selectOption('double');
    await page.getByRole('button', { name: 'Créer la liste' }).click();
    const row = page.locator('tr').filter({ hasText: 'Adhérents 2026' });
    await expect(row).toContainText('Publique');
    await expect(row).toContainText('Double');

    await row.getByRole('button', { name: 'Modifier' }).click();
    await page.getByLabel('Nom').fill('Adhérents');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('tr').filter({ hasText: 'Adhérents' }).first()).toBeVisible();

    const temp = (await (await page.request.post('/api/lists', { data: { name: 'À supprimer', type: 'private' } })).json()).data;
    await page.reload();
    const tempRow = page.locator('tr').filter({ hasText: 'À supprimer' });
    await tempRow.getByRole('button', { name: 'Supprimer' }).click();
    await tempRow.getByRole('button', { name: 'Supprimer la liste' }).click();
    await expect(tempRow).toHaveCount(0);
    expect((await page.request.get(`/api/lists/${temp.id}`)).status()).toBe(400);
  });

  test('adds a contact with lists and attributes, then edits it', async ({ page }) => {
    await page.goto('/app/audience/nouveau');
    await page.getByLabel('E-mail', { exact: true }).fill('pas-un-email');
    await page.getByRole('button', { name: 'Ajouter le contact' }).click();
    await expect(page.getByText('Une adresse e-mail valide')).toBeVisible();

    await page.getByLabel('E-mail', { exact: true }).fill('lea@exemple.fr');
    await page.getByLabel('Nom', { exact: true }).fill('Léa Martin');
    await page.getByLabel('Adhérents').check();
    await page.getByLabel('Confirmer d’office les inscriptions').check();
    await page.getByRole('button', { name: 'Ajouter un attribut' }).click();
    await page.getByLabel('Nom de l’attribut').fill('ville');
    await page.getByLabel('Valeur').fill('Lyon');
    await page.getByRole('button', { name: 'Ajouter le contact' }).click();
    await expect(page).toHaveURL(/\/app\/audience\/\d+$/);
    await expect(page.locator('.check-list')).toContainText('Confirmé');

    const id = Number(page.url().split('/').pop());
    const sub = (await (await page.request.get(`/api/subscribers/${id}`)).json()).data;
    expect(sub.attribs).toEqual({ ville: 'Lyon' });
    expect(sub.lists.map((l) => l.name)).toEqual(['Adhérents']);

    await page.getByLabel('Statut').selectOption('blocklisted');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByRole('status')).toContainText('Enregistré');
    expect((await (await page.request.get(`/api/subscribers/${id}`)).json()).data.status).toBe('blocklisted');

    await page.goto('/app/audience');
    await page.getByRole('link', { name: 'Léa Martin' }).click();
    await expect(page.getByLabel('E-mail', { exact: true })).toHaveValue('lea@exemple.fr');
  });

  test('imports a CSV file into a list', async ({ page }) => {
    await page.goto('/app/audience/import');
    await page.getByRole('button', { name: 'Lancer l’import' }).click();
    await expect(page.getByText('Choisissez un fichier CSV')).toBeVisible();

    await page.getByLabel('Fichier CSV ou ZIP').setInputFiles({
      name: 'contacts.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('email;name\nimport1@exemple.fr;Import Un\nimport2@exemple.fr;Import Deux\n'),
    });
    await page.getByLabel('Séparateur de colonnes').selectOption(';');
    await page.getByLabel('Adhérents').check();
    await page.getByRole('button', { name: 'Lancer l’import' }).click();
    await expect(page.getByRole('heading', { name: 'Import terminé' })).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.panel').filter({ hasText: 'Import terminé' })).toContainText('2 contacts importés');

    const subs = (await (await page.request.get('/api/subscribers?per_page=all')).json()).data.results;
    expect(subs.map((s) => s.email)).toEqual(expect.arrayContaining(['import1@exemple.fr', 'import2@exemple.fr']));

    await page.getByRole('button', { name: 'Nouvel import' }).click();
    await expect(page.getByLabel('Fichier CSV ou ZIP')).toBeVisible();
  });
});
