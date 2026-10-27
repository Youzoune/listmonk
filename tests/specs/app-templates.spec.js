import { test, expect } from '@playwright/test';
import { resetDB } from '../helpers.js';

// The templates screens of the Relais app (/app/modeles).
const URL = '/app/modeles';

test.describe.configure({ mode: 'serial' });

test.describe('Relais templates', () => {
  test.beforeAll(async ({ browser }) => {
    await resetDB(browser);
  });

  test('creates a campaign template from the starter, with a live preview', async ({ page }) => {
    await page.goto(`${URL}/nouveau`);
    await page.getByLabel('Nom').fill('Lettre du club');
    await expect(page.getByLabel('Code HTML')).toHaveValue(/template "content"/);
    await expect(page.frameLocator('.tpl-preview iframe').locator('body')).toContainText('Se désinscrire', { timeout: 10000 });

    // Without the content tag, the template is refused.
    const body = await page.getByLabel('Code HTML').inputValue();
    await page.getByLabel('Code HTML').fill('<p>Sans contenu</p>');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('Le modèle doit contenir')).toBeVisible();

    await page.getByLabel('Code HTML').fill(body);
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page).toHaveURL(/\/app\/modeles\/\d+$/);
    await expect(page.getByRole('status')).toContainText('Enregistré');
  });

  test('lists templates, sets the default one and duplicates it', async ({ page }) => {
    await page.goto(URL);
    const row = page.locator('tr').filter({ hasText: 'Lettre du club' });
    await row.getByRole('button', { name: 'Par défaut' }).click();
    await expect(row).toContainText('Par défaut');
    await expect(row.getByRole('button', { name: 'Supprimer' })).toHaveCount(0);

    await row.getByRole('button', { name: 'Dupliquer' }).click();
    await expect(page.getByLabel('Nom')).toHaveValue('Copie de Lettre du club');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page).toHaveURL(/\/app\/modeles\/\d+$/);

    await page.goto(URL);
    const copy = page.locator('tr').filter({ hasText: 'Copie de Lettre du club' });
    await copy.getByRole('button', { name: 'Supprimer' }).click();
    await copy.getByRole('button', { name: 'Confirmer' }).click();
    await expect(copy).toHaveCount(0);
  });

  test('creates a transactional template with its subject', async ({ page }) => {
    await page.goto(`${URL}/nouveau?type=tx`);
    await page.getByLabel('Nom').fill('Confirmation de commande');
    await expect(page.getByLabel('Objet de l’e-mail')).toHaveValue('Bonjour {{ .Subscriber.Name }}');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page).toHaveURL(/\/app\/modeles\/\d+$/);

    const list = (await (await page.request.get('/api/templates?no_body=true')).json()).data;
    expect(list.find((t) => t.name === 'Confirmation de commande').type).toBe('tx');

    await page.goto(URL);
    await page.locator('tr').filter({ hasText: 'Confirmation de commande' }).getByRole('button', { name: 'Aperçu' }).click();
    await expect(page.frameLocator('.tpl-preview iframe').locator('body')).toContainText('est confirmée', { timeout: 10000 });
  });
});
