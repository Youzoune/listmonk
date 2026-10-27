import { test, expect } from '@playwright/test';
import { createHmac } from 'node:crypto';
import { resetDB } from '../helpers.js';

// "Mon compte" in the Relais app: profile, two-factor authentication, logout.
test.describe.configure({ mode: 'serial' });

// RFC 6238 code of a base32 secret, as an authenticator app shows it.
function totp(secret, at = Date.now()) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of secret.replace(/=+$/, '').toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const h = createHmac('sha1', key).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

test.describe('Relais account', () => {
  test.beforeAll(async ({ browser }) => {
    await resetDB(browser);
  });

  test('changes the displayed name', async ({ page }) => {
    await page.goto('/app/compte');
    await page.getByLabel('Nom affiché').fill('Ahmed');
    await page.getByLabel('Adresse e-mail').fill('admin@club.fr');
    await page.getByRole('region', { name: 'Profil' }).getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByRole('region', { name: 'Profil' }).getByRole('status')).toContainText('Enregistré');
    await expect(page.locator('.me')).toContainText('Ahmed');
  });

  test('turns on two-factor authentication, signs in with a code, turns it off', async ({ browser }) => {
    // Its own session: logging out must not end the shared one.
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto('/admin/login?next=/app/compte');
    await page.getByLabel('Identifiant').fill('admin');
    await page.getByLabel('Mot de passe').fill('listmonk');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/app\/compte$/);

    const region = page.getByRole('region', { name: 'Double authentification' });
    await region.getByRole('button', { name: 'Activer' }).click();
    await expect(region.getByAltText('Code QR à scanner')).toBeVisible();
    const secret = (await region.locator('.totp-secret').textContent()).trim();
    await region.getByLabel('Code à 6 chiffres').fill(totp(secret));
    await region.getByRole('button', { name: 'Activer' }).click();
    await expect(region).toContainText('Activée');

    // Signing in again asks for the code.
    await page.getByRole('button', { name: 'Se déconnecter' }).first().click();
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.getByLabel('Identifiant').fill('admin');
    await page.getByLabel('Mot de passe').fill('listmonk');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.getByRole('heading', { name: 'Double authentification' })).toBeVisible();
    await page.getByLabel('Code').fill(totp(secret));
    await page.getByRole('button', { name: 'Continuer' }).click();
    await expect(page).toHaveURL(/\/app/);

    await page.goto('/app/compte');
    await region.getByLabel('Mot de passe actuel').fill('listmonk');
    await region.getByRole('button', { name: 'Désactiver' }).click();
    await expect(region).toContainText('Désactivée');
    await context.close();
  });

  test('shows the Relais sign-in page with a password reset link', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto('/admin/login');
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
    await page.getByRole('link', { name: 'Mot de passe oublié ?' }).click();
    await page.getByLabel('Adresse e-mail').fill('nobody@example.com');
    await page.getByRole('button', { name: 'Recevoir le lien' }).click();
    await expect(page.getByRole('heading', { name: 'Vérifiez vos e-mails' })).toBeVisible();
    await context.close();
  });
});
