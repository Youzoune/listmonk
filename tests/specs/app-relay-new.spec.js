import { test, expect } from '@playwright/test';
import { clearMail, getMail, resetDB } from '../helpers.js';

// The "Nouveau relais" wizard of the Relais app (/app/relais/nouveau).
test.describe.configure({ mode: 'serial' });

const SMTP_HOST = process.env.MAILHOG_SMTP_HOST || 'localhost';
const SMTP_PORT = process.env.MAILHOG_SMTP_PORT || '1025';

test.describe('New sending relay', () => {
  test.beforeAll(async ({ browser }) => {
    await resetDB(browser);
  });

  test('offers to create a relay when there is none', async ({ page }) => {
    await page.goto('/app/relais');
    await expect(page.getByText('Aucun relais dédié pour l’instant')).toBeVisible();
    await page.getByRole('link', { name: 'Nouveau relais' }).click();
    await expect(page).toHaveURL(/\/app\/relais\/nouveau$/);
    await expect(page.getByRole('heading', { name: 'Qui envoie vos e-mails ?' })).toBeVisible();
  });

  test('fills a provider from its preset and refuses missing credentials', async ({ page }) => {
    await page.goto('/app/relais/nouveau');
    await page.getByRole('button', { name: /OVHcloud \(MX Plan\)/ }).click();
    await expect(page.getByText('ssl0.ovh.net:465')).toBeVisible();
    await expect(page.getByLabel('Nom du relais')).toHaveValue('ovh');
    await page.getByRole('button', { name: 'Continuer' }).click();
    await expect(page.getByText('Indiquez l’identifiant de connexion.')).toBeVisible();
    await expect(page.getByText('Indiquez le mot de passe.')).toBeVisible();
  });

  test('connects to another server, tests it and creates the relay with a pace', async ({ page }) => {
    await clearMail();
    await page.goto('/app/relais/nouveau');
    await page.getByRole('button', { name: /Un autre fournisseur/ }).click();
    await page.getByLabel('Serveur SMTP').fill(SMTP_HOST);
    await page.getByLabel('Port').fill(SMTP_PORT);
    await page.getByLabel('Chiffrement').selectOption('none');
    await page.getByLabel('Authentification').selectOption('none');
    await page.getByLabel('Nom du relais').fill('club-sport');
    await page.getByLabel('Réservé au projet Default').check();

    await page.getByLabel('Adresse qui recevra l’e-mail de test').fill('relais-test@example.com');
    await page.getByRole('button', { name: 'Envoyer un e-mail de test' }).click();
    await expect(page.getByRole('status')).toContainText('la connexion fonctionne');
    await expect.poll(async () => (await getMail()).some((m) => m.Content.Headers.To?.[0]?.includes('relais-test@example.com')), { timeout: 15000 }).toBe(true);

    await page.getByRole('button', { name: 'Continuer' }).click();
    await page.getByLabel('Nouveau domaine ou nouveau serveur').check();
    await page.getByRole('button', { name: 'Créer le relais' }).click();

    await expect(page).toHaveURL(/\/app\/relais\?relais=club-sport/, { timeout: 30000 });
    await expect(page.locator('.relay-list')).toContainText('club-sport');

    const smtp = (await (await page.request.get('/api/settings')).json()).data.smtp;
    const s = smtp.find((x) => x.name.replace(/^email-/, '') === 'club-sport');
    expect(s).toMatchObject({ host: SMTP_HOST, port: Number(SMTP_PORT), tls_type: 'none', project_id: 1 });
    expect(s.cadence.per_minute).toBe(5);
    expect(s.warmup.enabled).toBe(true);
  });
});
