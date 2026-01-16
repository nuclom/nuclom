import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E Test Configuration for Nuclom
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
	testDir: "./e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "html",

	use: {
		baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3091",
		trace: "on-first-retry",
		screenshot: "only-on-failure",
		video: "on-first-retry",
		// Bypass Vercel deployment protection in CI
		...(process.env.VERCEL_AUTOMATION_BYPASS_SECRET && {
			extraHTTPHeaders: {
				"x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
			},
		}),
	},

	projects: [
		// Setup project to create authenticated state
		{ name: "setup", testMatch: /.*\.setup\.ts/ },

		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
			dependencies: ["setup"],
		},

		// Mobile viewport testing
		{
			name: "mobile-chrome",
			use: { ...devices["Pixel 5"] },
			dependencies: ["setup"],
		},
	],

	// Run local dev server before tests when not in CI
	webServer: process.env.CI
		? undefined
		: {
			command: "pnpm dev",
			url: "http://localhost:3091",
			reuseExistingServer: !process.env.CI,
			timeout: 120 * 1000,
		},
});
