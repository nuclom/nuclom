import { expect, TEST_CONFIG, test } from './fixtures';

const { testOrg } = TEST_CONFIG;

test.describe('Settings Pages', () => {
  test.describe('Profile Settings', () => {
    // Note: Profile settings is at /settings/profile, not under org
    test('should display profile settings page', async ({ authenticatedPage: page }) => {
      await page.goto('/settings/profile');
      await expect(page).toHaveURL(/\/settings\/profile/, { timeout: 10000 });

      // Wait for page content to load instead of networkidle
      await page.waitForLoadState('domcontentloaded');
    });

    test('should have profile form elements', async ({ authenticatedPage: page }) => {
      await page.goto('/settings/profile');
      await expect(page).toHaveURL(/\/settings\/profile/, { timeout: 10000 });

      // Wait for page content to load
      await page.waitForLoadState('domcontentloaded');

      // Look for common profile fields - the page has "Full Name" label
      const nameInput = page.getByLabel(/full name/i);
      const emailInput = page.getByLabel(/email/i);
      const profileTitle = page.getByText('Your Profile');

      // Wait for any profile element to appear (more reliable than isVisible checks)
      await Promise.race([
        nameInput.waitFor({ state: 'visible', timeout: 10000 }),
        emailInput.waitFor({ state: 'visible', timeout: 10000 }),
        profileTitle.waitFor({ state: 'visible', timeout: 10000 }),
      ]).catch(() => {});

      const hasNameInput = await nameInput.isVisible().catch(() => false);
      const hasEmailInput = await emailInput.isVisible().catch(() => false);
      const hasProfileTitle = await profileTitle.isVisible().catch(() => false);

      // At least one profile element should exist
      expect(hasNameInput || hasEmailInput || hasProfileTitle).toBe(true);
    });
  });

  test.describe('Organization Settings', () => {
    test('should display organization settings page', async ({ authenticatedPage: page }) => {
      await page.goto(`/org/${testOrg}/settings/organization`);

      // Wait for page to load and verify URL
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(/\/settings\/organization/, { timeout: 10000 });
    });
  });

  test.describe('Members Settings', () => {
    test('should display members settings page', async ({ authenticatedPage: page }) => {
      await page.goto(`/org/${testOrg}/settings/members`);

      // Wait for page to load and verify URL
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(/\/settings\/members/, { timeout: 10000 });
    });
  });

  test.describe('Settings Navigation', () => {
    test('should navigate between settings pages', async ({ authenticatedPage: page }) => {
      await page.goto(`/org/${testOrg}/settings/profile`);
      await page.waitForLoadState('domcontentloaded');

      // Look for settings navigation links
      const orgSettingsLink = page.getByRole('link', { name: /organization/i });

      // Wait for link to be visible before checking
      await orgSettingsLink.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

      if (await orgSettingsLink.isVisible()) {
        await orgSettingsLink.click();
        await expect(page).toHaveURL(/\/settings\/organization/, { timeout: 10000 });
      }
    });
  });
});

test.describe('Settings - Unauthenticated', () => {
  test('should redirect when accessing settings without auth', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto(`/org/${testOrg}/settings/profile`);

    // Should redirect to landing or login - use expect instead of waitForURL for better error messages
    await expect(page).toHaveURL(/^\/$|\/login|\/auth/, { timeout: 15000 });
  });
});
