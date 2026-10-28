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
    await page.getByLabel('Identifiant').fill('admin');
    await page.getByLabel('Mot de passe').fill('listmonk');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(new RegExp(`${APP}/?$`));
    await context.close();
  });

  test('sends people without a session to the login page and back', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto(`${APP}/audience`);
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fapp%2Faudience/);

    await page.getByLabel('Identifiant').fill('admin');
    await page.getByLabel('Mot de passe').fill('listmonk');
    await page.getByRole('button', { name: 'Se connecter' }).click();
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
    await expect(page.locator('.relay-detail')).toContainText('Serveurs utilisés');
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

  test('lights the section of every screen in the sidebar', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    for (const [url, entry] of [['/listes', 'Audience'], ['/rebonds', 'Audience'], ['/formulaire', 'Audience'], ['/audience/import', 'Audience'],
      ['/maintenance', 'Réglages'], ['/relais/nouveau', 'Relais d’envoi'], ['/campagnes/nouvelle', 'Campagnes'], ['/', 'Aujourd’hui']]) {
      await page.goto(`${APP}${url}`);
      await expect(nav.locator('a[aria-current="page"]')).toHaveText(entry);
    }
  });

  test('keeps the bottom of the sidebar in view on long pages', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${APP}/reglages?onglet=smtp`);
    await page.mouse.wheel(0, 3000);
    await expect(page.getByRole('link', { name: /Mon compte/ })).toBeInViewport();
    await expect(page.getByRole('link', { name: 'Guide de l’envoi' })).toBeInViewport();
  });

  test('stays readable in dark mode, without glaring white blocks', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    for (const url of [APP, `${APP}/campagnes`, `${APP}/relais`, `${APP}/reglages`]) {
      await page.goto(url);
      await expect(page.locator('.nav a[aria-current="page"]')).toBeVisible();
      const bad = await page.evaluate(() => {
        const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
        const lum = ([r, g, b]) => {
          const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const bgOf = (el) => {
          for (let e = el; e; e = e.parentElement) {
            const c = rgb(getComputedStyle(e).backgroundColor);
            if (c.length === 3 || c[3] > 0.5) return c.slice(0, 3);
          }
          return rgb(getComputedStyle(document.body).backgroundColor).slice(0, 3);
        };
        const out = [];
        for (const el of document.querySelectorAll('button, a, .chip, .alert')) {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height || el.disabled || el.closest('[disabled]')) continue;
          const fg = lum(rgb(getComputedStyle(el).color));
          const bg = lum(bgOf(el));
          const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
          const text = el.textContent.trim().slice(0, 40);
          if (ratio < 4.5) out.push(`${text}: contraste ${ratio.toFixed(2)}`);
          if (bg > 0.6 && !el.classList.contains('btn-primary')) out.push(`${text}: fond clair en mode sombre`);
        }
        return out;
      });
      expect(bad, url).toEqual([]);
    }
  });
});
