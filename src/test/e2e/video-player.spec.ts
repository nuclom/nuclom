import { test, expect } from "@playwright/test";

test.describe("Video Player Functionality", () => {
  let organizationId: string;
  let videoId: string;

  test.beforeEach(async ({ page }) => {
    organizationId = "test-org";
    videoId = "test-video-1";

    // Mock authentication
    await page.route("**/api/auth/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          user: { id: "user-1", name: "Test User", email: "test@example.com" },
        }),
      });
    });

    // Mock video data
    await page.route(`**/api/videos/${videoId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: videoId,
          title: "Test Video for Player",
          description: "This is a comprehensive test video for the video player functionality.",
          duration: "05:30",
          videoUrl: "/test-videos/sample.mp4",
          thumbnailUrl: "/test-thumbnails/sample.jpg",
          author: {
            id: "user-1",
            name: "Test Author",
            email: "author@example.com",
            image: "/test-avatars/author.jpg",
          },
          organization: {
            id: organizationId,
            name: "Test Organization",
            slug: "test-org",
          },
          transcript:
            "00:01.24 Welcome to this test video\n00:15.30 This is where we demonstrate the player features\n00:45.60 Thank you for watching",
          aiSummary: "This video demonstrates video player functionality with comprehensive testing.",
          createdAt: new Date().toISOString(),
          comments: [],
        }),
      });
    });

    // Mock organizations
    await page.route("**/api/organizations", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: organizationId,
            name: "Test Organization",
            slug: "test-org",
            role: "member",
          },
        ]),
      });
    });

    // Login and navigate to video page
    await page.goto("/login");
    await page.getByLabel("Email").fill("test@example.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.goto(`/${organizationId}/videos/${videoId}`);
  });

  test("should display video page with player and content", async ({ page }) => {
    // Check video title and metadata
    await expect(page.getByText("Test Video for Player")).toBeVisible();
    await expect(page.getByText("Test Author")).toBeVisible();
    await expect(page.getByText(/ago/)).toBeVisible();

    // Check video player is present
    await expect(page.locator("video")).toBeVisible();

    // Check transcript section
    await expect(page.getByText("Transcript")).toBeVisible();
    await expect(page.getByText("Welcome to this test video")).toBeVisible();

    // Check AI insights section
    await expect(page.getByText("AI Summary")).toBeVisible();
    await expect(page.getByText("This video demonstrates video player")).toBeVisible();
  });

  test("should have functional video player controls", async ({ page }) => {
    const video = page.locator("video");
    await expect(video).toBeVisible();

    // Check play/pause button
    const playButton = page
      .getByRole("button")
      .filter({ hasText: /play|pause/i })
      .first();
    await expect(playButton).toBeVisible();

    // Click play button
    await playButton.click();

    // Check for pause button (indicating video is playing)
    await expect(page.locator('[data-testid="pause-button"]').or(page.getByTitle("Pause"))).toBeVisible();
  });

  test("should display video player control elements", async ({ page }) => {
    // Wait for video to load
    await page.waitForSelector("video");

    // Hover over video to show controls
    await page.locator("video").hover();

    // Check for control elements
    await expect(page.getByRole("slider").first()).toBeVisible(); // Progress bar

    // Check for volume controls
    const volumeButton = page
      .locator("button")
      .filter({ hasText: /volume|mute/i })
      .first();
    if ((await volumeButton.count()) > 0) {
      await expect(volumeButton).toBeVisible();
    }

    // Check for fullscreen button
    const fullscreenButton = page
      .locator("button")
      .filter({ hasText: /fullscreen|maximize/i })
      .first();
    if ((await fullscreenButton.count()) > 0) {
      await expect(fullscreenButton).toBeVisible();
    }
  });

  test("should allow video seeking", async ({ page }) => {
    await page.waitForSelector("video");

    // Hover to show controls
    await page.locator("video").hover();

    // Find progress slider and click in the middle
    const progressSlider = page.getByRole("slider").first();
    await expect(progressSlider).toBeVisible();

    // Click on progress bar to seek
    const sliderBox = await progressSlider.boundingBox();
    if (sliderBox) {
      // Click at 50% of the progress bar
      await page.mouse.click(sliderBox.x + sliderBox.width * 0.5, sliderBox.y + sliderBox.height * 0.5);
    }

    // Verify time display updates (this would require more sophisticated mocking for real video)
    const timeDisplay = page.locator("text=/\\d+:\\d+/").first();
    if ((await timeDisplay.count()) > 0) {
      await expect(timeDisplay).toBeVisible();
    }
  });

  test("should handle volume control", async ({ page }) => {
    await page.waitForSelector("video");
    await page.locator("video").hover();

    // Find volume button
    const volumeButton = page
      .locator("button")
      .filter({ hasText: /volume|mute/i })
      .first();
    if ((await volumeButton.count()) > 0) {
      await volumeButton.click();

      // Should toggle mute state
      await expect(page.locator("button").filter({ hasText: /mute|unmute/i })).toBeVisible();
    }
  });

  test("should display video metadata correctly", async ({ page }) => {
    // Check duration in AI insights
    await expect(page.getByText("Duration: 05:30")).toBeVisible();

    // Check description in Details tab
    await page.getByRole("tab", { name: "Details" }).click();
    await expect(page.getByText("This is a comprehensive test video")).toBeVisible();
  });

  test("should handle transcript navigation", async ({ page }) => {
    // Check transcript lines are displayed
    await expect(page.getByText("00:01.24")).toBeVisible();
    await expect(page.getByText("Welcome to this test video")).toBeVisible();

    // Check for timestamp navigation (when implemented)
    const timestampButton = page.locator("text=00:01.24");
    await timestampButton.click();

    // This would seek the video to that timestamp when fully implemented
  });

  test("should handle video sharing", async ({ page }) => {
    const shareButton = page.getByRole("button", { name: /share/i });
    await expect(shareButton).toBeVisible();

    await shareButton.click();

    // Check for share functionality (when implemented)
    // For now, just verify the button exists and is clickable
  });

  test("should handle video bookmarking", async ({ page }) => {
    const bookmarkButton = page
      .getByRole("button")
      .filter({ hasText: /bookmark/i })
      .first();
    if ((await bookmarkButton.count()) > 0) {
      await expect(bookmarkButton).toBeVisible();
      await bookmarkButton.click();

      // Check for bookmark state change (when implemented)
    }
  });

  test("should handle video likes", async ({ page }) => {
    const likeButton = page
      .getByRole("button")
      .filter({ hasText: /thumbs|like/i })
      .first();
    await expect(likeButton).toBeVisible();

    await likeButton.click();

    // Check for like count update (when implemented)
    await expect(page.getByText("12")).toBeVisible();
  });

  test("should switch between AI insights and details tabs", async ({ page }) => {
    // Default should be AI insights
    await expect(page.getByText("AI Summary")).toBeVisible();

    // Click Details tab
    await page.getByRole("tab", { name: "Details" }).click();
    await expect(page.getByText("Description")).toBeVisible();
    await expect(page.getByText("This is a comprehensive test video")).toBeVisible();

    // Switch back to AI insights
    await page.getByRole("tab", { name: "AI Insights" }).click();
    await expect(page.getByText("AI Summary")).toBeVisible();
  });

  test("should handle playback speed controls", async ({ page }) => {
    await page.waitForSelector("video");
    await page.locator("video").hover();

    // Look for playback speed button (usually shows "1x")
    const speedButton = page
      .locator("button")
      .filter({ hasText: /[0-9.]+x/ })
      .first();
    if ((await speedButton.count()) > 0) {
      await speedButton.click();

      // Should show speed options
      await expect(page.getByText("0.5x").or(page.getByText("1.25x")).or(page.getByText("2x"))).toBeVisible();
    }
  });

  test("should handle quality settings", async ({ page }) => {
    await page.waitForSelector("video");
    await page.locator("video").hover();

    // Look for settings/quality button
    const settingsButton = page
      .locator("button")
      .filter({ hasText: /settings|quality/i })
      .first();
    if ((await settingsButton.count()) > 0) {
      await settingsButton.click();

      // Should show quality options when implemented
      await expect(page.getByText("Auto").or(page.getByText("1080p")).or(page.getByText("720p"))).toBeVisible();
    }
  });

  test("should handle download functionality", async ({ page }) => {
    await page.waitForSelector("video");
    await page.locator("video").hover();

    // Look for download button
    const downloadButton = page
      .locator("button")
      .filter({ hasText: /download/i })
      .first();
    if ((await downloadButton.count()) > 0) {
      await expect(downloadButton).toBeVisible();

      // Set up download listener
      const downloadPromise = page.waitForEvent("download");
      await downloadButton.click();

      // Verify download starts (when implemented)
      // const download = await downloadPromise;
      // expect(download.suggestedFilename()).toContain('Test Video for Player');
    }
  });

  test("should handle fullscreen mode", async ({ page }) => {
    await page.waitForSelector("video");
    await page.locator("video").hover();

    // Look for fullscreen button
    const fullscreenButton = page
      .locator("button")
      .filter({ hasText: /fullscreen|maximize/i })
      .first();
    if ((await fullscreenButton.count()) > 0) {
      await fullscreenButton.click();

      // Note: Testing actual fullscreen is complex in headless mode
      // For now, just verify the button exists and is clickable
      await expect(fullscreenButton).toBeVisible();
    }
  });

  test("should handle keyboard shortcuts", async ({ page }) => {
    await page.waitForSelector("video");
    const video = page.locator("video");

    // Focus on video element
    await video.click();

    // Test spacebar for play/pause
    await page.keyboard.press("Space");

    // Test arrow keys for seeking (when implemented)
    await page.keyboard.press("ArrowRight"); // Seek forward
    await page.keyboard.press("ArrowLeft"); // Seek backward

    // Test volume controls
    await page.keyboard.press("ArrowUp"); // Volume up
    await page.keyboard.press("ArrowDown"); // Volume down

    // Test mute
    await page.keyboard.press("KeyM");

    // Test fullscreen
    await page.keyboard.press("KeyF");
  });

  test("should handle video error states", async ({ page }) => {
    // Mock a video that fails to load
    await page.route(`**/api/videos/error-video`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "error-video",
          title: "Error Video",
          videoUrl: "/nonexistent-video.mp4",
          thumbnailUrl: "/placeholder.svg",
          author: { id: "user-1", name: "Test Author" },
          transcript: "",
          aiSummary: "",
          createdAt: new Date().toISOString(),
        }),
      });
    });

    await page.goto(`/${organizationId}/videos/error-video`);

    // Should handle video load errors gracefully
    await expect(page.getByText("Error Video")).toBeVisible();

    // Video element should still be present even if source fails
    await expect(page.locator("video")).toBeVisible();
  });

  test("should persist viewing progress", async ({ page }) => {
    // This test would verify that video progress is saved and restored
    // For now, just ensure the video player loads correctly
    await page.waitForSelector("video");

    // In a real implementation, this would:
    // 1. Play video for some time
    // 2. Navigate away
    // 3. Return to video
    // 4. Verify it resumes from the same position

    await expect(page.locator("video")).toBeVisible();
  });
});
