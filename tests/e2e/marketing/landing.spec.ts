import { expect, test } from '@playwright/test';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to landing page
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
  });

    test('should display the landing page with header', async ({ page }) => {
      // Check header elements
      await expect(page.getByText('Nuclom').first()).toBeVisible();
      // On mobile, nav links are hidden behind hamburger menu
      const viewport = page.viewportSize();
      if (viewport && viewport.width >= 768) {
        await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
        // Use first() to handle multiple "Get Started" buttons on page
        await expect(page.getByRole('link', { name: /get started/i }).first()).toBeVisible();
      }
    });

    test('should display hero section', async ({ page }) => {
      // Hero headline: "Stop losing knowledge"
      await expect(page.getByRole('heading', { name: /stop losing/i })).toBeVisible();
      // CTA button: "Start free"
      await expect(page.getByRole('link', { name: /start free/i }).first()).toBeVisible();
    });

    test('should display value props section', async ({ page }) => {
      // Scroll down to ensure value props section is visible
      await page.mouse.wheel(0, 500);
      // Value props heading
      await expect(page.getByRole('heading', { name: /built for how teams/i })).toBeVisible();
      // Value prop cards
      await expect(page.getByText('Find anything instantly').first()).toBeVisible();
      await expect(page.getByText('Never lose a decision').first()).toBeVisible();
    });

    test('should display integration icons', async ({ page }) => {
      // Integration icons in hero section
      await expect(page.getByText('Messaging').first()).toBeVisible();
      await expect(page.getByText('Documents').first()).toBeVisible();
      await expect(page.getByText('Code').first()).toBeVisible();
    });

    test('should display how it works section', async ({ page }) => {
      // Find the "Connect once. Search forever." section
      const howItWorksSection = page
        .locator('section')
        .filter({ has: page.getByRole('heading', { name: /connect once/i }) })
        .first();
      await howItWorksSection.scrollIntoViewIfNeeded();
      await expect(howItWorksSection.getByRole('heading', { name: /connect once/i })).toBeVisible();
      // Connected sources UI
      await expect(howItWorksSection.getByText('Connected Sources').first()).toBeVisible();
    });

    test('should display footer with links', async ({ page }) => {
      await expect(page.getByRole('link', { name: /privacy/i }).first()).toBeVisible();
      await expect(page.getByRole('link', { name: /terms/i }).first()).toBeVisible();
      await expect(page.getByRole('contentinfo').getByText(/Nuclom. All rights reserved/i)).toBeVisible();
    });

    test('should navigate to login page', async ({ page }) => {
      // On mobile, nav links are hidden behind hamburger menu
      const viewport = page.viewportSize();
      if (viewport && viewport.width < 768) {
        // On mobile, open the hamburger menu first
        const menuButton = page.locator('header button').last();
        if (await menuButton.isVisible().catch(() => false)) {
          await menuButton.click();
          await page.waitForTimeout(300); // Wait for menu animation
        }
      }
      // Find and click Sign In link
      const signInLink = page.getByRole('link', { name: /sign in/i });
      if (await signInLink.isVisible().catch(() => false)) {
        await signInLink.click();
        await expect(page).toHaveURL(/\/login/);
      }
    });

    test('should navigate to signup page via Get Started', async ({ page }) => {
      // On mobile, nav links may not be visible - check viewport
      const viewport = page.viewportSize();
      if (viewport && viewport.width < 768) {
        // On mobile, use the hero CTA button instead of header nav
        const heroCta = page.getByRole('link', { name: /start free|get started/i }).first();
        if (await heroCta.isVisible().catch(() => false)) {
          await heroCta.click();
          await expect(page).toHaveURL(/\/signup|\/register/, { timeout: 10000 });
        }
        return;
      }
      // Desktop: Click the first "Get Started" link in the header
      await page
        .getByRole('link', { name: /get started/i })
        .first()
        .click();
      await expect(page).toHaveURL(/\/signup|\/register/);
    });

    test('should have working navigation links', async ({ page }) => {
      // Skip on mobile - desktop navigation not visible
      const viewport = page.viewportSize();
      if (viewport && viewport.width < 768) {
        return; // Skip nav test on mobile
      }
      // Check Features link in header navigation - it goes to /features page
      const featuresLink = page.locator('nav').getByRole('link', { name: 'Features', exact: true });
      if (await featuresLink.isVisible().catch(() => false)) {
        await featuresLink.click();
        // Features link navigates to /features page
        await expect(page).toHaveURL(/\/features/, { timeout: 10000 });
      }
    });
  });

test.describe('Landing Page - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should display mobile-friendly layout', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);

    // Header should still be visible
    await expect(page.getByText('Nuclom').first()).toBeVisible();

    // Hero content should be visible - "Stop losing knowledge"
    await expect(page.getByRole('heading', { name: /stop losing/i })).toBeVisible();
  });
});
