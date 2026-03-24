import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

test.describe('Setup CRUD flow', () => {
  // Track created setup IDs for cleanup
  const createdSetupIds: string[] = [];

  test.afterAll(async ({ request }) => {
    for (const id of createdSetupIds) {
      await request.delete(`/api/setups/${id}`).catch(() => {});
    }
  });

  test('setup list page loads with correct heading', async ({ page }) => {
    await page.goto('/setups');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Test Setups')).toBeVisible();
  });

  test('setup list shows empty state or table', async ({ page }) => {
    await page.goto('/setups');
    await page.waitForLoadState('domcontentloaded');
    // Either empty message or table with headers should appear
    const emptyMsg = page.getByText('No setups yet');
    const tableHeader = page.getByText('Name').first();
    const hasEmpty = await emptyMsg.isVisible().catch(() => false);
    const hasTable = await tableHeader.isVisible().catch(() => false);
    expect(hasEmpty || hasTable).toBe(true);
  });

  test('New Setup button navigates to /setups/new', async ({ page }) => {
    await page.goto('/setups');
    await page.waitForLoadState('domcontentloaded');
    await page.getByText('New Setup', { exact: false }).first().click();
    await expect(page).toHaveURL(/\/setups\/new$/);
  });

  test('setup editor loads with form sections', async ({ page }) => {
    await page.goto('/setups/new');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('New Setup').first()).toBeVisible();
    await expect(page.getByText('Basic Information')).toBeVisible();
    await expect(page.getByText('Provider Configuration')).toBeVisible();
  });

  test('can fill in basic fields', async ({ page }) => {
    await page.goto('/setups/new');
    await page.waitForLoadState('domcontentloaded');

    const nameInput = page.locator('input[placeholder="my-test-setup"]');
    await nameInput.fill('E2E Test Setup');
    await expect(nameInput).toHaveValue('E2E Test Setup');

    const descTextarea = page.locator('textarea[placeholder="Describe this setup..."]');
    await descTextarea.fill('A test setup created by E2E tests');
    await expect(descTextarea).toHaveValue('A test setup created by E2E tests');
  });

  test('API provider tab is selected by default and shows fields', async ({ page }) => {
    await page.goto('/setups/new');
    await page.waitForLoadState('domcontentloaded');

    // API tab button should have active styling
    const apiTab = page.getByRole('button', { name: 'API' });
    await expect(apiTab).toBeVisible();

    // API-specific fields should be visible
    await expect(page.getByText('Base URL')).toBeVisible();
    await expect(page.getByText('API Key')).toBeVisible();
    await expect(page.getByText('Model').first()).toBeVisible();
  });

  test('can switch to OAuth provider tab', async ({ page }) => {
    await page.goto('/setups/new');
    await page.waitForLoadState('domcontentloaded');

    const oauthTab = page.getByRole('button', { name: 'OAuth' });
    await oauthTab.click();

    // OAuth-specific fields should appear
    await expect(page.getByText('OAuth Token')).toBeVisible();
    // API-specific fields should be hidden
    await expect(page.getByText('Base URL')).not.toBeVisible();
  });

  test('can fill API provider fields', async ({ page }) => {
    await page.goto('/setups/new');
    await page.waitForLoadState('domcontentloaded');

    const baseUrlInput = page.locator('input[placeholder="https://api.anthropic.com"]');
    await expect(baseUrlInput).toHaveValue('https://api.anthropic.com');

    const apiKeyInput = page.locator('input[placeholder="sk-ant-..."]');
    await apiKeyInput.fill('sk-ant-test-key-12345');
    await expect(apiKeyInput).toHaveValue('sk-ant-test-key-12345');
  });

  test('Create Setup button is disabled when name is empty', async ({ page }) => {
    await page.goto('/setups/new');
    await page.waitForLoadState('domcontentloaded');

    const saveBtn = page.getByRole('button', { name: 'Create Setup' });
    await expect(saveBtn).toBeDisabled();
  });

  test('full create-edit-delete flow', async ({ page, request }) => {
    // Step 1: Create a setup via the form
    await page.goto('/setups/new');
    await page.waitForLoadState('domcontentloaded');
    // Wait for form to render
    await expect(page.getByText('Basic Information')).toBeVisible({ timeout: 10000 });

    await page.locator('input[placeholder="my-test-setup"]').fill('E2E CRUD Test Setup');
    await page.locator('textarea[placeholder="Describe this setup..."]').fill('For CRUD testing');
    await page.locator('input[placeholder="sk-ant-..."]').fill('sk-ant-test-crud-key');

    // Save and wait for the API response
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/setups') && res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Create Setup' }).click();
    const createRes = await responsePromise;
    expect(createRes.status()).toBe(201);

    const created = await createRes.json();
    createdSetupIds.push(created.id);

    // Should redirect to setup list
    await expect(page).toHaveURL(/\/setups$/);

    // New setup should appear in the list (wait for API data to load)
    await expect(page.getByText('E2E CRUD Test Setup')).toBeVisible({ timeout: 10000 });

    // Step 2: Edit the setup
    // Hover over the row to reveal action buttons
    const row = page.locator('tr', { hasText: 'E2E CRUD Test Setup' });
    await row.hover();
    await row.getByTitle('Edit').click();

    await expect(page).toHaveURL(new RegExp(`/setups/${created.id}/edit$`));
    await expect(page.getByText('Edit Setup')).toBeVisible({ timeout: 10000 });

    // Name should be pre-filled
    const nameInput = page.locator('input[placeholder="my-test-setup"]');
    await expect(nameInput).toHaveValue('E2E CRUD Test Setup');

    // Update name
    await nameInput.clear();
    await nameInput.fill('E2E CRUD Test Setup Updated');

    const updateResponsePromise = page.waitForResponse(
      (res) => res.url().includes(`/api/setups/${created.id}`) && res.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: 'Save Changes' }).click();
    const updateRes = await updateResponsePromise;
    expect(updateRes.status()).toBe(200);

    // Should redirect back to list
    await expect(page).toHaveURL(/\/setups$/);
    await expect(page.getByText('E2E CRUD Test Setup Updated')).toBeVisible({ timeout: 10000 });

    // Step 3: Delete the setup
    // Register dialog handler before triggering the confirm dialog
    let dialogSeen = false;
    page.once('dialog', async (dialog) => {
      dialogSeen = true;
      await dialog.accept();
    });

    const updatedRow = page.locator('tr', { hasText: 'E2E CRUD Test Setup Updated' });
    await updatedRow.hover();

    // Wait for the delete button to become visible (it's hidden by default, shown on hover)
    const deleteBtn = updatedRow.getByTitle('Delete');
    await expect(deleteBtn).toBeVisible({ timeout: 5000 });

    // Also intercept the delete API call
    const deleteResponsePromise = page.waitForResponse(
      (res) => res.url().includes(`/api/setups/${created.id}`) && res.request().method() === 'DELETE',
    );
    await deleteBtn.click();

    // Wait for the delete API response
    const deleteRes = await deleteResponsePromise;
    expect(deleteRes.status()).toBe(204);
    expect(dialogSeen).toBe(true);

    // Setup should disappear from list
    await expect(page.getByText('E2E CRUD Test Setup Updated')).not.toBeVisible({ timeout: 10000 });

    // Remove from cleanup list since it's already deleted
    const idx = createdSetupIds.indexOf(created.id);
    if (idx >= 0) createdSetupIds.splice(idx, 1);
  });

  test('cancel button returns to setup list', async ({ page }) => {
    await page.goto('/setups/new');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page).toHaveURL(/\/setups$/);
  });
});
