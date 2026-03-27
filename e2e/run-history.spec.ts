import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

test.describe('Run History', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/history');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page loads with correct heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Run History' })).toBeVisible();
    await expect(page.getByText('Browse and filter all previous test runs.')).toBeVisible();
  });

  test('table headers render', async ({ page }) => {
    const headers = ['Status', 'Scenario', 'Provider', 'Duration', 'Turns', 'Cost', 'Date'];
    for (const header of headers) {
      await expect(page.locator('th', { hasText: header }).first()).toBeVisible();
    }
  });

  test('initially shows empty state or existing runs', async ({ page }) => {
    const emptyMsg = page.getByText('No runs found.');
    const tableRow = page.locator('tbody tr').first();
    const isEmpty = await emptyMsg.isVisible().catch(() => false);
    const hasRows = await tableRow.isVisible().catch(() => false);
    expect(isEmpty || hasRows).toBe(true);
  });

  test('filter dropdowns render', async ({ page }) => {
    // All Providers filter
    const providerFilter = page.locator('select', { hasText: 'All Providers' });
    await expect(providerFilter).toBeVisible();

    // All Scenarios filter
    const scenarioFilter = page.locator('select', { hasText: 'All Scenarios' });
    await expect(scenarioFilter).toBeVisible();

    // All Statuses filter
    const statusFilter = page.locator('select', { hasText: 'All Statuses' });
    await expect(statusFilter).toBeVisible();
  });

  test('status filter has all expected options', async ({ page }) => {
    const statusFilter = page.locator('select').nth(2);
    const options = statusFilter.locator('option');
    const texts = await options.allTextContents();
    expect(texts).toContain('All Statuses');
    expect(texts).toContain('Success');
    expect(texts).toContain('Running');
    expect(texts).toContain('Failed');
    expect(texts).toContain('Pending');
    expect(texts).toContain('Cancelled');
  });

  test('page is accessible via sidebar navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const link = page.locator('aside a', { hasText: 'Run History' }).first();
    await link.click();
    await expect(page).toHaveURL(/\/history$/);
    await expect(page.getByRole('heading', { name: 'Run History' })).toBeVisible();
  });
});
