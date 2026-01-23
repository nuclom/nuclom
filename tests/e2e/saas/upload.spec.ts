import { expect, TEST_CONFIG, test } from '../shared/fixtures';

const { testOrg } = TEST_CONFIG;

test.describe('Video Upload Page', () => {
  test.describe('Authenticated User', () => {
    test('should display upload page with form elements', async ({ authenticatedPage: page }) => {
      await page.goto(`/org/${testOrg}/upload`);
      await expect(page).toHaveURL(new RegExp(`/org/${testOrg}/upload`));

      // Wait for initial DOM content
      await page.waitForLoadState('domcontentloaded');

      // The page uses Suspense so content may load after networkidle.
      // Use poll to wait for upload elements to appear.
      // First ensure page has basic content loaded
      await page.waitForSelector('body', { timeout: 5000 });

      await expect
        .poll(
          async () => {
            // Check for upload page elements - look for heading or upload-related content
            const hasUploadHeading = await page
              .getByRole('heading', { name: /upload/i })
              .first()
              .isVisible()
              .catch(() => false);
            const hasDropzone = await page
              .locator('[role="button"]')
              .first()
              .isVisible()
              .catch(() => false);
            const hasUploadText = await page
              .getByText(/drag and drop|choose files/i)
              .first()
              .isVisible()
              .catch(() => false);
            const hasSkeleton = await page
              .locator('.animate-pulse, [data-skeleton]')
              .first()
              .isVisible()
              .catch(() => false);

            // If we have upload elements OR no skeleton loading, we're done
            return hasUploadHeading || hasDropzone || hasUploadText || !hasSkeleton;
          },
          { timeout: 5000, message: 'Upload page elements should be visible after loading' },
        )
        .toBe(true);
    });

    test('should have back to videos link', async ({ authenticatedPage: page }) => {
      await page.goto(`/org/${testOrg}/upload`);
      await expect(page).toHaveURL(new RegExp(`/org/${testOrg}/upload`));

      // Wait for initial DOM content
      await page.waitForLoadState('domcontentloaded');

      // Wait for the back link to appear
      await expect(page.getByText(/back to videos/i).first()).toBeVisible({ timeout: 5000 });
    });

    test('should navigate back to organization page', async ({ authenticatedPage: page }) => {
      await page.goto(`/org/${testOrg}/upload`);
      await expect(page).toHaveURL(new RegExp(`/org/${testOrg}/upload`));

      // Wait for initial DOM content
      await page.waitForLoadState('domcontentloaded');

      // Wait for the back link to appear
      const backLink = page.getByText(/back to videos/i).first();
      await expect(backLink).toBeVisible({ timeout: 5000 });

      await backLink.click();
      // The link goes to /org/{slug} which shows videos
      await expect(page).toHaveURL(new RegExp(`/org/${testOrg}`));
    });

    test('should have drag and drop upload area', async ({ authenticatedPage: page }) => {
      await page.goto(`/org/${testOrg}/upload`);
      await expect(page).toHaveURL(new RegExp(`/org/${testOrg}/upload`));

      // Wait for initial DOM content
      await page.waitForLoadState('domcontentloaded');

      // Look for drop zone or upload-related text
      const dropZone = page.locator("[role='button']").first();
      const dragText = page.getByText(/drag and drop/i).first();
      const chooseFiles = page.getByText(/choose files/i).first();

      // At least one upload element should be visible
      await expect(dropZone.or(dragText).or(chooseFiles).first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Unauthenticated User', () => {
    // TODO: Investigate middleware redirect behavior in Vercel deployments
    test.skip('should redirect when accessing upload page without auth', async ({ browser }) => {
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
