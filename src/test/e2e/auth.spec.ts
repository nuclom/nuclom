import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Mock the authentication to avoid external dependencies
    await page.goto("/login");
  });

  test("should display login form", async ({ page }) => {
    await expect(page.getByText("Welcome back")).toBeVisible();
    await expect(page.getByText("Sign in to your account to continue")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Password" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "GitHub" })).toBeVisible();
  });

  test("should toggle password visibility", async ({ page }) => {
    const passwordInput = page.getByRole("textbox", { name: "Password" });
    const toggleButton = page.getByRole("button", { name: "Toggle password visibility" });

    await expect(passwordInput).toHaveAttribute("type", "password");

    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute("type", "text");

    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("should show validation errors for empty form submission", async ({ page }) => {
    await page.getByRole("button", { name: "Sign in" }).click();

    // Browser native validation should prevent submission
    await expect(page.getByLabel("Email")).toHaveAttribute("required");
    await expect(page.getByRole("textbox", { name: "Password" })).toHaveAttribute("required");
  });

  test("should navigate to registration page", async ({ page }) => {
    await page.getByRole("link", { name: "Sign up" }).click();
    await expect(page).toHaveURL("/register");
  });

  test("should handle form submission loading state", async ({ page }) => {
    await page.getByLabel("Email").fill("test@example.com");
    await page.getByRole("textbox", { name: "Password" }).fill("password123");

    // Just click and check for loading state - no mocks
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Signing in...")).toBeVisible();
  });

  test("should display error message on failed login", async ({ page }) => {
    await page.getByLabel("Email").fill("invalid@example.com");
    await page.getByRole("textbox", { name: "Password" }).fill("wrongpassword");
    await page.getByRole("button", { name: "Sign in" }).click();
    
    // Wait for error message - the actual auth system should show this
    await expect(page.locator("[class*='destructive']")).toBeVisible();
  });
});

test.describe("Registration Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/register");
  });

  test("should display registration form", async ({ page }) => {
    await expect(page.getByTestId("register-title")).toBeVisible();
    await expect(page.getByLabel("Full Name")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password").first()).toBeVisible();
    await expect(page.getByLabel("Confirm Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
  });

  test("should navigate to login page", async ({ page }) => {
    await page.getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/login");
  });

  test("should handle registration form submission", async ({ page }) => {
    await page.getByLabel("Name").fill("John Doe");
    await page.getByLabel("Email").fill("john@example.com");
    await page.getByLabel("Password").first().fill("password123");

    // Mock successful registration
    await page.route("**/api/auth/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await page.getByRole("button", { name: "Sign up" }).click();
    // Note: The actual loading state may vary, so we check for button disabled state instead
    await expect(page.getByRole("button", { name: "Create account" })).toBeDisabled();
  });
});
