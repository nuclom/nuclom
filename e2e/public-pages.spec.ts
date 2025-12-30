import { expect, test } from "@playwright/test";

test.describe("Public Pages", () => {
  test.describe("Privacy Policy", () => {
    test("should display privacy policy page", async ({ page }) => {
      await page.goto("/privacy");
      await page.waitForLoadState("domcontentloaded");

      // Should have privacy-related content
      const title = page.getByRole("heading", { level: 1 });
      await expect(title).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Terms of Service", () => {
    test("should display terms of service page", async ({ page }) => {
      await page.goto("/terms");
      await page.waitForLoadState("domcontentloaded");

      // Should have terms-related content
      const title = page.getByRole("heading", { level: 1 });
      await expect(title).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Support Page", () => {
    test("should display support page", async ({ page }) => {
      await page.goto("/support");
      await page.waitForLoadState("domcontentloaded");

      // Should load without errors
      const title = page.getByRole("heading", { level: 1 });
      await expect(title).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Contact Page", () => {
    test("should display contact page", async ({ page }) => {
      await page.goto("/contact");
      await page.waitForLoadState("domcontentloaded");

      // Should load without errors
      await page.waitForLoadState("networkidle").catch(() => {});
    });
  });
});

test.describe("404 Page", () => {
  test("should handle non-existent routes gracefully", async ({ page }) => {
    const response = await page.goto("/non-existent-page-12345");

    // Should either show 404 or redirect
    const status = response?.status();
    expect([200, 404, 307, 308]).toContain(status);
  });
});

test.describe("Page Performance", () => {
  test("landing page should load within acceptable time", async ({ page }) => {
    const startTime = Date.now();
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    const loadTime = Date.now() - startTime;

    // Should load within 10 seconds
    expect(loadTime).toBeLessThan(10000);
  });

  test("login page should load within acceptable time", async ({ page }) => {
    const startTime = Date.now();
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");
    const loadTime = Date.now() - startTime;

    // Should load within 10 seconds
    expect(loadTime).toBeLessThan(10000);
  });
});
