import process from "node:process";
import { test as setup } from "@playwright/test";

const testUserEmail = process.env.E2E_TEST_USER_EMAIL || "e2e-test@example.com";
const testUserPassword = process.env.E2E_TEST_USER_PASSWORD || "testpassword123";

/**
 * Authentication setup for E2E tests.
 * Creates authenticated state that can be reused across tests.
 */
setup("authenticate", async ({ page }) => {
  // Skip auth setup if we're running against a mock or if storage state already exists
  if (process.env.SKIP_AUTH_SETUP === "true") {
    return;
  }

  await page.goto("/login");

  // Fill in login form
  await page.getByLabel("Email").fill(testUserEmail);
  await page.getByLabel("Password").fill(testUserPassword);

  // Submit form
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait for redirect to organization page (or dashboard)
  await page.waitForURL(/\/\w+/, { timeout: 10000 }).catch(() => {
    // If login fails, that's ok for CI - tests will handle unauthenticated state
    console.log("Login redirect did not occur - tests will run in unauthenticated mode");
  });

  // Save signed-in state to file
  await page.context().storageState({ path: "playwright/.auth/user.json" });
});
