import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

test.describe('Provider CRUD flow', () => {
  // Track created provider IDs for cleanup
  const createdProviderIds: string[] = [];

  test.afterAll(async ({ request }) => {
    for (const id of createdProviderIds) {
      await request.delete(`/api/providers/${id}`).catch(() => {});
    }
  });

  test('provider list page loads with correct heading', async ({ page }) => {
    await page.goto('/providers');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: 'Providers' })).toBeVisible();
  });

  test('provider list shows empty state or table', async ({ page }) => {
    await page.goto('/providers');
    await page.waitForLoadState('domcontentloaded');
    // Either empty message or table with headers should appear
    const emptyMsg = page.getByText('No providers yet');
    const tableHeader = page.getByText('Name').first();
    const hasEmpty = await emptyMsg.isVisible().catch(() => false);
    const hasTable = await tableHeader.isVisible().catch(() => false);
    expect(hasEmpty || hasTable).toBe(true);
  });

  test('New Provider button navigates to /providers/new', async ({ page }) => {
    await page.goto('/providers');
    await page.waitForLoadState('domcontentloaded');
    await page.getByText('New Provider', { exact: false }).first().click();
    await expect(page).toHaveURL(/\/providers\/new$/);
  });

  test('provider editor loads with form sections', async ({ page }) => {
    await page.goto('/providers/new');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('New Provider').first()).toBeVisible();
    await expect(page.getByText('Basic Information')).toBeVisible();
    await expect(page.getByText('Provider Configuration')).toBeVisible();
  });

  test('can fill in basic fields', async ({ page }) => {
    await page.goto('/providers/new');
    await page.waitForLoadState('domcontentloaded');

    const nameInput = page.locator('input[placeholder="my-provider"]');
    await nameInput.fill('E2E Test Provider');
    await expect(nameInput).toHaveValue('E2E Test Provider');

    const descTextarea = page.locator('textarea[placeholder="Describe this provider..."]');
    await descTextarea.fill('A test provider created by E2E tests');
    await expect(descTextarea).toHaveValue('A test provider created by E2E tests');
  });

  test('API provider tab is selected by default and shows fields', async ({ page }) => {
    await page.goto('/providers/new');
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
    await page.goto('/providers/new');
    await page.waitForLoadState('domcontentloaded');

    const oauthTab = page.getByRole('button', { name: 'OAuth' });
    await oauthTab.click();

    // OAuth-specific fields should appear
    await expect(page.getByText('OAuth Token')).toBeVisible();
    // API-specific fields should be hidden
    await expect(page.getByText('Base URL')).not.toBeVisible();
  });

  test('can fill API provider fields', async ({ page }) => {
    await page.goto('/providers/new');
    await page.waitForLoadState('domcontentloaded');

    const baseUrlInput = page.locator('input[placeholder="https://api.anthropic.com"]');
    await expect(baseUrlInput).toHaveValue('https://api.anthropic.com');

    const apiKeyInput = page.locator('input[placeholder="sk-ant-..."]');
    await apiKeyInput.fill('sk-ant-test-key-12345');
    await expect(apiKeyInput).toHaveValue('sk-ant-test-key-12345');
  });

  test('Create Provider button is disabled when name is empty', async ({ page }) => {
    await page.goto('/providers/new');
    await page.waitForLoadState('domcontentloaded');

    const saveBtn = page.getByRole('button', { name: 'Create Provider' });
    await expect(saveBtn).toBeDisabled();
  });

  test('full create-edit-delete flow', async ({ page, request }) => {
    // Step 1: Create a provider via the form
    await page.goto('/providers/new');
    await page.waitForLoadState('domcontentloaded');
    // Wait for form to render
    await expect(page.getByText('Basic Information')).toBeVisible({ timeout: 10000 });

    await page.locator('input[placeholder="my-provider"]').fill('E2E CRUD Test Provider');
    await page.locator('textarea[placeholder="Describe this provider..."]').fill('For CRUD testing');
    await page.locator('input[placeholder="sk-ant-..."]').fill('sk-ant-test-crud-key');

    // Save and wait for the API response
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/providers') && res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Create Provider' }).click();
    const createRes = await responsePromise;
    expect(createRes.status()).toBe(201);

    const created = await createRes.json();
    createdProviderIds.push(created.id);

    // Should redirect to provider list
    await expect(page).toHaveURL(/\/providers$/);

    // New provider should appear in the list (wait for API data to load)
    await expect(page.getByText('E2E CRUD Test Provider')).toBeVisible({ timeout: 10000 });

    // Step 2: Edit the provider
    // Hover over the row to reveal action buttons
    const row = page.locator('tr', { hasText: 'E2E CRUD Test Provider' });
    await row.hover();
    await row.getByTitle('Edit').click();

    await expect(page).toHaveURL(new RegExp(`/providers/${created.id}/edit$`));
    await expect(page.getByText('Edit Provider')).toBeVisible({ timeout: 10000 });

    // Name should be pre-filled
    const nameInput = page.locator('input[placeholder="my-provider"]');
    await expect(nameInput).toHaveValue('E2E CRUD Test Provider');

    // Update name
    await nameInput.clear();
    await nameInput.fill('E2E CRUD Test Provider Updated');

    const updateResponsePromise = page.waitForResponse(
      (res) => res.url().includes(`/api/providers/${created.id}`) && res.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: 'Save Changes' }).click();
    const updateRes = await updateResponsePromise;
    expect(updateRes.status()).toBe(200);

    // Should redirect back to list
    await expect(page).toHaveURL(/\/providers$/);
    await expect(page.getByText('E2E CRUD Test Provider Updated')).toBeVisible({ timeout: 10000 });

    // Step 3: Delete the provider
    // Register dialog handler before triggering the confirm dialog
    let dialogSeen = false;
    page.once('dialog', async (dialog) => {
      dialogSeen = true;
      await dialog.accept();
    });

    const updatedRow = page.locator('tr', { hasText: 'E2E CRUD Test Provider Updated' });
    await updatedRow.hover();

    // Wait for the delete button to become visible (it's hidden by default, shown on hover)
    const deleteBtn = updatedRow.getByTitle('Delete');
    await expect(deleteBtn).toBeVisible({ timeout: 5000 });

    // Also intercept the delete API call
    const deleteResponsePromise = page.waitForResponse(
      (res) => res.url().includes(`/api/providers/${created.id}`) && res.request().method() === 'DELETE',
    );
    await deleteBtn.click();

    // Wait for the delete API response
    const deleteRes = await deleteResponsePromise;
    expect(deleteRes.status()).toBe(204);
    expect(dialogSeen).toBe(true);

    // Provider should disappear from list
    await expect(page.getByText('E2E CRUD Test Provider Updated')).not.toBeVisible({ timeout: 10000 });

    // Remove from cleanup list since it's already deleted
    const idx = createdProviderIds.indexOf(created.id);
    if (idx >= 0) createdProviderIds.splice(idx, 1);
  });

  test('cancel button returns to provider list', async ({ page }) => {
    await page.goto('/providers/new');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page).toHaveURL(/\/providers$/);
  });
});
