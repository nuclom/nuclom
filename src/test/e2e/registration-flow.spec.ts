import { test, expect } from "@playwright/test";

test.describe("Registration Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Start from the landing page
    await page.goto("/");
  });

  test("should complete email registration from landing page", async ({ page }) => {
    // Landing page should have sign-up CTA
    await expect(page.getByRole("button", { name: /get started/i })).toBeVisible();
    await page.getByRole("button", { name: /get started/i }).click();

    // Should navigate to registration page
    await expect(page).toHaveURL(/.*\/register/);
    await expect(page.getByText("Create your account")).toBeVisible();

    // Mock successful registration
    await page.route("**/api/auth/**", async (route) => {
      const url = route.request().url();
      if (url.includes("register") || url.includes("sign-up")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ 
            success: true, 
            user: { 
              id: "reg-user-1", 
              name: "John Doe", 
              email: "john@example.com",
              emailVerified: false
            }
          }),
        });
      }
    });

    // Fill registration form
    await page.getByLabel("Name").fill("John Doe");
    await page.getByLabel("Email").fill("john@example.com");
    await page.getByLabel("Password").fill("SecurePassword123!");
    
    // Should have password requirements
    await expect(page.getByText("At least 8 characters")).toBeVisible();
    await expect(page.getByText("Include uppercase and lowercase")).toBeVisible();
    await expect(page.getByText("Include numbers")).toBeVisible();

    await page.getByRole("button", { name: /create account/i }).click();

    // Should show email verification notice
    await expect(page.getByText("Check your email")).toBeVisible();
    await expect(page.getByText("We sent a verification link to john@example.com")).toBeVisible();
  });

  test("should handle registration validation errors", async ({ page }) => {
    await page.getByRole("button", { name: /get started/i }).click();

    // Test empty form submission
    await page.getByRole("button", { name: /create account/i }).click();
    
    await expect(page.getByText("Name is required")).toBeVisible();
    await expect(page.getByText("Email is required")).toBeVisible();
    await expect(page.getByText("Password is required")).toBeVisible();

    // Test invalid email
    await page.getByLabel("Email").fill("invalid-email");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page.getByText("Please enter a valid email")).toBeVisible();

    // Test weak password
    await page.getByLabel("Email").fill("valid@example.com");
    await page.getByLabel("Password").fill("123");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page.getByText("Password must be at least 8 characters")).toBeVisible();

    // Test password without requirements
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page.getByText("Password must contain uppercase, lowercase, and numbers")).toBeVisible();
  });

  test("should handle registration server errors", async ({ page }) => {
    await page.getByRole("button", { name: /get started/i }).click();

    // Mock email already exists error
    await page.route("**/api/auth/**", async (route) => {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ 
          error: "User with this email already exists",
          code: "EMAIL_EXISTS"
        }),
      });
    });

    await page.getByLabel("Name").fill("Jane Doe");
    await page.getByLabel("Email").fill("existing@example.com");
    await page.getByLabel("Password").fill("ValidPassword123!");
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page.getByText("User with this email already exists")).toBeVisible();
    await expect(page.getByText("Try signing in instead")).toBeVisible();
    await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();
  });

  test("should allow GitHub OAuth registration", async ({ page }) => {
    await page.getByRole("button", { name: /get started/i }).click();

    await expect(page.getByRole("button", { name: /continue with github/i })).toBeVisible();
    
    // Mock GitHub OAuth flow
    await page.route("**/api/auth/oauth/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ 
          redirectUrl: "https://github.com/login/oauth/authorize?client_id=mock"
        }),
      });
    });

    await page.getByRole("button", { name: /continue with github/i }).click();
    
    // In a real test, this would redirect to GitHub
    // For now, we just verify the button works
    await expect(page).toHaveURL(/.*github\.com.*/, { timeout: 10000 });
  });

  test("should handle terms and privacy acceptance", async ({ page }) => {
    await page.getByRole("button", { name: /get started/i }).click();

    // Should have terms and privacy links
    await expect(page.getByText("By creating an account, you agree")).toBeVisible();
    await expect(page.getByRole("link", { name: /terms of service/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /privacy policy/i })).toBeVisible();

    // Terms link should work
    await page.getByRole("link", { name: /terms of service/i }).click();
    await expect(page).toHaveURL(/.*\/terms/);
    
    await page.goBack();
    
    // Privacy link should work
    await page.getByRole("link", { name: /privacy policy/i }).click();
    await expect(page).toHaveURL(/.*\/privacy/);
  });

  test("should allow switching between login and register", async ({ page }) => {
    await page.getByRole("button", { name: /get started/i }).click();
    await expect(page).toHaveURL(/.*\/register/);

    // Should have link to login
    await expect(page.getByText("Already have an account?")).toBeVisible();
    await page.getByRole("link", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/.*\/login/);

    // Should have link back to register
    await expect(page.getByText("Don't have an account?")).toBeVisible();
    await page.getByRole("link", { name: /sign up/i }).click();
    await expect(page).toHaveURL(/.*\/register/);
  });

  test("should handle email verification flow", async ({ page }) => {
    // Mock user clicking verification link from email
    const verificationToken = "mock-verification-token-123";
    
    await page.route("**/api/auth/verify-email**", async (route) => {
      const url = new URL(route.request().url());
      const token = url.searchParams.get("token");
      
      if (token === verificationToken) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ 
            success: true,
            user: {
              id: "verified-user-1",
              name: "Verified User",
              email: "verified@example.com",
              emailVerified: true
            }
          }),
        });
      } else {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ 
            error: "Invalid or expired verification token"
          }),
        });
      }
    });

    // Valid verification link
    await page.goto(`/verify-email?token=${verificationToken}`);
    await expect(page.getByText("Email verified successfully")).toBeVisible();
    await expect(page.getByText("Your account is now active")).toBeVisible();
    await expect(page.getByRole("button", { name: /continue to dashboard/i })).toBeVisible();

    // Invalid verification link
    await page.goto("/verify-email?token=invalid-token");
    await expect(page.getByText("Invalid or expired verification token")).toBeVisible();
    await expect(page.getByText("Request a new verification email")).toBeVisible();
  });

  test("should handle registration with invitation code", async ({ page }) => {
    const invitationCode = "ORG-INVITE-ABC123";
    
    // User follows invitation link
    await page.goto(`/register?invitation=${invitationCode}`);
    
    // Should show invitation context
    await expect(page.getByText("You've been invited to join")).toBeVisible();
    await expect(page.getByText("Test Organization")).toBeVisible();
    
    // Mock invitation validation
    await page.route("**/api/invitations/validate**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          valid: true,
          organization: {
            id: "invited-org-1",
            name: "Test Organization",
            slug: "test-org"
          },
          role: "member"
        }),
      });
    });

    // Mock registration with invitation
    await page.route("**/api/auth/register**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          user: {
            id: "invited-user-1",
            name: "Invited User",
            email: "invited@example.com",
            emailVerified: true
          },
          organization: {
            id: "invited-org-1",
            name: "Test Organization",
            slug: "test-org"
          }
        }),
      });
    });

    // Registration should pre-fill email if provided in invitation
    await expect(page.getByLabel("Email")).toHaveValue("invited@example.com");
    
    await page.getByLabel("Name").fill("Invited User");
    await page.getByLabel("Password").fill("InvitedPassword123!");
    await page.getByRole("button", { name: /join organization/i }).click();

    // Should redirect directly to organization (skip org creation)
    await expect(page).toHaveURL(/.*\/test-org/);
    await expect(page.getByText("Welcome to Test Organization")).toBeVisible();
  });

  test("should handle registration rate limiting", async ({ page }) => {
    await page.getByRole("button", { name: /get started/i }).click();

    // Mock rate limiting error
    await page.route("**/api/auth/**", async (route) => {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ 
          error: "Too many registration attempts. Please try again in 15 minutes.",
          retryAfter: 900
        }),
      });
    });

    await page.getByLabel("Name").fill("Rate Limited User");
    await page.getByLabel("Email").fill("ratelimited@example.com");
    await page.getByLabel("Password").fill("RateLimited123!");
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page.getByText("Too many registration attempts")).toBeVisible();
    await expect(page.getByText("Please try again in 15 minutes")).toBeVisible();
    
    // Button should be disabled
    await expect(page.getByRole("button", { name: /create account/i })).toBeDisabled();
  });

  test("should provide accessible registration experience", async ({ page }) => {
    await page.getByRole("button", { name: /get started/i }).click();

    // Check form accessibility
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("heading", { name: /create your account/i })).toBeVisible();
    
    // All form fields should have proper labels
    await expect(page.getByLabel("Name")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();

    // Test keyboard navigation
    await page.keyboard.press("Tab"); // Should focus first field
    await expect(page.getByLabel("Name")).toBeFocused();
    
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Email")).toBeFocused();
    
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Password")).toBeFocused();

    // Password visibility toggle should be accessible
    await page.getByRole("button", { name: /toggle password visibility/i }).click();
    await expect(page.getByLabel("Password")).toHaveAttribute("type", "text");
    
    await page.getByRole("button", { name: /toggle password visibility/i }).click();
    await expect(page.getByLabel("Password")).toHaveAttribute("type", "password");
  });
});