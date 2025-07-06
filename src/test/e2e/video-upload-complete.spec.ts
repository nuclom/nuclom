import { test, expect } from "@playwright/test";
import path from "path";

test.describe("Complete Video Upload Workflow", () => {
  let organizationId: string;

  test.beforeEach(async ({ page }) => {
    organizationId = "test-org";

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
            role: "owner",
          },
        ]),
      });
    });

    // Login first
    await page.goto("/login");
    await page.getByLabel("Email").fill("test@example.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();

    // Navigate to upload page
    await page.goto(`/${organizationId}/upload`);
  });

  test("should display upload page with all required elements", async ({ page }) => {
    await expect(page.getByText("Upload Video")).toBeVisible();
    await expect(page.getByText("Title")).toBeVisible();
    await expect(page.getByText("Description")).toBeVisible();
    await expect(page.getByText("Channel")).toBeVisible();
    await expect(page.getByText("Collection")).toBeVisible();

    // Check for file upload area
    await expect(
      page.locator('[data-testid="upload-area"]').or(page.getByText("Choose files or drag and drop")),
    ).toBeVisible();
  });

  test("should handle video file upload with drag and drop", async ({ page }) => {
    // Mock successful upload
    await page.route("**/api/videos/upload", async (route) => {
      const request = route.request();
      if (request.method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            videoUrl: "/uploads/test-video.mp4",
            thumbnailUrl: "/uploads/test-thumbnail.jpg",
            duration: "02:15",
          }),
        });
      }
    });

    // Mock video creation
    await page.route("**/api/videos", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "video-1",
            title: "Test Video Upload",
            videoUrl: "/uploads/test-video.mp4",
            thumbnailUrl: "/uploads/test-thumbnail.jpg",
            duration: "02:15",
          }),
        });
      }
    });

    // Create a test file
    const fileBuffer = Buffer.from("fake video content for testing");

    // Find file input and upload
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "test-video.mp4",
      mimeType: "video/mp4",
      buffer: fileBuffer,
    });

    // Fill in video details
    await page.getByLabel("Title").fill("Test Video Upload");
    await page.getByLabel("Description").fill("This is a test video upload for E2E testing");

    // Submit upload
    await page.getByRole("button", { name: /upload|submit/i }).click();

    // Check for upload progress indicators
    await expect(page.getByText(/uploading|processing/i)).toBeVisible();
  });

  test("should validate required fields before upload", async ({ page }) => {
    // Try to submit without title
    await page.getByRole("button", { name: /upload|submit/i }).click();

    // Should show validation error
    await expect(page.getByText(/title.*required/i)).toBeVisible();
  });

  test("should handle large file upload with progress tracking", async ({ page }) => {
    let uploadProgress = 0;

    await page.route("**/api/videos/upload", async (route) => {
      // Simulate progressive upload
      if (uploadProgress < 100) {
        uploadProgress += 25;
        await route.fulfill({
          status: 202, // Accepted, processing
          contentType: "application/json",
          body: JSON.stringify({
            progress: uploadProgress,
            message: `Upload ${uploadProgress}% complete`,
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            videoUrl: "/uploads/large-video.mp4",
            thumbnailUrl: "/uploads/large-thumbnail.jpg",
            duration: "10:30",
          }),
        });
      }
    });

    // Upload large file
    const largeFileBuffer = Buffer.alloc(1024 * 1024 * 50); // 50MB mock file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "large-video.mp4",
      mimeType: "video/mp4",
      buffer: largeFileBuffer,
    });

    await page.getByLabel("Title").fill("Large Video Test");
    await page.getByRole("button", { name: /upload|submit/i }).click();

    // Check for progress indicators
    await expect(page.locator('[role="progressbar"]').or(page.getByText(/\d+%/))).toBeVisible();
  });

  test("should handle upload errors gracefully", async ({ page }) => {
    // Mock upload failure
    await page.route("**/api/videos/upload", async (route) => {
      await route.fulfill({
        status: 413, // Payload too large
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          error: "File size exceeds maximum limit of 500MB",
        }),
      });
    });

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "huge-video.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.alloc(1024),
    });

    await page.getByLabel("Title").fill("Error Test Video");
    await page.getByRole("button", { name: /upload|submit/i }).click();

    // Should show error message
    await expect(page.getByText(/file size exceeds maximum/i)).toBeVisible();
  });

  test("should validate file types", async ({ page }) => {
    // Try to upload invalid file type
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "document.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("fake pdf content"),
    });

    // Should show file type error
    await expect(page.getByText(/invalid file type|supported formats/i)).toBeVisible();
  });

  test("should allow video metadata editing", async ({ page }) => {
    // Mock channels and collections
    await page.route("**/api/channels**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { id: "channel-1", name: "General", description: "General channel" },
          { id: "channel-2", name: "Tutorials", description: "Tutorial videos" },
        ]),
      });
    });

    await page.route("**/api/collections**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { id: "collection-1", name: "Series 1", description: "First series" },
          { id: "collection-2", name: "Weekly Updates", description: "Weekly update videos" },
        ]),
      });
    });

    // Fill metadata fields
    await page.getByLabel("Title").fill("Comprehensive Test Video");
    await page
      .getByLabel("Description")
      .fill("A detailed description of the test video with multiple lines of content.");

    // Select channel if dropdown exists
    const channelSelect = page.locator("select").filter({ hasText: "Channel" }).or(page.getByLabel("Channel"));
    if ((await channelSelect.count()) > 0) {
      await channelSelect.selectOption("channel-1");
    }

    // Select collection if dropdown exists
    const collectionSelect = page.locator("select").filter({ hasText: "Collection" }).or(page.getByLabel("Collection"));
    if ((await collectionSelect.count()) > 0) {
      await collectionSelect.selectOption("collection-1");
    }

    // Verify fields are filled
    await expect(page.getByLabel("Title")).toHaveValue("Comprehensive Test Video");
    await expect(page.getByLabel("Description")).toHaveValue(
      "A detailed description of the test video with multiple lines of content.",
    );
  });

  test("should handle upload cancellation", async ({ page }) => {
    // Start upload
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "cancel-test.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.alloc(1024),
    });

    await page.getByLabel("Title").fill("Cancel Test Video");

    // Mock slow upload to allow cancellation
    await page.route("**/api/videos/upload", async (route) => {
      // Delay response to simulate slow upload
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await page.getByRole("button", { name: /upload|submit/i }).click();

    // Look for cancel button and click it
    const cancelButton = page.getByRole("button", { name: /cancel/i });
    if ((await cancelButton.count()) > 0) {
      await cancelButton.click();
      await expect(page.getByText(/upload.*cancelled|cancelled.*upload/i)).toBeVisible();
    }
  });

  test("should redirect to video page after successful upload", async ({ page }) => {
    // Mock successful upload and video creation
    await page.route("**/api/videos/upload", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          videoUrl: "/uploads/success-video.mp4",
          thumbnailUrl: "/uploads/success-thumbnail.jpg",
          duration: "03:45",
        }),
      });
    });

    await page.route("**/api/videos", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "success-video-1",
            title: "Success Upload Test",
            videoUrl: "/uploads/success-video.mp4",
          }),
        });
      }
    });

    // Complete upload flow
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "success-test.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.alloc(1024),
    });

    await page.getByLabel("Title").fill("Success Upload Test");
    await page.getByRole("button", { name: /upload|submit/i }).click();

    // Wait for upload completion and redirect
    await expect(page.getByText(/upload.*success|success.*upload/i)).toBeVisible();

    // Should redirect to video page or back to videos list
    await expect(page).toHaveURL(new RegExp(`/${organizationId}/(videos|my-videos)`));
  });

  test("should handle multiple file uploads", async ({ page }) => {
    // Mock batch upload support
    await page.route("**/api/videos/upload", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          uploads: [
            { videoUrl: "/uploads/batch-1.mp4", thumbnailUrl: "/uploads/batch-1.jpg" },
            { videoUrl: "/uploads/batch-2.mp4", thumbnailUrl: "/uploads/batch-2.jpg" },
          ],
        }),
      });
    });

    // Try to upload multiple files
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([
      {
        name: "batch-video-1.mp4",
        mimeType: "video/mp4",
        buffer: Buffer.alloc(1024),
      },
      {
        name: "batch-video-2.mp4",
        mimeType: "video/mp4",
        buffer: Buffer.alloc(1024),
      },
    ]);

    // Should show multiple files or handle appropriately
    await expect(page.getByText(/2.*files|multiple.*files/i).or(page.getByText("batch-video-1.mp4"))).toBeVisible();
  });
});
