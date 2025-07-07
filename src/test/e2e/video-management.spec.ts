import { test, expect } from "@playwright/test";

test.describe("Video Management", () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.goto("/login");

    // Mock successful authentication
    await page.route("**/api/auth/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, user: { id: "user-1", name: "Test User" } }),
      });
    });

    // Mock organizations
    await page.route("**/api/organizations", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ id: "org-1", name: "Test Organization", slug: "test-org" }]),
      });
    });

    // Login and navigate
    await page.getByLabel("Email").fill("test@example.com");
    await page.getByLabel("Password").first().fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();

    // Should redirect to organization page
    await page.waitForURL("**/test-org");
  });

  test("should display video upload page", async ({ page }) => {
    await page.goto("/test-org/upload");

    await expect(page.getByText("Upload Video")).toBeVisible();
    await expect(page.getByText("Title")).toBeVisible();
    await expect(page.getByText("Description")).toBeVisible();
  });

  test("should display videos list", async ({ page }) => {
    // Mock videos API
    await page.route("**/api/videos**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          videos: [
            {
              id: "video-1",
              title: "Test Video 1",
              duration: "10:30",
              thumbnailUrl: "/test-thumbnail.jpg",
              author: { id: "user-1", name: "Test User", image: null },
            },
            {
              id: "video-2",
              title: "Test Video 2",
              duration: "05:45",
              thumbnailUrl: "/test-thumbnail2.jpg",
              author: { id: "user-1", name: "Test User", image: null },
            },
          ],
          total: 2,
        }),
      });
    });

    await page.goto("/test-org");

    await expect(page.getByText("Test Video 1")).toBeVisible();
    await expect(page.getByText("Test Video 2")).toBeVisible();
    await expect(page.getByText("10:30")).toBeVisible();
    await expect(page.getByText("05:45")).toBeVisible();
  });

  test("should navigate to video detail page", async ({ page }) => {
    // Mock videos API
    await page.route("**/api/videos**", async (route) => {
      if (route.request().url().includes("video-1")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "video-1",
            title: "Test Video 1",
            description: "This is a test video description",
            duration: "10:30",
            videoUrl: "/test-video.mp4",
            author: { id: "user-1", name: "Test User", image: null },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            videos: [
              {
                id: "video-1",
                title: "Test Video 1",
                duration: "10:30",
                thumbnailUrl: "/test-thumbnail.jpg",
                author: { id: "user-1", name: "Test User", image: null },
              },
            ],
            total: 1,
          }),
        });
      }
    });

    await page.goto("/test-org");

    // Click on video card
    await page.getByText("Test Video 1").click();

    await expect(page).toHaveURL("**/test-org/videos/video-1");
    await expect(page.getByText("This is a test video description")).toBeVisible();
  });

  test("should handle video upload form submission", async ({ page }) => {
    // Mock video upload API
    await page.route("**/api/videos/upload", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          videoUrl: "/uploaded-video.mp4",
          thumbnailUrl: "/uploaded-thumbnail.jpg",
        }),
      });
    });

    await page.route("**/api/videos", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "new-video-1",
            title: "New Test Video",
            duration: "12:34",
          }),
        });
      }
    });

    await page.goto("/test-org/upload");

    await page.getByLabel("Title").fill("New Test Video");
    await page.getByLabel("Description").fill("This is a new test video");

    // Mock file upload
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "test-video.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.from("fake video content"),
    });

    await page.getByRole("button", { name: "Upload" }).click();

    await expect(page.getByText("Uploading...")).toBeVisible();
  });

  test("should display search functionality", async ({ page }) => {
    await page.goto("/test-org/search");

    await expect(page.getByPlaceholder("Search videos...")).toBeVisible();
    await expect(page.getByRole("button", { name: "Search" })).toBeVisible();
  });
});
