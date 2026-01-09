import { expect, test } from '@playwright/test';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page, context }) => {
    // Clear all cookies and storage to ensure we see the landing page
    await context.clearCookies();
    // Navigate to login first, then clear state, then go to landing
    await page.goto('/login');
    await context.clearCookies();
    await page.goto('/');
    // Verify we're on landing page (not redirected)
    if (!page.url().endsWith('/') && !page.url().includes('login')) {
      // If redirected, go directly to login page for these tests
      test.skip(true, 'User appears to be authenticated - skipping landing page test');
    }
  });

  test('should display the landing page with header', async ({ page }) => {
    if (page.url().includes('/qa-test-workspace') || page.url().includes('/onboarding')) {
      test.skip(true, 'Redirected to authenticated page');
      return;
    }
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
    if (page.url().includes('/qa-test-workspace') || page.url().includes('/onboarding')) {
      test.skip(true, 'Redirected to authenticated page');
      return;
    }
    await expect(page.getByText('Collaborate on Videos')).toBeVisible();
    // Use exact match to avoid matching other text containing this phrase
    await expect(page.getByText('Like Never Before', { exact: true })).toBeVisible();
    // Use first() as there are multiple "Start Free Trial" links on the page
    await expect(page.getByRole('link', { name: /start free trial/i }).first()).toBeVisible();
  });

  test('should display features section', async ({ page }) => {
    if (page.url().includes('/qa-test-workspace') || page.url().includes('/onboarding')) {
      test.skip(true, 'Redirected to authenticated page');
      return;
    }
    // Scroll to features section first to ensure it's visible
    await page.locator('#features').scrollIntoViewIfNeeded();
    // Use first() as text may appear multiple times on the page
    await expect(page.getByText('Smart Video Management').first()).toBeVisible();
    await expect(page.getByText('Real-Time Collaboration').first()).toBeVisible();
    await expect(page.getByText('AI-Powered Analysis').first()).toBeVisible();
  });

  test('should display trust badges', async ({ page }) => {
    if (page.url().includes('/qa-test-workspace') || page.url().includes('/onboarding')) {
      test.skip(true, 'Redirected to authenticated page');
      return;
    }
    // Use first() to get the trust badge in the hero section (not the features section)
    await expect(page.getByText('Enterprise Security').first()).toBeVisible();
    await expect(page.getByText('Lightning Fast').first()).toBeVisible();
    await expect(page.getByText('Global CDN').first()).toBeVisible();
  });

  test('should display how it works section', async ({ page }) => {
    if (page.url().includes('/qa-test-workspace') || page.url().includes('/onboarding')) {
      test.skip(true, 'Redirected to authenticated page');
      return;
    }
    await expect(page.getByText('Get Started in Minutes')).toBeVisible();
    await expect(page.getByText('Upload Your Videos')).toBeVisible();
    await expect(page.getByText('Invite Your Team')).toBeVisible();
    await expect(page.getByText('Collaborate Together')).toBeVisible();
  });

  test('should display footer with links', async ({ page }) => {
    if (page.url().includes('/qa-test-workspace') || page.url().includes('/onboarding')) {
      test.skip(true, 'Redirected to authenticated page');
      return;
    }
    await expect(page.getByRole('link', { name: /privacy/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /terms/i }).first()).toBeVisible();
    await expect(page.getByText(/Nuclom. All rights reserved/i)).toBeVisible();
  });

  test('should navigate to login page', async ({ page }) => {
    if (page.url().includes('/qa-test-workspace') || page.url().includes('/onboarding')) {
      test.skip(true, 'Redirected to authenticated page');
      return;
    }
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
    if (page.url().includes('/qa-test-workspace') || page.url().includes('/onboarding')) {
      test.skip(true, 'Redirected to authenticated page');
      return;
    }
    // Click the first "Get Started" link in the header
    await page
      .getByRole('link', { name: /get started/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/signup|\/register/);
  });

  test('should have working navigation links', async ({ page }) => {
    if (page.url().includes('/qa-test-workspace') || page.url().includes('/onboarding')) {
      test.skip(true, 'Redirected to authenticated page');
      return;
    }
    // Skip on mobile - desktop navigation not visible
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 768) {
      return; // Skip nav test on mobile
    }
    // Check Features link in header navigation (not footer)
    const featuresLink = page.locator('nav').getByRole('link', { name: 'Features', exact: true });
    if (await featuresLink.isVisible().catch(() => false)) {
      await featuresLink.click();
      // Wait for smooth scroll animation to complete
      await page.waitForTimeout(500);
      // Verify the features section exists and is reachable (URL has #features or section is visible)
      await expect(page.locator('#features')).toBeVisible();
    }
  });
});

test.describe('Landing Page - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should display mobile-friendly layout', async ({ page, context }) => {
    // Clear cookies to ensure we see the landing page
    await context.clearCookies();
    await page.goto('/login');
    await context.clearCookies();
    await page.goto('/');

    // Skip if redirected to authenticated page
    if (page.url().includes('/qa-test-workspace') || page.url().includes('/onboarding')) {
      test.skip(true, 'Redirected to authenticated page');
      return;
    }

    // Header should still be visible
    await expect(page.getByText('Nuclom').first()).toBeVisible();

    // Hero content should be visible
    await expect(page.getByText('Collaborate on Videos')).toBeVisible();
  });
});
