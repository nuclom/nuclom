import path from 'node:path';
import process from 'node:process';
import type { BrowserContext } from '@playwright/test';
import { test as base, type Page } from '@playwright/test';

/**
 * Test configuration constants
 */
export const TEST_CONFIG = {
  // Test organization slug (used for authenticated routes)
  testOrg: process.env.E2E_TEST_ORG || 'e2e-tests',
  // Test user credentials
  testUserEmail: process.env.E2E_TEST_USER_EMAIL,
  testUserPassword: process.env.E2E_TEST_USER_PASSWORD,
  // Timeouts
  navigationTimeout: 15000,
  actionTimeout: 10000,
} as const;

/**
 * Extended test fixtures for Nuclom E2E tests
 */
export const test = base.extend<{
  authenticatedPage: Page;
}>({
  // Authenticated page fixture - uses stored auth state
  authenticatedPage: async ({ browser }, use) => {
    const authFile = path.join(process.cwd(), 'playwright/.auth/user.json');

    let context: BrowserContext;
    try {
      context = await browser.newContext({
        storageState: authFile,
      });
    } catch {
      // If auth file doesn't exist, create a context without it
      context = await browser.newContext();
    }

    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';

/**
 * Helper to wait for page to be fully loaded
 */
export async function waitForPageLoad(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle').catch(() => {
    // Network idle can timeout on slow connections, continue anyway
  });
}

/**
 * Helper to check if an element is visible with a better error message
 */
export async function expectVisible(page: Page, selector: string, description?: string): Promise<void> {
  const element = page.locator(selector).first();
  await element.waitFor({ state: 'visible', timeout: TEST_CONFIG.actionTimeout }).catch(() => {
    throw new Error(`Expected ${description || selector} to be visible, but it was not found`);
  });
}

/**
 * Helper to fill a form field by label
 */
export async function fillField(page: Page, label: string, value: string): Promise<void> {
  await page.getByLabel(label).fill(value);
}

/**
 * Helper to click a button by text
 */
export async function clickButton(page: Page, text: string | RegExp): Promise<void> {
  await page.getByRole('button', { name: text }).click();
}
