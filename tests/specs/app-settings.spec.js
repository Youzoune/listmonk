import { test, expect } from '@playwright/test';
import { clearMail, getMail, resetDB } from '../helpers.js';

// The settings screen of the Relais app (/app/reglages).
const URL = '/app/reglages';

test.describe.configure({ mode: 'serial' });

test.describe('Relais settings', () => {
  test.beforeAll(async ({ browser }) => {
    await resetDB(browser);
  });

  test('sends a test e-mail through the saved SMTP server', async ({ page }) => {
    await clearMail();
    await page.goto(`${URL}?onglet=smtp`);
    await expect(page.locator('.smtp-editor')).toBeVisible();
    await page.getByLabel('Adresse qui recevra l’e-mail de test').fill('test-smtp@example.com');
    await page.getByRole('button', { name: 'Envoyer un e-mail de test' }).click();
    await expect(page.getByRole('status')).toContainText('E-mail de test envoyé');
    await expect.poll(async () => (await getMail()).some((m) => m.Content.Headers.To?.[0]?.includes('test-smtp@example.com')), { timeout: 15000 }).toBe(true);
  });

  test('fills a new server from a provider preset and refuses it incomplete', async ({ page }) => {
    await page.goto(`${URL}?onglet=smtp`);
    await page.getByRole('button', { name: 'Ajouter un serveur' }).click();
    await page.getByLabel('Mon fournisseur').selectOption({ label: 'OVHcloud (MX Plan)' });
    await expect(page.locator('.preset-card')).toContainText('adresse e-mail complète');
    await page.getByRole('button', { name: 'Remplir' }).click();
    await expect(page.getByLabel('Hôte')).toHaveValue('ssl0.ovh.net');
    await expect(page.getByLabel('Port')).toHaveValue('465');
    await expect(page.getByLabel('Chiffrement')).toHaveValue('TLS');

    // No username yet: the server can't be saved.
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('.save-bar')).toContainText('incomplet');
    await expect(page.getByText('Indiquez l’identifiant de connexion.')).toBeVisible();

    await page.getByRole('button', { name: 'Retirer ce serveur' }).click();
    await expect(page.locator('.relay-list')).not.toContainText('Non enregistré');
  });

  test('saves the general settings and keeps the SMTP password', async ({ page }) => {
    const before = (await (await page.request.get('/api/settings')).json()).data;

    await page.goto(URL);
    await page.getByLabel('Nom du site').fill('Relais Youzoune');
    await expect(page.locator('.save-bar')).toContainText('non enregistrées');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('.save-bar')).toContainText('Enregistré', { timeout: 20000 });

    const after = (await (await page.request.get('/api/settings')).json()).data;
    expect(after['app.site_name']).toBe('Relais Youzoune');
    expect(after.smtp).toHaveLength(before.smtp.length);
    // The masked password stays the saved one.
    expect(after.smtp[0].password).toBe(before.smtp[0].password);

    await page.reload();
    await expect(page.getByLabel('Nom du site')).toHaveValue('Relais Youzoune');
    await expect(page.locator('.save-bar')).toContainText('Tout est enregistré');
  });

  test('changes the sending speed and privacy options', async ({ page }) => {
    await page.goto(`${URL}?onglet=envoi`);
    await page.getByLabel('Envois en parallèle').fill('4');
    await page.getByRole('tab', { name: 'Confidentialité' }).click();
    const header = page.getByLabel('En-tête de désinscription en un clic');
    const was = await header.isChecked();
    await header.setChecked(!was);
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('.save-bar')).toContainText('Enregistré', { timeout: 20000 });

    const s = (await (await page.request.get('/api/settings')).json()).data;
    expect(s['app.concurrency']).toBe(4);
    expect(s['privacy.unsubscribe_header']).toBe(!was);
  });
});
