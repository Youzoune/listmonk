import { test, expect } from '@playwright/test';
import { resetDB } from '../helpers.js';

// Project screens of the Relais app (/app/projets).
const APP = '/app';

async function createProject(page, { name, domain }) {
  await page.goto(`${APP}/projets/nouveau`);
  await page.getByLabel('Nom').fill(name);
  if (domain !== undefined) await page.getByLabel(/^Domaine( personnalisé)? \(facultatif\)$/).fill(domain);
  await page.getByRole('button', { name: 'Créer le projet' }).click();
}

test.describe.configure({ mode: 'serial' });

test.describe('Relais projects', () => {
  let projectURL;

  test.beforeAll(async ({ browser }) => {
    await resetDB(browser);
  });

  test('lists the default project and offers to create one', async ({ page }) => {
    await page.goto(`${APP}/projets`);
    await expect(page.getByRole('heading', { name: 'Projets' })).toBeVisible();
    const cards = page.locator('.project-card');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Projet ouvert');
    await expect(page.getByRole('link', { name: 'Nouveau projet' })).toBeVisible();
  });

  test('validates and creates a project with a derived slug', async ({ page }) => {
    await createProject(page, { name: 'Club Sport — Lyon', domain: 'http://x' });
    await expect(page.getByLabel('Identifiant')).toHaveValue('club-sport-lyon');
    await expect(page.getByText('Un nom d’hôte comme newsletter.exemple.fr, sans http://.')).toBeVisible();

    await page.getByLabel(/^Domaine( personnalisé)? \(facultatif\)$/).fill('News.Sport.Example.com');
    await page.getByRole('button', { name: 'Créer le projet' }).click();

    await expect(page).toHaveURL(/\/app\/projets\/\d+$/);
    projectURL = new URL(page.url()).pathname;
    await expect(page.getByRole('status')).toContainText('« Club Sport — Lyon » est créé');
    await expect(page.getByLabel(/^Domaine( personnalisé)? \(facultatif\)$/)).toHaveValue('news.sport.example.com');

    // The super admin sees every project.
    await expect(page.locator('.access-row').filter({ hasText: 'admin' })).toContainText('Tous les projets');
  });

  test('refuses a slug already in use', async ({ page }) => {
    await createProject(page, { name: 'Club Sport Lyon' });
    await expect(page.getByRole('alert')).toContainText('slug');
    await expect(page).toHaveURL(/\/projets\/nouveau$/);
  });

  test('switches project from the switcher, the app and the legacy admin follow', async ({ page }) => {
    await page.goto(APP);
    await page.getByRole('button', { name: /Projet/ }).first().click();
    await page.getByRole('option', { name: /Club Sport — Lyon/ }).click();
    await expect(page.getByRole('heading', { name: 'Aujourd’hui sur Club Sport — Lyon' })).toBeVisible();

    await page.goto(`${APP}/audience`);
    await expect(page.getByText('0 contact', { exact: true })).toBeVisible();

    // The legacy admin reads the project cookie: the default project's lists are not there.
    await page.goto('/admin/lists');
    await expect(page.getByText('Default list')).toHaveCount(0);

    // Back to the default project.
    await page.goto(`${APP}/projets`);
    await page.locator('.project-card').filter({ hasText: 'default' }).getByRole('button', { name: 'Ouvrir ce projet' }).click();
    await expect(page.getByRole('heading', { name: /Aujourd’hui sur/ })).not.toContainText('Club Sport');
  });

  test('gives a team member access to the project', async ({ page }) => {
    const role = await page.request.post('/api/roles/users', { data: { name: 'Campagnes', permissions: ['campaigns:get_all'] } });
    const roleID = (await role.json()).data.id;
    const user = await page.request.post('/api/users', {
      data: { username: 'camille', email: 'camille@example.com', name: 'Camille', type: 'user', user_role_id: roleID, status: 'enabled', password_login: true, password: 'camillepass123' },
    });
    const userID = (await user.json()).data.id;
    const projectID = Number(projectURL.split('/').pop());

    await page.goto(projectURL);
    const row = page.locator('.access-row').filter({ hasText: 'Camille' });
    await expect(row).toContainText('Pas d’accès');
    await Promise.all([
      page.waitForResponse((r) => r.url().endsWith(`/api/users/${userID}/projects`) && r.request().method() === 'PUT'),
      row.getByRole('checkbox').check(),
    ]);
    await expect(row).toContainText('A accès');

    const access = await (await page.request.get(`/api/users/${userID}/projects`)).json();
    expect(access.data).toContain(projectID);
  });

  test('deletes an empty project and explains why a project with content stays', async ({ page }) => {
    await createProject(page, { name: 'À supprimer' });
    await expect(page).toHaveURL(/\/app\/projets\/\d+$/);
    await page.getByRole('button', { name: 'Supprimer le projet…' }).click();
    await page.getByRole('button', { name: 'Supprimer « À supprimer » définitivement' }).click();
    await expect(page).toHaveURL(/\/app\/projets$/);
    await expect(page.getByRole('status')).toContainText('« À supprimer » est supprimé.');

    // A project holding a list can't be deleted.
    const projectID = Number(projectURL.split('/').pop());
    await page.request.post('/api/lists', { headers: { 'X-Listmonk-Project': String(projectID) }, data: { name: 'Clubs', type: 'private' } });
    await page.goto(projectURL);
    await page.getByRole('button', { name: 'Supprimer le projet…' }).click();
    await page.getByRole('button', { name: /définitivement/ }).click();
    await expect(page.getByRole('alert')).toContainText('lists');
    await expect(page).toHaveURL(new RegExp(`${projectURL}$`));
  });

  test('never offers to delete the default project', async ({ page }) => {
    await page.goto(`${APP}/projets/1`);
    await expect(page.getByText('Le projet par défaut ne peut pas être supprimé.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Supprimer le projet…' })).toHaveCount(0);
  });
});
