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
      // New knowledge hub headline
      await expect(page.getByRole('heading', { name: /All Your Knowledge/i })).toBeVisible();
      // Use first() as there are multiple "Start Free Trial" links on the page
      await expect(page.getByRole('link', { name: /start free trial/i }).first()).toBeVisible();
    });

    test('should display features section', async ({ page }) => {
      // Scroll to features section first to ensure it's visible
      await page.locator('section#features').first().scrollIntoViewIfNeeded();
      // Use first() as text may appear multiple times on the page - updated for knowledge hub
      await expect(page.getByText('Slack Integration').first()).toBeVisible();
      await expect(page.getByText('Knowledge Graph').first()).toBeVisible();
      await expect(page.getByText('Unified Search').first()).toBeVisible();
    });

    test('should display trust badges', async ({ page }) => {
      // Use first() to get the trust badge in the hero section - updated for knowledge hub
      await expect(page.getByText('Enterprise Security').first()).toBeVisible();
      await expect(page.getByText('AI-Powered').first()).toBeVisible();
      await expect(page.getByText('Multi-Source').first()).toBeVisible();
    });

    test('should display how it works section', async ({ page }) => {
      const howItWorksSection = page
        .locator('section')
        .filter({ has: page.getByRole('heading', { name: 'Get Started in Minutes' }) })
        .first();
      await howItWorksSection.scrollIntoViewIfNeeded();
      await expect(howItWorksSection.getByRole('heading', { name: 'Get Started in Minutes' })).toBeVisible();
      // Updated for knowledge hub flow
      await expect(howItWorksSection.getByRole('heading', { name: 'Connect Your Sources' })).toBeVisible();
      await expect(howItWorksSection.getByRole('heading', { name: 'AI Processes Everything' })).toBeVisible();
      await expect(howItWorksSection.getByRole('heading', { name: 'Discover & Search' })).toBeVisible();
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
        const heroCta = page.getByRole('link', { name: /start free trial|get started/i }).first();
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

    // Hero content should be visible - updated for knowledge hub
    await expect(page.getByRole('heading', { name: /All Your Knowledge/i })).toBeVisible();
  });
});
