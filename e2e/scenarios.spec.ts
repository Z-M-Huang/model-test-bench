import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

/** Navigate to /scenarios and wait for the scenario list to load. */
async function gotoScenarioList(page: import('@playwright/test').Page) {
  await page.goto('/scenarios');
  await page.waitForLoadState('domcontentloaded');
  // Wait for scenarios to load -- either a category heading or the "New Scenario" button appears.
  // The "New Scenario" button is rendered immediately and doesn't depend on API data.
  await expect(
    page.locator('button', { hasText: 'New Scenario' }),
  ).toBeVisible({ timeout: 10000 });
  // Then wait for loading to finish (either categories appear or empty state)
  await expect(page.getByText('Loading scenarios...')).not.toBeVisible({ timeout: 10000 });
}

test.describe('Scenario features', () => {
  const createdScenarioIds: string[] = [];

  test.afterAll(async ({ request }) => {
    for (const id of createdScenarioIds) {
      await request.delete(`/api/scenarios/${id}`).catch(() => {});
    }
  });

  test('scenario list page loads with category groups', async ({ page }) => {
    await gotoScenarioList(page);
    // The page shows category sections with headings
    const categoryHeadings = [
      'Reasoning & Logic',
      'Instruction Following',
      'Planning & Strategy',
      'Tool Strategy',
      'Error Handling',
      'Ambiguity Handling',
      'Scope Management',
    ];
    let foundCount = 0;
    for (const heading of categoryHeadings) {
      const el = page.getByText(heading, { exact: true });
      if (await el.isVisible().catch(() => false)) {
        foundCount++;
      }
    }
    // Should have at least a few categories with built-in scenarios
    expect(foundCount).toBeGreaterThanOrEqual(1);
  });

  test('built-in scenarios are visible', async ({ page }) => {
    await gotoScenarioList(page);
    // Built-in scenarios show a "Built-in" badge
    const builtInBadges = page.getByText('Built-in');
    const count = await builtInBadges.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('clicking a built-in scenario opens it in read-only mode', async ({ page }) => {
    await gotoScenarioList(page);

    // Click the first scenario card -- use the card's h3 name
    const firstCardName = page.locator('section h3').first();
    await firstCardName.click();

    // Should navigate to /scenarios/:id
    await expect(page).toHaveURL(/\/scenarios\/[a-f0-9-]+$/);

    // Wait for scenario editor to load
    await expect(page.getByText('View Scenario')).toBeVisible({ timeout: 10000 });
    // Should say read-only
    await expect(page.getByText('This built-in scenario is read-only.')).toBeVisible();

    // Save button should NOT be present for read-only
    await expect(page.getByRole('button', { name: 'Save Scenario' })).not.toBeVisible();
  });

  test('New Scenario button navigates to /scenarios/new', async ({ page }) => {
    await gotoScenarioList(page);
    await page.locator('button', { hasText: 'New Scenario' }).first().click();
    await expect(page).toHaveURL(/\/scenarios\/new$/);
  });

  test('scenario editor loads with all form sections', async ({ page }) => {
    await page.goto('/scenarios/new');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Create New Scenario')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Basic Information')).toBeVisible();
    await expect(page.getByText('User Prompt')).toBeVisible();
    await expect(page.getByText('Workspace Files')).toBeVisible();
    await expect(page.getByText('Critical Requirements')).toBeVisible();
    await expect(page.getByText('Expected Answer')).toBeVisible();
    await expect(page.getByText('Grading & Scoring')).toBeVisible();
  });

  test('can fill scenario name and select category', async ({ page }) => {
    await page.goto('/scenarios/new');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Create New Scenario')).toBeVisible({ timeout: 10000 });

    const nameInput = page.locator('input[placeholder*="complex_math"]');
    await nameInput.fill('E2E Test Scenario');
    await expect(nameInput).toHaveValue('E2E Test Scenario');

    const categorySelect = page.locator('select');
    await categorySelect.selectOption('custom');
    await expect(categorySelect).toHaveValue('custom');
  });

  test('can add workspace files', async ({ page }) => {
    await page.goto('/scenarios/new');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Create New Scenario')).toBeVisible({ timeout: 10000 });

    // Find the Workspace Files section and click its Add button
    // The DynamicList "Add" button is inside a div that follows the SectionHead with "Workspace Files"
    const wsSection = page.locator('section').filter({ hasText: 'Workspace Files' }).last();
    await wsSection.locator('button', { hasText: 'Add' }).click();

    // A file entry should appear with path and content inputs
    const pathInput = page.locator('input[placeholder*="src/path"]');
    await expect(pathInput).toBeVisible();
    await pathInput.fill('src/test.ts');
    await expect(pathInput).toHaveValue('src/test.ts');
  });

  test('can add critical requirements', async ({ page }) => {
    await page.goto('/scenarios/new');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Create New Scenario')).toBeVisible({ timeout: 10000 });

    // The Critical Requirements section is a div inside a section in the left column.
    // The DynamicList's "Add" button is the one inside the same container as "Critical Requirements".
    // Use a more specific locator: find the section that contains "Critical Requirements" heading
    const crSection = page.locator('.bg-surface-container', { hasText: 'Critical Requirements' });
    await crSection.locator('button', { hasText: 'Add' }).click();

    // A requirement input should appear
    const reqInput = page.locator('input[placeholder="Requirement..."]');
    await expect(reqInput).toBeVisible();
    await reqInput.fill('Must handle edge cases');
    await expect(reqInput).toHaveValue('Must handle edge cases');
  });

  test('can add scoring dimensions with weights', async ({ page }) => {
    await page.goto('/scenarios/new');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Create New Scenario')).toBeVisible({ timeout: 10000 });

    // Find the Scoring Dimensions section
    const scoringSection = page.locator('div', { hasText: 'Scoring Dimensions' }).last();
    await scoringSection.getByText('Add').click();

    // Fill dimension name
    const dimNameInput = page.locator('input[placeholder="Dimension name"]');
    await expect(dimNameInput).toBeVisible();
    await dimNameInput.fill('Code Quality');

    // Fill weight
    const weightInput = page.locator('input[type="number"][step="0.1"]');
    await weightInput.fill('0.5');
  });

  test('weight indicator shows sum and changes color', async ({ page }) => {
    await page.goto('/scenarios/new');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Create New Scenario')).toBeVisible({ timeout: 10000 });

    // Weight Sum label should be visible
    await expect(page.getByText('Weight Sum')).toBeVisible();

    // Initially 0.00 (no dimensions)
    const weightDisplay = page.locator('.font-mono.text-xs.font-bold').last();
    await expect(weightDisplay).toHaveText('0.00');

    // Add a dimension with weight 0.5 -- should show error color (not 1.0)
    const scoringSection = page.locator('div', { hasText: 'Scoring Dimensions' }).last();
    await scoringSection.getByText('Add').click();
    const weightInput = page.locator('input[type="number"][step="0.1"]');
    await weightInput.fill('0.5');
    // Wait for state update
    await page.waitForTimeout(300);

    // Weight sum should be 0.50, shown in error color (text-error)
    const indicator = page.locator('.font-mono.text-xs.font-bold').last();
    await expect(indicator).toHaveText('0.50');
    await expect(indicator).toHaveClass(/text-error/);

    // Add another dimension with weight 0.5 -- sum should be 1.00 (valid)
    await scoringSection.getByText('Add').click();
    const weightInputs = page.locator('input[type="number"][step="0.1"]');
    await weightInputs.nth(1).fill('0.5');
    await page.waitForTimeout(300);

    await expect(indicator).toHaveText('1.00');
    await expect(indicator).toHaveClass(/text-primary/);
  });

  test('full create-edit-delete flow for custom scenario', async ({ page, request }) => {
    // Step 1: Create scenario
    await page.goto('/scenarios/new');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Create New Scenario')).toBeVisible({ timeout: 10000 });

    await page.locator('input[placeholder*="complex_math"]').fill('E2E Custom Scenario');
    await page.locator('select').selectOption('custom');

    // Fill the prompt via the CodeEditor textarea
    const promptTextarea = page.locator('textarea[placeholder="Enter the user test prompt here..."]');
    await promptTextarea.fill('This is a test prompt for E2E testing');

    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/scenarios') && res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Save Scenario' }).click();
    const createRes = await responsePromise;
    expect(createRes.status()).toBe(201);

    const created = await createRes.json();
    createdScenarioIds.push(created.id);

    // Should redirect to the created scenario's page
    await expect(page).toHaveURL(new RegExp(`/scenarios/${created.id}$`));

    // Step 2: Verify it appears in the list
    await page.goto('/scenarios');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('E2E Custom Scenario')).toBeVisible({ timeout: 10000 });

    // Step 3: Edit the scenario
    await page.getByText('E2E Custom Scenario').click();
    await expect(page).toHaveURL(new RegExp(`/scenarios/${created.id}$`));

    // Wait for the editor to load
    await expect(page.getByText('Edit Scenario')).toBeVisible({ timeout: 10000 });

    // Update name
    const nameInput = page.locator('input[placeholder*="complex_math"]');
    await nameInput.clear();
    await nameInput.fill('E2E Custom Scenario Updated');

    const updatePromise = page.waitForResponse(
      (res) => res.url().includes(`/api/scenarios/${created.id}`) && res.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: 'Save Scenario' }).click();
    const updateRes = await updatePromise;
    expect(updateRes.status()).toBe(200);

    // Step 4: Delete via API (UI delete not exposed in scenario editor, so use API)
    const deleteRes = await request.delete(`/api/scenarios/${created.id}`);
    expect(deleteRes.status()).toBe(204);

    // Remove from cleanup since already deleted
    const idx = createdScenarioIds.indexOf(created.id);
    if (idx >= 0) createdScenarioIds.splice(idx, 1);

    // Verify it's gone from the list
    await page.goto('/scenarios');
    await page.waitForLoadState('domcontentloaded');
    // Wait for scenario data to load first
    await expect(page.locator('button', { hasText: 'New Scenario' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Loading scenarios...')).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText('E2E Custom Scenario Updated')).not.toBeVisible();
  });

  test('built-in scenario fields are read-only', async ({ page }) => {
    await gotoScenarioList(page);

    // Click the first built-in scenario -- use the h3 inside a section
    const firstCardName = page.locator('section h3').first();
    await firstCardName.click();

    // Wait for scenario editor to load
    await expect(page.getByText('View Scenario')).toBeVisible({ timeout: 10000 });

    // Name field should be read-only
    const nameInput = page.locator('input[placeholder*="complex_math"]');
    await expect(nameInput).toHaveAttribute('readonly', '');

    // Category select should be disabled
    const categorySelect = page.locator('select');
    await expect(categorySelect).toBeDisabled();
  });

  test('cannot delete built-in scenario via API', async ({ request }) => {
    // Get all scenarios
    const listRes = await request.get('/api/scenarios');
    const scenarios = await listRes.json();
    const builtIn = scenarios.find((s: { builtIn: boolean }) => s.builtIn);
    if (!builtIn) {
      test.skip();
      return;
    }

    const deleteRes = await request.delete(`/api/scenarios/${builtIn.id}`);
    expect(deleteRes.status()).toBe(403);
  });

  test('discard button returns to scenario list', async ({ page }) => {
    await page.goto('/scenarios/new');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Create New Scenario')).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Discard' }).click();
    await expect(page).toHaveURL(/\/scenarios$/);
  });
});
