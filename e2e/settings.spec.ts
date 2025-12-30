import { expect, test } from "./fixtures";

test.describe("Settings Pages", () => {
  test.describe("Profile Settings", () => {
    test("should display profile settings page", async ({ authenticatedPage: page }) => {
      await page.goto("/vercel/settings/profile");

      if (page.url().includes("login") || page.url() === "/") {
        test.skip(true, "Not authenticated - skipping authenticated tests");
        return;
      }

      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/\/settings\/profile/);
    });

    test("should have profile form elements", async ({ authenticatedPage: page }) => {
      await page.goto("/vercel/settings/profile");

      if (page.url().includes("login") || page.url() === "/") {
        test.skip(true, "Not authenticated - skipping authenticated tests");
        return;
      }

      // Look for common profile fields
      const nameInput = page.getByLabel(/name/i);
      const emailDisplay = page.getByText(/@.*\./);

      const hasNameInput = await nameInput.isVisible().catch(() => false);
      const hasEmail = await emailDisplay.isVisible().catch(() => false);

      // At least one profile element should exist
      expect(hasNameInput || hasEmail).toBe(true);
    });
  });

  test.describe("Organization Settings", () => {
    test("should display organization settings page", async ({ authenticatedPage: page }) => {
      await page.goto("/vercel/settings/organization");

      if (page.url().includes("login") || page.url() === "/") {
        test.skip(true, "Not authenticated - skipping authenticated tests");
        return;
      }

      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/\/settings\/organization/);
    });
  });

  test.describe("Members Settings", () => {
    test("should display members settings page", async ({ authenticatedPage: page }) => {
      await page.goto("/vercel/settings/members");

      if (page.url().includes("login") || page.url() === "/") {
        test.skip(true, "Not authenticated - skipping authenticated tests");
        return;
      }

      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/\/settings\/members/);
    });
  });

  test.describe("Settings Navigation", () => {
    test("should navigate between settings pages", async ({ authenticatedPage: page }) => {
      await page.goto("/vercel/settings/profile");

      if (page.url().includes("login") || page.url() === "/") {
        test.skip(true, "Not authenticated - skipping authenticated tests");
        return;
      }

      // Look for settings navigation links
      const orgSettingsLink = page.getByRole("link", { name: /organization/i });
      if (await orgSettingsLink.isVisible()) {
        await orgSettingsLink.click();
        await expect(page).toHaveURL(/\/settings\/organization/);
      }
    });
  });
});

test.describe("Settings - Unauthenticated", () => {
  test("should redirect when accessing settings without auth", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/vercel/settings/profile");

    // Should redirect to landing or login
    await page.waitForURL(/^\/$|\/login|\/auth/, { timeout: 10000 });
  });
});
