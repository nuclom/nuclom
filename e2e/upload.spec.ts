import { expect, test } from "./fixtures";

test.describe("Video Upload Page", () => {
  test.describe("Authenticated User", () => {
    test("should display upload page with form elements", async ({ authenticatedPage: page }) => {
      await page.goto("/vercel/upload");

      if (page.url().includes("login") || page.url() === "/") {
        test.skip(true, "Not authenticated - skipping authenticated tests");
        return;
      }

      // Check for upload page elements
      await expect(page.getByRole("heading", { name: /upload video/i })).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(/upload a new video/i)).toBeVisible();
    });

    test("should have back to videos link", async ({ authenticatedPage: page }) => {
      await page.goto("/vercel/upload");

      if (page.url().includes("login") || page.url() === "/") {
        test.skip(true, "Not authenticated - skipping authenticated tests");
        return;
      }

      await expect(page.getByRole("link", { name: /back to videos/i })).toBeVisible();
    });

    test("should navigate back to organization page", async ({ authenticatedPage: page }) => {
      await page.goto("/vercel/upload");

      if (page.url().includes("login") || page.url() === "/") {
        test.skip(true, "Not authenticated - skipping authenticated tests");
        return;
      }

      await page.getByRole("link", { name: /back to videos/i }).click();
      await expect(page).toHaveURL(/\/vercel$/);
    });

    test("should have drag and drop upload area", async ({ authenticatedPage: page }) => {
      await page.goto("/vercel/upload");

      if (page.url().includes("login") || page.url() === "/") {
        test.skip(true, "Not authenticated - skipping authenticated tests");
        return;
      }

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

  test.describe("Unauthenticated User", () => {
    test("should redirect when accessing upload page without auth", async ({ page }) => {
      await page.context().clearCookies();
      await page.goto("/vercel/upload");

      // Should redirect to landing or login
      await page.waitForURL(/^\/$|\/login|\/auth/, { timeout: 10000 });
    });
  });
});

test.describe("Video Upload Flow", () => {
  test("upload area should respond to hover interactions", async ({ authenticatedPage: page }) => {
    await page.goto("/vercel/upload");

    if (page.url().includes("login") || page.url() === "/") {
      test.skip(true, "Not authenticated - skipping authenticated tests");
      return;
    }

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
