import { test, expect } from "@playwright/test";

test.describe("Organization Management", () => {
  test.beforeEach(async ({ page }) => {
    // Create a real test user and login
    await page.goto("/register");
    
    // Register a new test user
    const timestamp = Date.now();
    const testEmail = `test${timestamp}@example.com`;
    
    await page.getByLabel("Full Name").fill("Test User");
    await page.getByLabel("Email").fill(testEmail);
    await page.getByRole("textbox", { name: "Password" }).first().fill("password123");
    await page.getByLabel("Confirm Password").fill("password123");
    await page.getByRole("button", { name: "Create account" }).click();
    
    // Should redirect to onboarding
    await page.waitForURL(/.*\/onboarding/, { timeout: 10000 });
    await expect(page.getByText("Welcome to Nuclom!")).toBeVisible();
  });

  test("should display onboarding flow", async ({ page }) => {
    // Should show onboarding form
    await expect(page.getByText("Welcome to Nuclom!")).toBeVisible();
    await expect(page.getByLabel("Organization Name")).toBeVisible();
    await expect(page.getByLabel("URL Slug")).toBeVisible();
  });

  test("should create new organization through onboarding", async ({ page }) => {
    // Fill organization form in onboarding
    await page.getByLabel("Organization Name").fill("Test Organization");
    await page.getByLabel("URL Slug").fill("test-org");

    // Submit form
    await page.getByRole("button", { name: /create organization/i }).click();

    // Should redirect to new organization
    await page.waitForURL(/\/test-org/, { timeout: 10000 });
    await expect(page.getByText("Test Organization")).toBeVisible();
  });

  test("should manage organization members", async ({ page }) => {
    // Create organization through onboarding
    await page.getByLabel("Organization Name").fill("Test Org Members");
    await page.getByLabel("URL Slug").fill("test-org-members");
    await page.getByRole("button", { name: /create organization/i }).click();
    await page.waitForURL(/\/test-org-members/, { timeout: 10000 });

    // Navigate to members page
    await page.getByRole("link", { name: /members/i }).click();

    // Check member list shows current user
    await expect(page.getByText("Test User")).toBeVisible();
    await expect(page.getByText("owner")).toBeVisible();
  });

  test("should invite new member", async ({ page }) => {
    // Create organization through onboarding
    await page.getByLabel("Organization Name").fill("Test Org Invite");
    await page.getByLabel("URL Slug").fill("test-org-invite");
    await page.getByRole("button", { name: /create organization/i }).click();
    await page.waitForURL(/\/test-org-invite/, { timeout: 10000 });

    // Navigate to members and invite
    await page.getByRole("link", { name: /members/i }).click();
    await page.getByRole("button", { name: /invite member/i }).click();

    // Fill invitation form
    await page.getByLabel("Email").fill("newmember@example.com");
    await page.getByRole("button", { name: /send invitation/i }).click();

    // Check success message
    await expect(page.getByText(/invitation sent/i)).toBeVisible();
  });
});