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
    await expect(page.getByText('Execution Setup')).toBeVisible();
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
    expect(optionCount).toBeGreaterThanOrEqual(1);
  });

  test('setup dropdown shows "No setups available" when no setups exist', async ({ page, request }) => {
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

  // --- Reviewer Setups section ---

  test('reviewer setups section is visible with add button', async ({ page }) => {
    await expect(page.getByText('Reviewer Setups')).toBeVisible();
    await expect(page.getByText('No reviewers')).toBeVisible();
    await expect(page.getByRole('button', { name: /Add/i }).first()).toBeVisible();
  });

  test('can add and remove reviewer setups', async ({ page, request }) => {
    const listRes = await request.get('/api/setups');
    const setups = await listRes.json();
    if (setups.length === 0) return; // skip if no setups

    // Add first reviewer
    const addBtn = page.locator('.bg-surface-container').filter({ hasText: 'Reviewer Setups' }).getByRole('button', { name: /Add/i });
    await addBtn.click();

    // "No reviewers" text should disappear
    await expect(page.getByText('No reviewers')).not.toBeVisible();

    // Should see a Synthesizer label (single reviewer = synthesizer)
    await expect(page.getByText('Synthesizer')).toBeVisible();

    // Should see max rounds slider
    await expect(page.getByText('Max Rounds')).toBeVisible();

    // Add a second reviewer
    await addBtn.click();

    // Should now see Evaluator + Synthesizer labels
    await expect(page.getByText('Evaluator', { exact: true })).toBeVisible();
    await expect(page.getByText('Synthesizer')).toBeVisible();

    // Remove the first reviewer
    const closeButtons = page.locator('.bg-surface-container').filter({ hasText: 'Reviewer Setups' }).locator('button:has(span:text("close"))');
    await closeButtons.first().click();

    // Should be back to one reviewer (Synthesizer only)
    await expect(page.getByText('Synthesizer')).toBeVisible();

    // Remove the last reviewer
    await page.locator('.bg-surface-container').filter({ hasText: 'Reviewer Setups' }).locator('button:has(span:text("close"))').click();

    // Should show "No reviewers" again
    await expect(page.getByText('No reviewers')).toBeVisible();
  });

  // --- Start Run interaction ---

  test('clicking Start Run does not crash the page', async ({ page, request }) => {
    // Ensure we have setups and scenarios
    const setupsRes = await request.get('/api/setups');
    const setups = await setupsRes.json();
    const scenariosRes = await request.get('/api/scenarios');
    const scenarios = await scenariosRes.json();
    if (setups.length === 0 || scenarios.length === 0) return;

    const startBtn = page.getByRole('button', { name: /Start Run/i });
    await expect(startBtn).toBeEnabled();
    await startBtn.click();

    // The run will fail (no real API keys) but the page should not crash.
    // The status bar should appear with "Pending" or "Abort" button visible.
    await expect(page.getByText(/Pending|Abort/i).first()).toBeVisible({ timeout: 10000 });

    // The page should still be functional (heading still visible)
    await expect(page.getByRole('heading', { name: 'New Run' })).toBeVisible();
  });

  test('clicking Start Run with reviewer setups does not crash', async ({ page, request }) => {
    const setupsRes = await request.get('/api/setups');
    const setups = await setupsRes.json();
    const scenariosRes = await request.get('/api/scenarios');
    const scenarios = await scenariosRes.json();
    if (setups.length === 0 || scenarios.length === 0) return;

    // Add a reviewer
    const addBtn = page.locator('.bg-surface-container').filter({ hasText: 'Reviewer Setups' }).getByRole('button', { name: /Add/i });
    await addBtn.click();
    await expect(page.getByText('Synthesizer')).toBeVisible();

    const startBtn = page.getByRole('button', { name: /Start Run/i });
    await startBtn.click();

    // Page should not crash — heading still visible
    await expect(page.getByRole('heading', { name: 'New Run' })).toBeVisible({ timeout: 10000 });
  });
});
