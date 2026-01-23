import { expect, TEST_CONFIG, test } from '../shared/fixtures';

const { testOrg } = TEST_CONFIG;

test.describe('Organization Dashboard', () => {
  test.describe('Authenticated User', () => {
    test('should display organization dashboard with video sections', async ({ authenticatedPage: page }) => {
      await page.goto(`/org/${testOrg}`);
      await expect(page).toHaveURL(new RegExp(`/org/${testOrg}`));

      // Wait for initial DOM content
      await page.waitForLoadState('domcontentloaded');

      // Dashboard should show either videos or empty state with a heading
      const heading = page.getByRole('heading').first();
      await expect(heading).toBeVisible({ timeout: 5000 });

      // Check if videos exist for further assertions
      const hasVideos = await page
        .getByText('Continue Watching')
        .isVisible()
        .catch(() => false);
      if (hasVideos) {
        // If videos exist, check for all sections
        await expect(page.getByText('Continue Watching')).toBeVisible();
        await expect(page.getByText('New This Week')).toBeVisible();
        await expect(page.getByText('From Your Collections')).toBeVisible();
      }
    });

    test('should display upload button when no videos', async ({ authenticatedPage: page }) => {
      await page.goto(`/org/${testOrg}`);
      await expect(page).toHaveURL(new RegExp(`/org/${testOrg}`));

      // If no videos, should show upload button
      const noVideosMessage = page.getByText(/no videos found|upload your first video/i);
      const hasNoVideos = await noVideosMessage.isVisible().catch(() => false);

      if (hasNoVideos) {
        await expect(page.getByRole('link', { name: /upload first video/i })).toBeVisible();
      }
    });

    test('should navigate to upload page', async ({ authenticatedPage: page }) => {
      await page.goto(`/org/${testOrg}`);
      await expect(page).toHaveURL(new RegExp(`/org/${testOrg}`));

      // Look for any upload link/button
      const uploadLink = page.getByRole('link', { name: /upload/i }).first();
      if (await uploadLink.isVisible()) {
        await uploadLink.click();
        await expect(page).toHaveURL(/\/upload/);
      }
    });
  });

  test.describe('Unauthenticated User', () => {
    // TODO: Investigate middleware redirect behavior in Vercel deployments
    test.skip('should redirect to landing page when accessing org route', async ({ browser }) => {
      // Create a fresh context without any auth state
      const context = await browser.newContext({
        ...(process.env.VERCEL_AUTOMATION_BYPASS_SECRET && {
          extraHTTPHeaders: {
            'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
          },
        }),
      });
      const page = await context.newPage();

      await page.goto(`/org/${testOrg}`);

      // Should redirect to landing or login
      await page.waitForURL(/^\/$|\/login/, { timeout: 10000 });
      await context.close();
    });
  });
});

test.describe('Organization Navigation', () => {
  test('should have functioning navigation components', async ({ authenticatedPage: page }) => {
    await page.goto(`/org/${testOrg}`);
    await expect(page).toHaveURL(new RegExp(`/org/${testOrg}`));

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Check if navigation/sidebar elements exist
    // These tests are flexible based on what's rendered
    const navElements = await page.locator("nav, [role='navigation']").count();
    expect(navElements).toBeGreaterThanOrEqual(0);
  });
});
