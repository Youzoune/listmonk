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

  test('sets trusted URLs, bounce rules and uses them in the signup form', async ({ page }) => {
    await page.goto('/app/reglages?onglet=securite');
    await page.getByLabel('Adresses de confiance').fill('https://club.fr/merci');
    await page.getByLabel('Altcha (sans service externe, recommandé)').check();
    await page.getByRole('tab', { name: 'Rebonds' }).click();
    await page.getByLabel('Rebond temporaire : après').fill('3');
    await page.locator('#b-soft-action').selectOption('unsubscribe');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('.save-bar')).toContainText('Enregistré', { timeout: 20000 });

    const s = (await (await page.request.get('/api/settings')).json()).data;
    expect(s['security.trusted_urls']).toEqual(['https://club.fr/merci']);
    expect(s['security.captcha'].altcha.enabled).toBe(true);
    expect(s['bounce.actions'].soft).toEqual({ count: 3, action: 'unsubscribe' });

    await page.request.post('/api/lists', { data: { name: 'Lettre publique', type: 'public', optin: 'single' } });
    await page.goto('/app/formulaire');
    await page.getByLabel('Page après l’inscription (facultatif)').fill('https://club.fr/merci');
    const code = page.getByLabel('Code HTML du formulaire');
    await expect(code).toHaveValue(/action="http:\/\/localhost:\d+\/subscription\/form"/);
    await expect(code).toHaveValue(/Lettre publique/);
    await expect(code).toHaveValue(/name="next" value="https:\/\/club.fr\/merci"/);
    await expect(code).toHaveValue(/altcha-widget/);
  });

  test('sets up single sign-on and keeps its secret', async ({ page }) => {
    await page.goto(`${URL}?onglet=securite`);
    await page.getByLabel('Proposer « Se connecter avec… » sur la page de connexion').check();
    await expect(page.locator('.explain').filter({ hasText: 'adresse de retour' })).toBeAttached();
    await page.getByLabel('Nom affiché').fill('Google');
    await page.getByLabel('Adresse du fournisseur').fill('https://accounts.google.com');
    await page.getByLabel('Identifiant client').fill('relais-client');
    await page.getByLabel('Secret client').fill('secret-de-test');
    await page.getByLabel('Créer le compte à la première connexion').check();
    await page.getByLabel('Rôle des nouveaux comptes').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Ajouter une règle' }).click();
    await page.getByLabel('Valeur exacte').fill('marketing');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('.save-bar')).toContainText('Enregistré', { timeout: 20000 });

    let o = (await (await page.request.get('/api/settings')).json()).data['security.oidc'];
    expect(o).toMatchObject({ enabled: true, provider_name: 'Google', client_id: 'relais-client', auto_create_users: true });
    expect(o.client_secret).toMatch(/^•+$/);
    expect(o.roles).toEqual([expect.objectContaining({ claim: 'groups', match: 'marketing' })]);

    // Turning it off again keeps the saved secret.
    await page.reload();
    await page.getByLabel('Proposer « Se connecter avec… » sur la page de connexion').uncheck();
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('.save-bar')).toContainText('Enregistré', { timeout: 20000 });
    o = (await (await page.request.get('/api/settings')).json()).data['security.oidc'];
    expect(o.enabled).toBe(false);
    expect(o.client_secret.length).toBe('secret-de-test'.length);
  });

  test('sets the bounce mailbox and a provider webhook', async ({ page }) => {
    await page.goto(`${URL}?onglet=rebonds`);
    const box = page.getByRole('group', { name: 'Boîte de rebonds 1' });
    await box.getByLabel('Adresse de retour (Return-Path)').fill('rebonds@club.fr');
    await box.getByLabel('Serveur POP3').fill('pop3.mail.ovh.net');
    await box.getByLabel('Identifiant de la boîte').fill('rebonds@club.fr');
    await box.getByLabel('Mot de passe de la boîte').fill('mot-de-passe-pop');
    await page.getByLabel('Recevoir les rebonds par webhook').check();
    await page.getByLabel('Postmark').check();
    await page.getByLabel('Identifiant Postmark').fill('relais');
    await page.getByLabel('Mot de passe Postmark').fill('pm-secret');
    await expect(page.getByText(/\/webhooks\/service\/postmark/)).toBeVisible();
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('.save-bar')).toContainText('Enregistré', { timeout: 20000 });

    const s = (await (await page.request.get('/api/settings')).json()).data;
    expect(s['bounce.mailboxes'][0]).toMatchObject({ host: 'pop3.mail.ovh.net', return_path: 'rebonds@club.fr', username: 'rebonds@club.fr' });
    expect(s['bounce.mailboxes'][0].password).toMatch(/^•+$/);
    expect(s['bounce.postmark']).toMatchObject({ enabled: true, username: 'relais' });
    expect(s['bounce.postmark'].password.length).toBe('pm-secret'.length);
  });

  test('adds a postback channel', async ({ page }) => {
    await page.goto(`${URL}?onglet=messagers`);
    await page.getByRole('button', { name: 'Ajouter un canal' }).click();
    await page.getByLabel('Nom du canal').fill('sms');
    await page.getByLabel('Adresse du service').fill('http://127.0.0.1:9999/sms');
    await page.getByLabel('Mot de passe (facultatif)').fill('canal-secret');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('.save-bar')).toContainText('Enregistré', { timeout: 20000 });
    const s = (await (await page.request.get('/api/settings')).json()).data;
    expect(s.messengers).toEqual([expect.objectContaining({ name: 'sms', root_url: 'http://127.0.0.1:9999/sms', enabled: true })]);
    expect(s.messengers[0].uuid).toBeTruthy();

    await page.reload();
    await page.getByRole('button', { name: 'Retirer ce canal' }).click();
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('.save-bar')).toContainText('Enregistré', { timeout: 20000 });
    expect((await (await page.request.get('/api/settings')).json()).data.messengers).toEqual([]);
  });
});
