import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for Nuclom Monorepo
 *
 * This config supports testing both apps:
 * - nuclom-saas: Main application (authenticated routes)
 * - nuclom-marketing: Marketing website (public pages)
 *
 * Environment variables:
 * - SAAS_BASE_URL: Base URL for saas app (default: http://localhost:3091)
 * - MARKETING_BASE_URL: Base URL for marketing app (default: http://localhost:3090)
 * - VERCEL_AUTOMATION_BYPASS_SECRET: For bypassing Vercel deployment protection
 */
export default defineConfig({
  testDir: '.',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Use 4 workers in CI for parallel execution (was: 1 which ran tests serially)
  workers: process.env.CI ? 4 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'html',
  outputDir: './test-results',
  // Global timeout limits to prevent tests hanging
  timeout: 30000, // 30s per test (default is 30s)
  expect: {
    timeout: 5000, // 5s for expect assertions (default is 5s)
  },

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    // Faster navigation - domcontentloaded is sufficient for most cases
    navigationTimeout: 10000,
    actionTimeout: 5000,
    // Bypass Vercel deployment protection in CI
    ...(process.env.VERCEL_AUTOMATION_BYPASS_SECRET && {
      extraHTTPHeaders: {
        'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
      },
    }),
  },

  projects: [
    // ========================================
    // SaaS App Tests (Authenticated)
    // ========================================
    {
      name: 'saas-setup',
      testMatch: /saas\/.*\.setup\.ts/,
      use: {
        baseURL: process.env.SAAS_BASE_URL ?? 'http://localhost:3091',
      },
    },
    {
      name: 'saas-chromium',
      testDir: './saas',
      testIgnore: /.*\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.SAAS_BASE_URL ?? 'http://localhost:3091',
        storageState: './saas/.auth/user.json',
      },
      dependencies: ['saas-setup'],
    },
    {
      name: 'saas-mobile',
      testDir: './saas',
      testIgnore: /.*\.setup\.ts/,
      use: {
        ...devices['Pixel 5'],
        baseURL: process.env.SAAS_BASE_URL ?? 'http://localhost:3091',
        storageState: './saas/.auth/user.json',
      },
      dependencies: ['saas-setup'],
    },

    // ========================================
    // Marketing App Tests (Public)
    // ========================================
    {
      name: 'marketing-chromium',
      testDir: './marketing',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.MARKETING_BASE_URL ?? 'http://localhost:3090',
      },
    },
    {
      name: 'marketing-mobile',
      testDir: './marketing',
      use: {
        ...devices['Pixel 5'],
        baseURL: process.env.MARKETING_BASE_URL ?? 'http://localhost:3090',
      },
    },
  ],
});
