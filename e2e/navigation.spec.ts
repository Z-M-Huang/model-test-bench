import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    // Wait for the sidebar to be visible (React has rendered)
    await expect(page.locator('aside')).toBeVisible({ timeout: 10000 });
  });

  test.describe('Sidebar navigation links', () => {
    const navItems = [
      { label: 'Dashboard', path: '/' },
      { label: 'Setups', path: '/setups' },
      { label: 'Scenarios', path: '/scenarios' },
      { label: 'New Run', path: '/run' },
      { label: 'Run History', path: '/history' },
    ];

    for (const { label, path } of navItems) {
      test(`sidebar link "${label}" navigates to ${path}`, async ({ page }) => {
        const link = page.locator('aside a', { hasText: label }).first();
        await link.click();
        if (path === '/') {
          await expect(page).toHaveURL(/\/$/);
        } else {
          await expect(page).toHaveURL(new RegExp(`${path}$`));
        }
      });
    }
  });

  test.describe('Active state highlighting', () => {
    test('Dashboard link is active on root page', async ({ page }) => {
      const dashboardLink = page.locator('aside a[href="/"]');
      await expect(dashboardLink).toHaveAttribute('aria-current', 'page');
    });

    test('Setups link is active on setups page', async ({ page }) => {
      await page.goto('/setups');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('aside')).toBeVisible({ timeout: 10000 });
      const setupsLink = page.locator('aside a[href="/setups"]');
      await expect(setupsLink).toHaveAttribute('aria-current', 'page');
      // Dashboard should not be active
      const dashboardLink = page.locator('aside a[href="/"]');
      await expect(dashboardLink).not.toHaveAttribute('aria-current', 'page');
    });

    test('Scenarios link is active on scenarios page', async ({ page }) => {
      await page.goto('/scenarios');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('aside')).toBeVisible({ timeout: 10000 });
      const scenariosLink = page.locator('aside a[href="/scenarios"]');
      await expect(scenariosLink).toHaveAttribute('aria-current', 'page');
    });
  });

  test('Create Scenario button in sidebar navigates to /scenarios/new', async ({ page }) => {
    const sidebar = page.locator('aside');
    await sidebar.locator('button', { hasText: 'Create Scenario' }).click();
    await expect(page).toHaveURL(/\/scenarios\/new$/);
  });

  test('New Setup card on dashboard navigates to /setups/new', async ({ page }) => {
    await page.locator('h3', { hasText: 'New Setup' }).first().click();
    await expect(page).toHaveURL(/\/setups\/new$/);
  });

  test('Start Run card on dashboard navigates to /run', async ({ page }) => {
    await page.locator('h3', { hasText: 'Start Run' }).first().click();
    await expect(page).toHaveURL(/\/run$/);
  });

  test('browser back/forward navigation works', async ({ page }) => {
    // Navigate Dashboard -> Setups -> Scenarios
    await page.locator('aside a', { hasText: 'Setups' }).first().click();
    await expect(page).toHaveURL(/\/setups$/);

    await page.locator('aside a', { hasText: 'Scenarios' }).first().click();
    await expect(page).toHaveURL(/\/scenarios$/);

    // Go back to Setups
    await page.goBack();
    await expect(page).toHaveURL(/\/setups$/);

    // Go back to Dashboard
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);

    // Go forward to Setups
    await page.goForward();
    await expect(page).toHaveURL(/\/setups$/);

    // Go forward to Scenarios
    await page.goForward();
    await expect(page).toHaveURL(/\/scenarios$/);
  });

  test.describe('Direct URL access', () => {
    const routes = [
      { path: '/', heading: 'Dashboard' },
      { path: '/setups', heading: 'Test Setups' },
      { path: '/setups/new', heading: 'New Setup' },
      { path: '/scenarios', heading: 'New Scenario' },
      { path: '/scenarios/new', heading: 'Create New Scenario' },
      { path: '/run', heading: 'New Run' },
      { path: '/history', heading: 'Run History' },
    ];

    for (const { path, heading } of routes) {
      test(`direct access to ${path} loads correctly`, async ({ page }) => {
        await page.goto(path);
        await page.waitForLoadState('domcontentloaded');
        await expect(page.getByText(heading, { exact: false }).first()).toBeVisible({ timeout: 10000 });
      });
    }
  });

  test('View All History link on dashboard navigates to /history', async ({ page }) => {
    await page.getByText('View All History').click();
    await expect(page).toHaveURL(/\/history$/);
  });
});
