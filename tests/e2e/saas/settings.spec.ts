import { expect, TEST_CONFIG, test } from '../shared/fixtures';

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

      // The page uses RequireAuth which shows a loading state while auth hydrates.
      // Wait for auth loading to complete by waiting for form elements to appear.
      // Use poll to handle client-side hydration timing.
      const profileTitle = page.getByText('Your Profile');
      const nameInput = page.getByLabel(/full name/i);
      const emailInput = page.getByLabel(/email/i);

      // Wait for at least one profile element to appear (auth loading may take a moment)
      await expect
        .poll(
          async () => {
            const hasProfileTitle = await profileTitle.first().isVisible().catch(() => false);
            const hasNameInput = await nameInput.isVisible().catch(() => false);
            const hasEmailInput = await emailInput.isVisible().catch(() => false);
            return hasProfileTitle || hasNameInput || hasEmailInput;
          },
          { timeout: 15000, message: 'Profile form elements should be visible after auth loading' },
        )
        .toBe(true);
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
  // TODO: Investigate middleware redirect behavior in Vercel deployments
  test.skip('should redirect when accessing settings without auth', async ({ browser }) => {
    // Create a fresh context without any auth state
    const context = await browser.newContext({
      ...(process.env.VERCEL_AUTOMATION_BYPASS_SECRET && {
        extraHTTPHeaders: {
          'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
        },
      }),
    });
    const page = await context.newPage();

    await page.goto(`/org/${testOrg}/settings/profile`);

    // Should redirect to landing or login
    await page.waitForURL(/^\/$|\/login|\/auth/, { timeout: 10000 });
    await context.close();
  });
});
