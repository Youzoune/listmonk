import { test, expect } from '@playwright/test';
import { getMail, resetDB } from '../helpers.js';

// The React admin (Relais), served at /app.
const APP = '/app';

async function delivered(subject) {
  let mail;
  await expect.poll(async () => {
    mail = (await getMail()).find((m) => m.Content.Headers.Subject?.[0] === subject);
    return !!mail;
  }, { timeout: 20000 }).toBeTruthy();
  return mail;
}

test.describe.configure({ mode: 'serial' });

test.describe('Relais app', () => {
  test.beforeAll(async ({ browser }) => {
    await resetDB(browser);
  });

  test('lands on the app after signing in from the login page', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto('/admin/login');
    await page.getByLabel('Username').fill('admin');
    await page.getByLabel('Password').fill('listmonk');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL(new RegExp(`${APP}/?$`));
    await context.close();
  });

  test('sends people without a session to the login page and back', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto(`${APP}/audience`);
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fapp%2Faudience/);

    await page.getByLabel('Username').fill('admin');
    await page.getByLabel('Password').fill('listmonk');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL(/\/app\/audience$/);
    await expect(page.getByRole('heading', { name: 'Audience' })).toBeVisible();
    await context.close();
  });

  test('shows today’s overview with the instance counts', async ({ page }) => {
    await page.goto(APP);
    await expect(page.getByRole('heading', { name: /Aujourd’hui sur/ })).toBeVisible();
    await expect(page.locator('.kpi-strip')).toContainText('Contacts');
    await expect(page.locator('.kpi-strip')).toContainText('2');
    await expect(page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Aujourd’hui' })).toHaveAttribute('aria-current', 'page');
  });

  test('lists campaigns and filters them by status and search', async ({ page }) => {
    await page.goto(`${APP}/campagnes`);
    const rows = page.locator('.table tbody tr');
    await expect(rows.filter({ hasText: 'Welcome to listmonk' })).toBeVisible();
    await expect(rows.filter({ hasText: 'Welcome to listmonk' })).toContainText('Brouillon');

    await page.getByRole('button', { name: 'En cours' }).click();
    await expect(page).toHaveURL(/statut=running/);
    await expect(page.getByText('Aucune campagne ne correspond à ce filtre.')).toBeVisible();

    await page.getByRole('button', { name: 'Toutes' }).click();
    await page.getByPlaceholder('Nom ou objet').fill('introuvable');
    await expect(page.getByText('Aucune campagne ne correspond à ce filtre.')).toBeVisible();
    await page.getByPlaceholder('Nom ou objet').fill('Welcome');
    await expect(rows.filter({ hasText: 'Welcome to listmonk' })).toBeVisible();
  });

  test('lists contacts, filters them by list and searches them', async ({ page }) => {
    await page.goto(`${APP}/audience`);
    const rows = page.locator('.table tbody tr');
    await expect(rows).toHaveCount(2);

    await page.getByRole('button', { name: /Opt-in list/ }).click();
    await expect(page).toHaveURL(/liste=\d+/);
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('anon@example.com');

    await page.getByRole('button', { name: /Toutes les listes/ }).click();
    await page.getByPlaceholder('Nom ou e-mail').fill('john');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('john@example.com');
  });

  test('shows the default relay and the SMTP servers', async ({ page }) => {
    await page.goto(`${APP}/relais`);
    const list = page.getByRole('navigation', { name: 'Relais' });
    await expect(list.getByRole('button', { name: /Relais par défaut/ })).toBeVisible();
    await list.getByRole('button', { name: /Relais par défaut/ }).click();
    await expect(page.locator('.relay-detail')).toContainText('serveurs SMTP partagés');
  });

  test('creates and launches a campaign with readable variables', async ({ page }) => {
    const subject = 'Test Relais John';

    await page.goto(`${APP}/campagnes/nouvelle`);
    await page.getByText('Default list', { exact: true }).click();
    await page.getByRole('button', { name: 'Continuer' }).click();

    // A variable goes into the field typed in last: here, the subject.
    await page.getByLabel('Objet').fill('Test Relais ');
    await page.getByLabel('Objet').focus();
    await page.getByRole('button', { name: 'Prénom', exact: true }).click();
    await expect(page.getByLabel('Objet')).toHaveValue('Test Relais {prénom}');

    await page.getByLabel('Texte').fill('Bonjour {prénom},\n\nCeci est un test de la nouvelle interface.');
    await expect(page.locator('.preview-subject')).toHaveText('Test Relais Camille');
    await page.getByRole('button', { name: 'Continuer' }).click();

    await expect(page.getByLabel('Dès maintenant')).toBeChecked();
    await page.getByRole('button', { name: 'Continuer' }).click();

    await expect(page.getByRole('heading', { name: 'Tout est prêt' })).toBeVisible();
    await page.getByRole('button', { name: 'Lancer la campagne' }).click();

    await expect(page).toHaveURL(/\/app\/campagnes$/);
    await expect(page.locator('.alert-ok')).toHaveText('« Test Relais {prénom} » est lancée.');

    const mail = await delivered(subject);
    expect(mail.Content.Headers.To[0]).toContain('john@example.com');
    expect(mail.Content.Body).toContain('Bonjour John');
  });

  test('shows a not-found page for unknown routes', async ({ page }) => {
    await page.goto(`${APP}/nimporte-quoi`);
    await expect(page.getByRole('heading', { name: 'Page introuvable' })).toBeVisible();
  });
});
