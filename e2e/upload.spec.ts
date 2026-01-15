import { expect, TEST_CONFIG, test } from './fixtures';

const { testOrg } = TEST_CONFIG;

test.describe('Video Upload Page', () => {
  test.describe('Authenticated User', () => {
    test('should display upload page with form elements', async ({ authenticatedPage: page }) => {
      await page.goto(`/${testOrg}/upload`);
      await expect(page).toHaveURL(new RegExp(`/${testOrg}/upload`));

      // Check for upload page elements - heading is "Upload Videos" (plural)
      await expect(page.getByRole('heading', { name: /upload videos/i })).toBeVisible({ timeout: 15000 });
      // Description mentions various upload sources
      await expect(page.getByText(/upload videos from your computer/i)).toBeVisible();
    });

    test('should have back to videos link', async ({ authenticatedPage: page }) => {
      await page.goto(`/${testOrg}/upload`);
      await expect(page).toHaveURL(new RegExp(`/${testOrg}/upload`));

      await expect(page.getByRole('link', { name: /back to videos/i })).toBeVisible();
    });

    test('should navigate back to organization page', async ({ authenticatedPage: page }) => {
      await page.goto(`/${testOrg}/upload`);
      await expect(page).toHaveURL(new RegExp(`/${testOrg}/upload`));

      await page.getByRole('link', { name: /back to videos/i }).click();
      await expect(page).toHaveURL(new RegExp(`/${testOrg}$`));
    });

    test('should have drag and drop upload area', async ({ authenticatedPage: page }) => {
      await page.goto(`/${testOrg}/upload`);
      await expect(page).toHaveURL(new RegExp(`/${testOrg}/upload`));

      // Look for drop zone or file input area
      const dropZone = page.locator("[data-dropzone], .dropzone, [role='button']").first();
      const hasDropZone = await dropZone.isVisible().catch(() => false);

      // Also check for file input
      const fileInput = page.locator("input[type='file']");
      const hasFileInput = (await fileInput.count()) > 0;

      // At least one upload mechanism should exist
      expect(hasDropZone || hasFileInput).toBe(true);
    });
  });

  test.describe('Unauthenticated User', () => {
    test('should redirect when accessing upload page without auth', async ({ page }) => {
      await page.context().clearCookies();
      await page.goto(`/${testOrg}/upload`);

      // Should redirect to landing or login
      await page.waitForURL(/^\/$|\/login|\/auth/, { timeout: 10000 });
    });
  });
});

test.describe('Video Upload Flow', () => {
  test('upload area should respond to hover interactions', async ({ authenticatedPage: page }) => {
    await page.goto(`/${testOrg}/upload`);
    await expect(page).toHaveURL(new RegExp(`/${testOrg}/upload`));

    // Find clickable upload area
    const uploadArea = page.getByText(/drag and drop|click to upload|select files/i).first();
    if (await uploadArea.isVisible()) {
      // Verify it's interactive
      await uploadArea.hover();
      // The area should be visible and hoverable without errors
      await expect(uploadArea).toBeVisible();
    }
  });
});
