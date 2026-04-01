import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * UAT-6: Full end-to-end workflow — Create provider, create scenario, start a run.
 *
 * This test exercises the complete UI flow. Without real API credentials the run
 * will fail after starting, but we verify the UI reaches the run-in-progress state.
 */
test.describe('Full workflow (UAT-6)', () => {
  let providerId: string;
  let scenarioId: string;

  test.afterAll(async ({ request }) => {
    // Clean up created resources (best-effort)
    if (scenarioId) await request.delete(`/api/scenarios/${scenarioId}`).catch(() => {});
    if (providerId) await request.delete(`/api/providers/${providerId}`).catch(() => {});
  });

  test('create provider -> create scenario -> start run', async ({ page, request }) => {
    // -----------------------------------------------------------------------
    // Step 1: Create a provider via the API
    // -----------------------------------------------------------------------
    const providerRes = await request.post('/api/providers', {
      data: {
        name: 'E2E Workflow Provider',
        description: 'Created by full-workflow E2E test',
        providerName: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        apiKey: process.env.ANTHROPIC_API_KEY ?? 'sk-placeholder-for-e2e',
        timeoutSeconds: 60,
      },
    });
    expect(providerRes.status()).toBe(201);
    const provider = await providerRes.json();
    providerId = provider.id;
    expect(provider.name).toBe('E2E Workflow Provider');

    // -----------------------------------------------------------------------
    // Step 2: Create a scenario via the API
    // -----------------------------------------------------------------------
    const scenarioRes = await request.post('/api/scenarios', {
      data: {
        name: 'E2E Workflow Scenario',
        category: 'reasoning',
        prompt: 'What is 2 + 2? Answer with just the number.',
        systemPrompt: 'You are a helpful math assistant.',
        enabledTools: ['read_file'],
        expectedAnswer: '4',
        criticalRequirements: ['Must respond with the number 4'],
        gradingGuidelines: 'Award full marks for a correct, concise answer.',
        scoringDimensions: [
          { name: 'Accuracy', weight: 1.0, description: 'Is the answer correct?' },
        ],
      },
    });
    expect(scenarioRes.status()).toBe(201);
    const scenario = await scenarioRes.json();
    scenarioId = scenario.id;
    expect(scenario.name).toBe('E2E Workflow Scenario');

    // -----------------------------------------------------------------------
    // Step 3: Verify the provider and scenario appear in their list pages
    // -----------------------------------------------------------------------
    await page.goto('/providers');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Providers' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('E2E Workflow Provider')).toBeVisible({ timeout: 10000 });

    await page.goto('/scenarios');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('button', { hasText: 'New Scenario' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('E2E Workflow Scenario')).toBeVisible({ timeout: 10000 });

    // -----------------------------------------------------------------------
    // Step 4: Navigate to /run, select provider and scenario, start the run
    // -----------------------------------------------------------------------
    await page.goto('/run');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: 'New Run' })).toBeVisible({ timeout: 10000 });

    // Select the provider we just created
    const providerSelect = page.locator('select').first();
    await providerSelect.selectOption(providerId);

    // Select the scenario we just created
    const scenarioSelect = page.locator('select').nth(1);
    await scenarioSelect.selectOption(scenarioId);

    // Click Start Run
    const startBtn = page.getByRole('button', { name: /Start Run/i });
    await expect(startBtn).toBeEnabled();
    await startBtn.click();

    // The run will likely fail (no real API key), but the UI should show
    // a running/pending/failed status — NOT crash.
    // The app may navigate to the run detail page after starting.
    // Wait for a status indicator to appear (on either the run page or run detail page).
    await expect(
      page.getByText(/Pending|Abort|Running|Failed|Error/i).first(),
    ).toBeVisible({ timeout: 15000 });

    // Page heading should still be intact (no crash).
    // After starting a run the app may stay on /run or navigate to /runs/:id (Run Detail).
    const hasNewRun = await page.getByRole('heading', { name: 'New Run' }).isVisible().catch(() => false);
    const hasRunDetail = await page.getByRole('heading', { name: 'Run Detail' }).isVisible().catch(() => false);
    expect(hasNewRun || hasRunDetail).toBe(true);
  });
});
