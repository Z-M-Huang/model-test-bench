import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

test.describe('Dashboard page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page loads at root URL', async ({ page }) => {
    await expect(page).toHaveURL(/\/$/);
  });

  test('shows Dashboard heading', async ({ page }) => {
    const heading = page.locator('h1');
    await expect(heading).toHaveText('Dashboard');
  });

  test('shows subtitle text', async ({ page }) => {
    await expect(page.getByText('System performance and experiment orchestration overview.')).toBeVisible();
  });

  test('stats cards render with correct labels', async ({ page }) => {
    const statsLabels = ['Total Providers', 'Total Scenarios', 'Total Runs'];
    for (const label of statsLabels) {
      await expect(page.getByText(label)).toBeVisible();
    }
  });

  test('stats cards show numeric values after loading', async ({ page }) => {
    // Wait for loading to finish (stats should show numbers, not '--')
    await expect(page.locator('text=--')).toHaveCount(0, { timeout: 5000 });
  });

  test('quick start cards render', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'New Provider' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Start Run' })).toBeVisible();
  });

  test('New Provider card has descriptive text', async ({ page }) => {
    await expect(page.getByText('Configure model provider')).toBeVisible();
  });

  test('Start Run card has descriptive text', async ({ page }) => {
    await expect(page.getByText('Execute a test scenario')).toBeVisible();
  });

  test('recent runs section renders', async ({ page }) => {
    await expect(page.getByText('Recent Runs')).toBeVisible();
    // Table headers
    await expect(page.getByText('Status').first()).toBeVisible();
    await expect(page.getByText('Provider').first()).toBeVisible();
    await expect(page.getByText('Scenario Name')).toBeVisible();
  });

  test('recent runs shows empty state message when no runs exist', async ({ page }) => {
    // If no runs, should show the empty message
    const emptyMsg = page.getByText('No runs yet. Start your first run above.');
    const runRow = page.locator('tbody tr').first();
    // Either the empty message is visible or actual run rows exist
    const isEmpty = await emptyMsg.isVisible().catch(() => false);
    if (isEmpty) {
      await expect(emptyMsg).toBeVisible();
    } else {
      await expect(runRow).toBeVisible();
    }
  });

  test('clicking New Provider card navigates to /providers/new', async ({ page }) => {
    await page.getByRole('heading', { name: 'New Provider' }).click();
    await expect(page).toHaveURL(/\/providers\/new$/);
  });

  test('clicking Start Run card navigates to /run', async ({ page }) => {
    await page.getByRole('heading', { name: 'Start Run' }).click();
    await expect(page).toHaveURL(/\/run$/);
  });
});
