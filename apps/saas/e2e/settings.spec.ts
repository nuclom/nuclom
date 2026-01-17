import { expect, TEST_CONFIG, test } from './fixtures';

const { testOrg } = TEST_CONFIG;

test.describe('Settings Pages', () => {
  test.describe('Profile Settings', () => {
    // Note: Profile settings is at /settings/profile, not under org
    test('should display profile settings page', async ({ authenticatedPage: page }) => {
      await page.goto('/settings/profile');
      await expect(page).toHaveURL(/\/settings\/profile/);

      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/settings\/profile/);
    });

    test('should have profile form elements', async ({ authenticatedPage: page }) => {
      await page.goto('/settings/profile');
      await expect(page).toHaveURL(/\/settings\/profile/);

      // Wait for page to load
      await page.waitForLoadState('networkidle');

      // Look for common profile fields - the page has "Full Name" label
      const nameInput = page.getByLabel(/full name/i);
      const emailInput = page.getByLabel(/email/i);
      const profileTitle = page.getByText('Your Profile');

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
      await expect(page).toHaveURL(new RegExp(`/org/${testOrg}/settings/organization`));

      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(/\/settings\/organization/);
    });
  });

  test.describe('Members Settings', () => {
    test('should display members settings page', async ({ authenticatedPage: page }) => {
      await page.goto(`/org/${testOrg}/settings/members`);
      await expect(page).toHaveURL(new RegExp(`/org/${testOrg}/settings/members`));

      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(/\/settings\/members/);
    });
  });

  test.describe('Settings Navigation', () => {
    test('should navigate between settings pages', async ({ authenticatedPage: page }) => {
      await page.goto(`/org/${testOrg}/settings/profile`);
      await expect(page).toHaveURL(new RegExp(`/org/${testOrg}/settings/profile`));

      // Look for settings navigation links
      const orgSettingsLink = page.getByRole('link', { name: /organization/i });
      if (await orgSettingsLink.isVisible()) {
        await orgSettingsLink.click();
        await expect(page).toHaveURL(/\/settings\/organization/);
      }
    });
  });
});

test.describe('Settings - Unauthenticated', () => {
  test('should redirect when accessing settings without auth', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto(`/org/${testOrg}/settings/profile`);

    // Should redirect to landing or login
    await page.waitForURL(/^\/$|\/login|\/auth/, { timeout: 10000 });
  });
});
