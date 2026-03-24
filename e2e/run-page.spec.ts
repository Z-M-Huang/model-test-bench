import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

test.describe('Run Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/run');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page loads with correct heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'New Run' })).toBeVisible();
    await expect(page.getByText('Execute a test scenario against a setup configuration.')).toBeVisible();
  });

  test('setup dropdown is present with label', async ({ page }) => {
    await expect(page.getByText('Setup', { exact: true })).toBeVisible();
    const setupSelect = page.locator('select').first();
    await expect(setupSelect).toBeVisible();
  });

  test('scenario dropdown is present with label', async ({ page }) => {
    await expect(page.getByText('Scenario', { exact: true })).toBeVisible();
    const scenarioSelect = page.locator('select').nth(1);
    await expect(scenarioSelect).toBeVisible();
  });

  test('scenario dropdown populates with available scenarios', async ({ page }) => {
    const scenarioSelect = page.locator('select').nth(1);
    const optionCount = await scenarioSelect.locator('option').count();
    // Should have at least 1 option (built-in scenarios or "No scenarios available")
    expect(optionCount).toBeGreaterThanOrEqual(1);
  });

  test('setup dropdown shows "No setups available" when no setups exist', async ({ page, request }) => {
    // Check if there are any setups
    const listRes = await request.get('/api/setups');
    const setups = await listRes.json();
    if (setups.length === 0) {
      const setupSelect = page.locator('select').first();
      const noSetupOption = setupSelect.locator('option', { hasText: 'No setups available' });
      await expect(noSetupOption).toBeAttached();
    }
  });

  test('Start Run button is present', async ({ page }) => {
    const startBtn = page.getByRole('button', { name: /Start Run/i });
    await expect(startBtn).toBeVisible();
  });

  test('Start Run button is disabled when no setup is selected', async ({ page, request }) => {
    const listRes = await request.get('/api/setups');
    const setups = await listRes.json();
    if (setups.length === 0) {
      const startBtn = page.getByRole('button', { name: /Start Run/i });
      await expect(startBtn).toBeDisabled();
    }
  });

  test('message log area shows placeholder text before run starts', async ({ page }) => {
    await expect(page.getByText('Select a setup and scenario, then click Start Run.')).toBeVisible();
  });

  test('page is accessible via sidebar navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const link = page.locator('aside a', { hasText: 'New Run' }).first();
    await link.click();
    await expect(page).toHaveURL(/\/run$/);
    await expect(page.getByRole('heading', { name: 'New Run' })).toBeVisible();
  });
});
