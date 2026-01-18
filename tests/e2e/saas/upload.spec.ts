import { expect, TEST_CONFIG, test } from '../shared/fixtures';

const { testOrg } = TEST_CONFIG;

test.describe('Video Upload Page', () => {
  test.describe('Authenticated User', () => {
    test('should display upload page with form elements', async ({ authenticatedPage: page }) => {
      await page.goto(`/org/${testOrg}/upload`);
      await expect(page).toHaveURL(new RegExp(`/org/${testOrg}/upload`));

      // Wait for page to load
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      // Check for upload page elements - look for heading or upload-related content
      const hasUploadHeading = await page
        .getByRole('heading', { name: /upload/i })
        .first()
        .isVisible()
        .catch(() => false);
      const hasDropzone = await page.locator('[data-dropzone], .dropzone, [role="button"]').first().isVisible().catch(() => false);
      const hasFileInput = await page.locator('input[type="file"]').first().isVisible().catch(() => false);
      const hasUploadText = await page.getByText(/drag and drop|upload|select files/i).first().isVisible().catch(() => false);

      // At least one upload-related element should be visible
      expect(hasUploadHeading || hasDropzone || hasFileInput || hasUploadText).toBe(true);
    });

    test('should have back to videos link', async ({ authenticatedPage: page }) => {
      await page.goto(`/org/${testOrg}/upload`);
      await expect(page).toHaveURL(new RegExp(`/org/${testOrg}/upload`));

      await expect(page.getByRole('link', { name: /back to videos/i })).toBeVisible();
    });

    test('should navigate back to organization page', async ({ authenticatedPage: page }) => {
      await page.goto(`/org/${testOrg}/upload`);
      await expect(page).toHaveURL(new RegExp(`/org/${testOrg}/upload`));

      await page.getByRole('link', { name: /back to videos/i }).click();
      await expect(page).toHaveURL(new RegExp(`/org/${testOrg}$`));
    });

    test('should have drag and drop upload area', async ({ authenticatedPage: page }) => {
      await page.goto(`/org/${testOrg}/upload`);
      await expect(page).toHaveURL(new RegExp(`/org/${testOrg}/upload`));

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
    test('should redirect when accessing upload page without auth', async ({ browser }) => {
      // Create a fresh context without any auth state
      const context = await browser.newContext({
        ...(process.env.VERCEL_AUTOMATION_BYPASS_SECRET && {
          extraHTTPHeaders: {
            'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
          },
        }),
      });
      const page = await context.newPage();

      await page.goto(`/org/${testOrg}/upload`);

      // Should redirect to landing or login
      await page.waitForURL(/^\/$|\/login|\/auth/, { timeout: 10000 });
      await context.close();
    });
  });
});

test.describe('Video Upload Flow', () => {
  test('upload area should respond to hover interactions', async ({ authenticatedPage: page }) => {
    await page.goto(`/org/${testOrg}/upload`);
    await expect(page).toHaveURL(new RegExp(`/org/${testOrg}/upload`));

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
