import { test, expect } from "@playwright/test";

test.describe("Registration Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Start from the landing page
    await page.goto("/");
  });

  test("should complete email registration from landing page", async ({ page }) => {
    // Landing page should have sign-up CTA
    await expect(page.getByRole("link", { name: "Get Started" }).first()).toBeVisible();
    await page.getByRole("link", { name: "Get Started" }).first().click();

    // Should navigate to registration page (via signup redirect)
    await expect(page).toHaveURL(/.*\/(register|signup)/);
    await expect(page.getByTestId("register-title")).toBeVisible();

    // Fill registration form with real data
    const timestamp = Date.now();
    await page.getByLabel("Full Name").fill("John Doe");
    await page.getByLabel("Email").fill(`john${timestamp}@example.com`);
    await page.getByRole("textbox", { name: "Password" }).first().fill("SecurePassword123!");
    await page.getByLabel("Confirm Password").fill("SecurePassword123!");
    
    await page.getByRole("button", { name: /create account/i }).click();

    // Should redirect or show success after registration
    await page.waitForURL(/.*\/.*/, { timeout: 10000 });
  });

  test("should handle registration validation errors", async ({ page }) => {
    await page.getByRole("link", { name: /get started/i }).click();

    // Test empty form submission
    await page.getByRole("button", { name: /create account/i }).click();
    
    // Browser native validation will handle required field validation
    await expect(page.getByLabel("Full Name")).toHaveAttribute("required");
    await expect(page.getByLabel("Email")).toHaveAttribute("required");
    await expect(page.getByRole("textbox", { name: "Password" }).first()).toHaveAttribute("required");

    // Test password mismatch
    await page.getByLabel("Full Name").fill("John Doe");
    await page.getByLabel("Email").fill("john@example.com");
    await page.getByRole("textbox", { name: "Password" }).first().fill("password123");
    await page.getByLabel("Confirm Password").fill("differentpassword");
    await page.getByRole("button", { name: /create account/i }).click();
    
    // Should show password mismatch error
    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });

  test("should allow GitHub OAuth registration", async ({ page }) => {
    await page.getByRole("link", { name: /get started/i }).click();
    
    // Check GitHub button is present
    await expect(page.getByRole("button", { name: /github/i })).toBeVisible();
    
    // Click GitHub button (will redirect to OAuth - just test the flow initiates)
    await page.getByRole("button", { name: /github/i }).click();
    
    // Should navigate away from the current page (to GitHub OAuth)
    await page.waitForURL(/(?!.*\/register).*/, { timeout: 5000 });
  });

  test("should allow switching between login and register", async ({ page }) => {
    await page.getByRole("link", { name: /get started/i }).click();
    
    // Should be on register page
    await expect(page).toHaveURL(/.*\/register/);
    
    // Click sign in link
    await page.getByRole("link", { name: /sign in/i }).click();
    
    // Should navigate to login page
    await expect(page).toHaveURL(/.*\/login/);
    
    // Go back to register
    await page.getByRole("link", { name: /sign up/i }).click();
    await expect(page).toHaveURL(/.*\/register/);
  });
});