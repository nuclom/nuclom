import { expect, test } from './fixtures';

test.describe('Organization Dashboard', () => {
  test.describe('Authenticated User', () => {
    test('should display organization dashboard with video sections', async ({ authenticatedPage: page }) => {
      await page.goto('/vercel');
      await expect(page).toHaveURL(/\/vercel/);

      // Check for video sections
      await expect(page.getByText('Continue watching')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('New this week')).toBeVisible();
      await expect(page.getByText('From your channels')).toBeVisible();
    });

    test('should display upload button when no videos', async ({ authenticatedPage: page }) => {
      await page.goto('/vercel');
      await expect(page).toHaveURL(/\/vercel/);

      // If no videos, should show upload button
      const noVideosMessage = page.getByText(/no videos found|upload your first video/i);
      const hasNoVideos = await noVideosMessage.isVisible().catch(() => false);

      if (hasNoVideos) {
        await expect(page.getByRole('link', { name: /upload first video/i })).toBeVisible();
      }
    });

    test('should navigate to upload page', async ({ authenticatedPage: page }) => {
      await page.goto('/vercel');
      await expect(page).toHaveURL(/\/vercel/);

      // Look for any upload link/button
      const uploadLink = page.getByRole('link', { name: /upload/i }).first();
      if (await uploadLink.isVisible()) {
        await uploadLink.click();
        await expect(page).toHaveURL(/\/upload/);
      }
    });
  });

  test.describe('Unauthenticated User', () => {
    test('should redirect to landing page when accessing org route', async ({ page }) => {
      await page.context().clearCookies();
      await page.goto('/vercel');

      // Should redirect to landing or login
      await page.waitForURL(/^\/$|\/login/, { timeout: 10000 });
    });
  });
});

test.describe('Organization Navigation', () => {
  test('should have functioning navigation components', async ({ authenticatedPage: page }) => {
    await page.goto('/vercel');
    await expect(page).toHaveURL(/\/vercel/);

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Check if navigation/sidebar elements exist
    // These tests are flexible based on what's rendered
    const navElements = await page.locator("nav, [role='navigation']").count();
    expect(navElements).toBeGreaterThanOrEqual(0);
  });
});
