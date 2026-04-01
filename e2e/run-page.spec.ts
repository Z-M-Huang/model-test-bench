import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

test.describe('Run Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/run');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page loads with correct heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'New Run' })).toBeVisible();
    await expect(page.getByText('Execute a test scenario against a model provider.')).toBeVisible();
  });

  test('provider dropdown is present with label', async ({ page }) => {
    await expect(page.getByText('API Provider')).toBeVisible();
    const providerSelect = page.locator('select').first();
    await expect(providerSelect).toBeVisible();
  });

  test('scenario dropdown is present with label', async ({ page }) => {
    await expect(page.getByText('Scenario', { exact: true })).toBeVisible();
    const scenarioSelect = page.locator('select').nth(1);
    await expect(scenarioSelect).toBeVisible();
  });

  test('scenario dropdown populates with available scenarios', async ({ page }) => {
    const scenarioSelect = page.locator('select').nth(1);
    const optionCount = await scenarioSelect.locator('option').count();
    expect(optionCount).toBeGreaterThanOrEqual(1);
  });

  test('provider dropdown shows "No providers available" when no providers exist', async ({ page, request }) => {
    const listRes = await request.get('/api/providers');
    const providers = await listRes.json();
    if (providers.length === 0) {
      const providerSelect = page.locator('select').first();
      const noProviderOption = providerSelect.locator('option', { hasText: 'No providers available' });
      await expect(noProviderOption).toBeAttached();
    }
  });

  test('Start Run button is present', async ({ page }) => {
    const startBtn = page.getByRole('button', { name: /Start Run/i });
    await expect(startBtn).toBeVisible();
  });

  test('Start Run button is disabled when no provider is selected', async ({ page, request }) => {
    const listRes = await request.get('/api/providers');
    const providers = await listRes.json();
    if (providers.length === 0) {
      const startBtn = page.getByRole('button', { name: /Start Run/i });
      await expect(startBtn).toBeDisabled();
    }
  });

  test('message log area shows placeholder text before run starts', async ({ page }) => {
    await expect(page.getByText('Select a provider and scenario, then click Start Run.')).toBeVisible();
  });

  test('page is accessible via sidebar navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const link = page.locator('aside a', { hasText: 'New Run' }).first();
    await link.click();
    await expect(page).toHaveURL(/\/run$/);
    await expect(page.getByRole('heading', { name: 'New Run' })).toBeVisible();
  });

  // --- Start Run interaction ---

  test('clicking Start Run does not crash the page', async ({ page, request }) => {
    // Ensure we have providers and scenarios
    const providersRes = await request.get('/api/providers');
    const providers = await providersRes.json();
    const scenariosRes = await request.get('/api/scenarios');
    const scenarios = await scenariosRes.json();
    if (providers.length === 0 || scenarios.length === 0) return;

    const startBtn = page.getByRole('button', { name: /Start Run/i });
    await expect(startBtn).toBeEnabled();
    await startBtn.click();

    // The run will fail (no real API keys) but the page should not crash.
    // The app may navigate to the run detail page after starting.
    // Wait for a status indicator to appear (on either the run page or run detail page).
    await expect(page.getByText(/Pending|Abort|Running|Failed|Error/i).first()).toBeVisible({ timeout: 15000 });

    // The page should still be functional (no crash).
    // After starting a run the app may stay on /run or navigate to /runs/:id (Run Detail).
    const hasNewRun = await page.getByRole('heading', { name: 'New Run' }).isVisible().catch(() => false);
    const hasRunDetail = await page.getByRole('heading', { name: 'Run Detail' }).isVisible().catch(() => false);
    expect(hasNewRun || hasRunDetail).toBe(true);
  });

});
