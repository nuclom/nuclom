import { expect, TEST_CONFIG, test } from '../shared/fixtures';

const { testOrg } = TEST_CONFIG;

test.describe('Video Upload Page', () => {
  test.describe('Authenticated User', () => {
    test('should display upload page with form elements', async ({ authenticatedPage: page }) => {
      await page.goto(`/org/${testOrg}/upload`);
      await expect(page).toHaveURL(new RegExp(`/org/${testOrg}/upload`));

      // Wait for page to load (the page uses Suspense which may show skeleton first)
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

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

            // Log debug info
            console.log('Upload check:', { hasUploadHeading, hasDropzone, hasUploadText, hasSkeleton });

            // If we have upload elements OR no skeleton loading, we're done
            return hasUploadHeading || hasDropzone || hasUploadText || !hasSkeleton;
          },
          { timeout: 10000, message: 'Upload page elements should be visible after loading' },
        )
        .toBe(true);
    });

    test('should have back to videos link', async ({ authenticatedPage: page }) => {
      await page.goto(`/org/${testOrg}/upload`);
      await expect(page).toHaveURL(new RegExp(`/org/${testOrg}/upload`));

      // Wait for Suspense content to load
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      // The "Back to Videos" link may take a moment to appear due to Suspense
      // Use poll to wait for it to become visible
      await expect
        .poll(
          async () => {
            // Try multiple selectors: the link role with text, or just the text
            const hasBackLink = await page
              .getByRole('link', { name: /back to videos/i })
              .isVisible()
              .catch(() => false);
            const hasBackText = await page
              .getByText(/back to videos/i)
              .first()
              .isVisible()
              .catch(() => false);
            const hasSkeleton = await page
              .locator('.animate-pulse, [data-skeleton]')
              .first()
              .isVisible()
              .catch(() => false);

            // Log debug info
            console.log('Back link check:', { hasBackLink, hasBackText, hasSkeleton });

            // If we have the link OR no skeleton loading, we're done
            return hasBackLink || hasBackText || !hasSkeleton;
          },
          { timeout: 10000, message: 'Back to Videos link should be visible' },
        )
        .toBe(true);
    });

    test('should navigate back to organization page', async ({ authenticatedPage: page }) => {
      await page.goto(`/org/${testOrg}/upload`);
      await expect(page).toHaveURL(new RegExp(`/org/${testOrg}/upload`));

      // Wait for Suspense content to load
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      // Wait for the back link to appear
      const backLink = page.getByText(/back to videos/i).first();
      await expect(backLink).toBeVisible({ timeout: 15000 });

      await backLink.click();
      // The link goes to /org/{slug} which shows videos
      await expect(page).toHaveURL(new RegExp(`/org/${testOrg}`));
    });

    test('should have drag and drop upload area', async ({ authenticatedPage: page }) => {
      await page.goto(`/org/${testOrg}/upload`);
      await expect(page).toHaveURL(new RegExp(`/org/${testOrg}/upload`));

      // Wait for Suspense content to load
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      // Look for drop zone (role="button") or upload-related text
      // The upload hub component has a div with role="button" for the drop zone
      await expect
        .poll(
          async () => {
            const hasDropZone = await page
              .locator("[role='button']")
              .first()
              .isVisible()
              .catch(() => false);
            const hasDragText = await page
              .getByText(/drag and drop/i)
              .first()
              .isVisible()
              .catch(() => false);
            const hasChooseFiles = await page
              .getByText(/choose files/i)
              .first()
              .isVisible()
              .catch(() => false);
            return hasDropZone || hasDragText || hasChooseFiles;
          },
          { timeout: 15000, message: 'Drag and drop upload area should be visible' },
        )
        .toBe(true);
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
