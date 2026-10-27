import { test, expect } from '@playwright/test';
import { resetDB } from '../helpers.js';

// The maintenance page of the Relais app (/app/maintenance).
test.describe('Relais maintenance', () => {
  test.beforeAll(async ({ browser }) => {
    await resetDB(browser);
  });

  test('shows the system, cleans orphan contacts and reads the server log', async ({ page }) => {
    await page.request.post('/api/subscribers', { data: { email: 'orphelin@exemple.fr', name: 'Orphelin', lists: [], status: 'enabled' } });
    await page.goto('/app/maintenance');
    await expect(page.locator('.facts')).toContainText('Version');
    await expect(page.locator('.server-logs')).not.toBeEmpty();

    const job = page.locator('.maint-job').filter({ hasText: 'Supprimer les contacts sans liste' });
    await job.getByRole('button', { name: 'Lancer' }).click();
    await job.getByRole('button', { name: 'Confirmer' }).click();
    await expect(job.getByRole('status')).toContainText('supprimé');
    const subs = (await (await page.request.get('/api/subscribers?per_page=all')).json()).data.results;
    expect(subs.map((s) => s.email)).not.toContain('orphelin@exemple.fr');
  });
});
