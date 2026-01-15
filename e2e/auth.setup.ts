import process from 'node:process';
import { expect, test as setup } from '@playwright/test';

const testUserEmail = process.env.E2E_TEST_USER_EMAIL;
const testUserPassword = process.env.E2E_TEST_USER_PASSWORD;
const testOrg = process.env.E2E_TEST_ORG || 'e2e-tests';

/**
 * Authentication setup for E2E tests.
 * Creates authenticated state that can be reused across tests.
 *
 * Requires environment variables:
 *   - E2E_TEST_USER_EMAIL: Email for the test user
 *   - E2E_TEST_USER_PASSWORD: Password for the test user
 */
setup('authenticate', async ({ page }) => {
  if (!testUserEmail || !testUserPassword) {
    throw new Error(
      'E2E_TEST_USER_EMAIL and E2E_TEST_USER_PASSWORD environment variables are required. ' +
        'Make sure the test user is seeded in the database.',
    );
  }

  await page.goto('/login');

  // Fill in login form
  await page.getByLabel('Email').fill(testUserEmail);
  await page.getByLabel('Password').fill(testUserPassword);

  // Submit form
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for redirect to organization page
  await expect(page).toHaveURL(new RegExp(`/${testOrg}`), { timeout: 15000 });

  // Save signed-in state to file
  await page.context().storageState({ path: 'playwright/.auth/user.json' });
});
