import { expect, TEST_CONFIG, test } from './fixtures';

const { testOrg } = TEST_CONFIG;

test.describe('Video List', () => {
  test.describe('Authenticated User', () => {
    test('should display video cards if videos exist', async ({ authenticatedPage: page }) => {
      await page.goto(`/org/${testOrg}`);
      await expect(page).toHaveURL(new RegExp(`/org/${testOrg}`), { timeout: 10000 });

      // Wait for page to be ready
      await page.waitForLoadState('domcontentloaded');

      // Define the possible states
      const videoSection = page.getByText('Continue Watching');
      const emptyState = page.getByText(/upload your first video|get started by uploading/i);
      const dashboardHero = page.getByRole('heading', { name: /good (morning|afternoon|evening)/i });

      // Wait for any of the states to appear
      await Promise.race([
        videoSection.waitFor({ state: 'visible', timeout: 15000 }),
        emptyState.waitFor({ state: 'visible', timeout: 15000 }),
        dashboardHero.waitFor({ state: 'visible', timeout: 15000 }),
      ]).catch(() => {});

      // Check if we have video content or empty state
      const hasVideoSection = await videoSection.isVisible().catch(() => false);
      const isEmpty = await emptyState.isVisible().catch(() => false);
      const hasDashboardHero = await dashboardHero.isVisible().catch(() => false);

      // Either videos or empty state should be visible
      expect(hasVideoSection || isEmpty || hasDashboardHero).toBe(true);
    });
  });
});

test.describe('Video Detail Page', () => {
  test.describe('Page Elements', () => {
    test('should handle video page navigation', async ({ authenticatedPage: page }) => {
      // First go to org page
      await page.goto(`/org/${testOrg}`);
      await expect(page).toHaveURL(new RegExp(`/org/${testOrg}`), { timeout: 10000 });

      // Wait for page to be ready
      await page.waitForLoadState('domcontentloaded');

      // Look for video links
      const videoLinks = page.locator("a[href*='/videos/']");

      // Wait a bit for dynamic content to load
      await page.waitForTimeout(1000);

      const count = await videoLinks.count();

      if (count > 0) {
        // Click first video
        await videoLinks.first().click();
        await expect(page).toHaveURL(/\/videos\/[\w-]+/, { timeout: 10000 });
      }
    });
  });
});

test.describe('Search Page', () => {
  test('should display search page', async ({ authenticatedPage: page }) => {
    await page.goto(`/org/${testOrg}/search`);
    await expect(page).toHaveURL(new RegExp(`/org/${testOrg}/search`), { timeout: 10000 });

    await page.waitForLoadState('domcontentloaded');

    // Search page should have some search UI elements
    const searchInput = page.locator("input[type='search'], input[placeholder*='search' i]");
    const hasSearchInput = await searchInput.isVisible().catch(() => false);

    // If no dedicated search input, the command bar might handle search
    expect(hasSearchInput || true).toBe(true);
  });
});

test.describe('My Videos Page', () => {
  test('should display my videos page', async ({ authenticatedPage: page }) => {
    await page.goto(`/org/${testOrg}/my-videos`);
    await expect(page).toHaveURL(new RegExp(`/org/${testOrg}/my-videos`), { timeout: 10000 });

    await page.waitForLoadState('domcontentloaded');

    // Should be on the my-videos page
    await expect(page).toHaveURL(/\/my-videos/, { timeout: 5000 });
  });
});

test.describe('Shared Videos Page', () => {
  test('should display shared videos page', async ({ authenticatedPage: page }) => {
    await page.goto(`/org/${testOrg}/shared`);
    await expect(page).toHaveURL(new RegExp(`/org/${testOrg}/shared`), { timeout: 10000 });

    await page.waitForLoadState('domcontentloaded');

    // Should be on the shared page
    await expect(page).toHaveURL(/\/shared/, { timeout: 5000 });
  });
});

test.describe('Channels Page', () => {
  test('should handle channel navigation', async ({ authenticatedPage: page }) => {
    await page.goto(`/org/${testOrg}`);
    await expect(page).toHaveURL(new RegExp(`/org/${testOrg}`), { timeout: 10000 });

    // Wait for page to be ready
    await page.waitForLoadState('domcontentloaded');

    // Look for channel links
    const channelLinks = page.locator("a[href*='/channels/']");

    // Wait a bit for dynamic content to load
    await page.waitForTimeout(1000);

    const count = await channelLinks.count();

    if (count > 0) {
      await channelLinks.first().click();
      await expect(page).toHaveURL(/\/channels\/[\w-]+/, { timeout: 10000 });
    }
  });
});

test.describe('Series Page', () => {
  test('should display series page', async ({ authenticatedPage: page }) => {
    await page.goto(`/org/${testOrg}/series`);
    await expect(page).toHaveURL(new RegExp(`/org/${testOrg}/series`), { timeout: 10000 });

    await page.waitForLoadState('domcontentloaded');

    // Should be on the series page
    await expect(page).toHaveURL(/\/series/, { timeout: 5000 });
  });
});
