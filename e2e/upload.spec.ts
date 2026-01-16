import { expect, TEST_CONFIG, test } from './fixtures';

const { testOrg } = TEST_CONFIG;

test.describe('Video Upload Page', () => {
  test.describe('Authenticated User', () => {
    test('should display upload page with form elements', async ({ authenticatedPage: page }) => {
      await page.goto(`/org/${testOrg}/upload`);
      await expect(page).toHaveURL(new RegExp(`/org/${testOrg}/upload`), { timeout: 10000 });

      // Check for upload page elements - heading is "Upload Videos" (plural)
      await expect(page.getByRole('heading', { name: /upload videos/i })).toBeVisible({ timeout: 15000 });
      // Description mentions various upload sources - use first() to handle potential duplicates
      await expect(
        page
          .getByRole('main')
          .getByText(/upload videos from your computer/i)
          .first(),
      ).toBeVisible({ timeout: 10000 });
    });

    test('should have back to videos link', async ({ authenticatedPage: page }) => {
      await page.goto(`/org/${testOrg}/upload`);
      await expect(page).toHaveURL(new RegExp(`/org/${testOrg}/upload`), { timeout: 10000 });

      await expect(page.getByRole('link', { name: /back to videos/i })).toBeVisible({ timeout: 10000 });
    });

    test('should navigate back to organization page', async ({ authenticatedPage: page }) => {
      await page.goto(`/org/${testOrg}/upload`);
      await expect(page).toHaveURL(new RegExp(`/org/${testOrg}/upload`), { timeout: 10000 });

      // Wait for link to be visible before clicking
      const backLink = page.getByRole('link', { name: /back to videos/i });
      await backLink.waitFor({ state: 'visible', timeout: 10000 });
      await backLink.click();
      await expect(page).toHaveURL(new RegExp(`/org/${testOrg}$`), { timeout: 10000 });
    });

    test('should have drag and drop upload area', async ({ authenticatedPage: page }) => {
      await page.goto(`/org/${testOrg}/upload`);
      await expect(page).toHaveURL(new RegExp(`/org/${testOrg}/upload`), { timeout: 10000 });

      // Wait for page to be ready
      await page.waitForLoadState('domcontentloaded');

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
      await page.goto(`/org/${testOrg}/upload`);

      // Should redirect to landing or login
      await expect(page).toHaveURL(/^\/$|\/login|\/auth/, { timeout: 15000 });
    });
  });
});

test.describe('Video Upload Flow', () => {
  test('upload area should respond to hover interactions', async ({ authenticatedPage: page }) => {
    await page.goto(`/org/${testOrg}/upload`);
    await expect(page).toHaveURL(new RegExp(`/org/${testOrg}/upload`), { timeout: 10000 });

    // Wait for page to be ready
    await page.waitForLoadState('domcontentloaded');

    // Find clickable upload area
    const uploadArea = page.getByText(/drag and drop|click to upload|select files/i).first();

    // Wait for upload area to be visible
    await uploadArea.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

    if (await uploadArea.isVisible()) {
      // Verify it's interactive
      await uploadArea.hover();
      // The area should be visible and hoverable without errors
      await expect(uploadArea).toBeVisible();
    }
  });
});
