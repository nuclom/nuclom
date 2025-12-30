import { expect, test } from "@playwright/test";

test.describe("Landing Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should display the landing page with header", async ({ page }) => {
    // Check header elements
    await expect(page.getByRole("heading", { name: "Nuclom" })).toBeVisible();
    await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /get started/i })).toBeVisible();
  });

  test("should display hero section", async ({ page }) => {
    await expect(page.getByText("Collaborate on Videos")).toBeVisible();
    await expect(page.getByText("Like Never Before")).toBeVisible();
    await expect(page.getByRole("link", { name: /start free trial/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /watch demo/i })).toBeVisible();
  });

  test("should display features section", async ({ page }) => {
    await expect(page.getByText("Smart Video Management")).toBeVisible();
    await expect(page.getByText("Team Collaboration")).toBeVisible();
    await expect(page.getByText("Enterprise Security")).toBeVisible();
    await expect(page.getByText("Lightning Fast")).toBeVisible();
    await expect(page.getByText("Global Access")).toBeVisible();
    await expect(page.getByText("Advanced Playback")).toBeVisible();
  });

  test("should display pricing section", async ({ page }) => {
    await expect(page.getByText("Simple, Transparent Pricing")).toBeVisible();
    await expect(page.getByText("Starter")).toBeVisible();
    await expect(page.getByText("Pro")).toBeVisible();
    await expect(page.getByText("Enterprise")).toBeVisible();
  });

  test("should display about section", async ({ page }) => {
    await expect(page.getByText("Our Mission")).toBeVisible();
    await expect(page.getByText("10,000+ Teams")).toBeVisible();
    await expect(page.getByText("1M+ Videos")).toBeVisible();
    await expect(page.getByText("50+ Countries")).toBeVisible();
  });

  test("should display footer with links", async ({ page }) => {
    await expect(page.getByRole("link", { name: /privacy policy/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /terms of service/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /support/i })).toBeVisible();
    await expect(page.getByText("2025 Nuclom. All rights reserved.")).toBeVisible();
  });

  test("should navigate to login page", async ({ page }) => {
    await page.getByRole("link", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("should navigate to signup page via Get Started", async ({ page }) => {
    await page
      .getByRole("link", { name: /get started/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/signup|\/register/);
  });

  test("should have working navigation links", async ({ page }) => {
    // Check Features link scrolls to section
    const featuresLink = page.getByRole("link", { name: "Features" });
    if (await featuresLink.isVisible()) {
      await featuresLink.click();
      await expect(page.locator("#features")).toBeInViewport();
    }
  });
});

test.describe("Landing Page - Mobile", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("should display mobile-friendly layout", async ({ page }) => {
    await page.goto("/");

    // Header should still be visible
    await expect(page.getByText("Nuclom").first()).toBeVisible();

    // Hero content should be visible
    await expect(page.getByText("Collaborate on Videos")).toBeVisible();
  });
});
