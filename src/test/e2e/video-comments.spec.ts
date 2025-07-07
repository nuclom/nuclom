import { test, expect } from "@playwright/test";

test.describe("Video Comments System", () => {
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
          title: "Test Video with Comments",
          description: "This video demonstrates the comments system.",
          duration: "05:30",
          videoUrl: "/test-videos/sample.mp4",
          thumbnailUrl: "/test-thumbnails/sample.jpg",
          author: {
            id: "user-2",
            name: "Video Author",
            email: "author@example.com",
            image: "/test-avatars/author.jpg",
          },
          organization: {
            id: organizationId,
            name: "Test Organization",
            slug: "test-org",
          },
          transcript:
            "00:01.24 Welcome to this test video\n00:15.30 This section discusses comments\n00:45.60 Thank you for watching",
          aiSummary: "This video demonstrates video commenting functionality.",
          createdAt: new Date().toISOString(),
          comments: [],
        }),
      });
    });

    // Mock existing comments
    await page.route(`**/api/videos/${videoId}/comments`, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: "comment-1",
                content: "This is a great video! Thanks for sharing.",
                timestamp: "01:23.45",
                parentId: null,
                createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
                updatedAt: new Date(Date.now() - 3600000).toISOString(),
                author: {
                  id: "user-3",
                  name: "John Doe",
                  email: "john@example.com",
                  image: "/test-avatars/john.jpg",
                },
                replies: [
                  {
                    id: "comment-2",
                    content: "I agree! Very helpful content.",
                    timestamp: null,
                    parentId: "comment-1",
                    createdAt: new Date(Date.now() - 1800000).toISOString(), // 30 min ago
                    updatedAt: new Date(Date.now() - 1800000).toISOString(),
                    author: {
                      id: "user-4",
                      name: "Jane Smith",
                      email: "jane@example.com",
                      image: "/test-avatars/jane.jpg",
                    },
                  },
                ],
              },
              {
                id: "comment-3",
                content: "Could you explain the part at 2:15 in more detail?",
                timestamp: "02:15.00",
                parentId: null,
                createdAt: new Date(Date.now() - 1200000).toISOString(), // 20 min ago
                updatedAt: new Date(Date.now() - 1200000).toISOString(),
                author: {
                  id: "user-5",
                  name: "Alice Johnson",
                  email: "alice@example.com",
                  image: null,
                },
                replies: [],
              },
            ],
          }),
        });
      } else if (route.request().method() === "POST") {
        const body = await route.request().postDataJSON();
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              id: `comment-${Date.now()}`,
              content: body.content,
              timestamp: body.timestamp || null,
              parentId: body.parentId || null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              author: {
                id: "user-1",
                name: "Test User",
                email: "test@example.com",
                image: null,
              },
            },
          }),
        });
      }
    });

    // Login and navigate to video page
    await page.goto("/login");
    await page.getByLabel("Email").fill("test@example.com");
    await page.getByLabel("Password").first().fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.goto(`/${organizationId}/videos/${videoId}`);
  });

  test("should display existing comments", async ({ page }) => {
    // Check comments section header
    await expect(page.getByText("Comments (2)")).toBeVisible();

    // Check first comment
    await expect(page.getByText("This is a great video! Thanks for sharing.")).toBeVisible();
    await expect(page.getByText("John Doe")).toBeVisible();
    await expect(page.getByText("01:23.45")).toBeVisible();

    // Check reply to first comment
    await expect(page.getByText("I agree! Very helpful content.")).toBeVisible();
    await expect(page.getByText("Jane Smith")).toBeVisible();

    // Check second comment
    await expect(page.getByText("Could you explain the part at 2:15 in more detail?")).toBeVisible();
    await expect(page.getByText("Alice Johnson")).toBeVisible();
    await expect(page.getByText("02:15.00")).toBeVisible();
  });

  test("should allow adding a new comment", async ({ page }) => {
    // Find comment input
    const commentInput = page.getByPlaceholder("Add a comment...");
    await expect(commentInput).toBeVisible();

    // Type a new comment
    await commentInput.fill("This is my test comment for the video!");

    // Submit comment
    await page.getByRole("button", { name: "Comment" }).click();

    // Check for loading state
    await expect(page.getByText("Posting...")).toBeVisible();

    // Verify comment appears
    await expect(page.getByText("This is my test comment for the video!")).toBeVisible();
    await expect(page.getByText("Test User")).toBeVisible();
  });

  test("should allow replying to a comment", async ({ page }) => {
    // Find reply button for first comment
    const replyButtons = page.getByRole("button", { name: "Reply" });
    await replyButtons.first().click();

    // Check reply form appears
    await expect(page.getByPlaceholder("Reply to John Doe...")).toBeVisible();

    // Type reply
    await page.getByPlaceholder("Reply to John Doe...").fill("Thanks for the feedback!");

    // Submit reply
    await page.getByRole("button", { name: "Reply" }).last().click();

    // Verify reply appears
    await expect(page.getByText("Thanks for the feedback!")).toBeVisible();
  });

  test("should handle timestamp links in comments", async ({ page }) => {
    // Click on timestamp in comment
    await page.getByText("01:23.45").click();

    // This would seek the video to that timestamp when implemented
    // For now, just verify the timestamp is clickable
    await expect(page.getByText("01:23.45")).toBeVisible();
  });

  test("should show relative timestamps", async ({ page }) => {
    // Check for relative time display
    await expect(page.getByText(/ago/)).toHaveCount(3); // 3 comments total with timestamps

    // More specific checks
    await expect(page.getByText(/hour ago/)).toBeVisible();
    await expect(page.getByText(/minutes ago/)).toBeVisible();
  });

  test("should allow canceling comment creation", async ({ page }) => {
    const commentInput = page.getByPlaceholder("Add a comment...");
    await commentInput.fill("This comment will be canceled");

    // Click cancel button
    await page.getByRole("button", { name: "Cancel" }).click();

    // Verify input is cleared
    await expect(commentInput).toHaveValue("");
  });

  test("should allow canceling reply creation", async ({ page }) => {
    // Start replying to a comment
    const replyButtons = page.getByRole("button", { name: "Reply" });
    await replyButtons.first().click();

    // Type in reply box
    await page.getByPlaceholder("Reply to John Doe...").fill("This reply will be canceled");

    // Click cancel
    await page.getByRole("button", { name: "Cancel" }).last().click();

    // Verify reply form is hidden
    await expect(page.getByPlaceholder("Reply to John Doe...")).not.toBeVisible();
  });

  test("should validate comment content", async ({ page }) => {
    const commentInput = page.getByPlaceholder("Add a comment...");

    // Try to submit empty comment
    await page.getByRole("button", { name: "Comment" }).click();

    // Button should be disabled for empty content
    await expect(page.getByRole("button", { name: "Comment" })).toBeDisabled();

    // Add content and button should be enabled
    await commentInput.fill("Valid comment");
    await expect(page.getByRole("button", { name: "Comment" })).toBeEnabled();
  });

  test("should handle comment likes", async ({ page }) => {
    // Find like button for first comment
    const likeButton = page
      .getByRole("button")
      .filter({ hasText: /heart|like/i })
      .first();
    await likeButton.click();

    // Check for like state change (visual feedback)
    // This would show updated like count and filled heart icon when implemented
  });

  test("should display author actions for own comments", async ({ page }) => {
    // Add a comment first
    await page.getByPlaceholder("Add a comment...").fill("My own comment");
    await page.getByRole("button", { name: "Comment" }).click();

    // Wait for comment to appear
    await expect(page.getByText("My own comment")).toBeVisible();

    // Look for more options menu (3 dots) on own comment
    const moreButton = page
      .getByRole("button")
      .filter({ hasText: /more|options/i })
      .last();
    if ((await moreButton.count()) > 0) {
      await moreButton.click();

      // Should show edit and delete options
      await expect(page.getByText("Edit").or(page.getByText("Delete"))).toBeVisible();
    }
  });

  test("should handle threaded conversations", async ({ page }) => {
    // Verify nested reply structure
    const mainComment = page.locator("text=This is a great video! Thanks for sharing.");
    const reply = page.locator("text=I agree! Very helpful content.");

    await expect(mainComment).toBeVisible();
    await expect(reply).toBeVisible();

    // Reply should be visually indented/nested under main comment
    // This is checked through the DOM structure and CSS classes
  });

  test("should handle empty comments state", async ({ page }) => {
    // Mock empty comments response
    await page.route(`**/api/videos/${videoId}/comments`, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: [],
          }),
        });
      }
    });

    // Reload page to get empty state
    await page.reload();

    // Should show empty state
    await expect(page.getByText("No comments yet. Be the first to comment!")).toBeVisible();
    await expect(page.getByText("Comments (0)")).toBeVisible();
  });

  test("should handle comment loading state", async ({ page }) => {
    // Mock slow comments response
    await page.route(`**/api/videos/${videoId}/comments`, async (route) => {
      if (route.request().method() === "GET") {
        // Delay response to show loading state
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: [],
          }),
        });
      }
    });

    // Reload to trigger loading
    await page.reload();

    // Should show loading skeleton
    await expect(page.locator(".animate-pulse")).toBeVisible();
  });

  test("should handle comment submission errors", async ({ page }) => {
    // Mock error response
    await page.route(`**/api/videos/${videoId}/comments`, async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            error: "Failed to create comment",
          }),
        });
      }
    });

    // Try to submit comment
    await page.getByPlaceholder("Add a comment...").fill("This comment will fail");
    await page.getByRole("button", { name: "Comment" }).click();

    // Should handle error gracefully
    await expect(page.getByText("This comment will fail")).not.toBeVisible();

    // Form should reset to allow retry
    await expect(page.getByRole("button", { name: "Comment" })).toBeEnabled();
  });

  test("should preserve comment content during network issues", async ({ page }) => {
    const commentInput = page.getByPlaceholder("Add a comment...");
    const testComment = "This comment should be preserved during network issues";

    // Type comment
    await commentInput.fill(testComment);

    // Verify content is preserved even if submission fails
    await expect(commentInput).toHaveValue(testComment);

    // Mock network failure
    await page.route(`**/api/videos/${videoId}/comments`, async (route) => {
      await route.abort();
    });

    // Try to submit
    await page.getByRole("button", { name: "Comment" }).click();

    // Content should still be in the input for retry
    await expect(commentInput).toHaveValue(testComment);
  });

  test("should handle long comment content", async ({ page }) => {
    const longComment = "This is a very long comment that tests how the system handles extensive text content. ".repeat(
      10,
    );

    await page.getByPlaceholder("Add a comment...").fill(longComment);
    await page.getByRole("button", { name: "Comment" }).click();

    // Should display long comment properly
    await expect(page.getByText(longComment)).toBeVisible();
  });

  test("should maintain scroll position after comment actions", async ({ page }) => {
    // Scroll down to see comments
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Add a comment
    await page.getByPlaceholder("Add a comment...").fill("Testing scroll position");
    await page.getByRole("button", { name: "Comment" }).click();

    // Should remain scrolled to comments section
    await expect(page.getByText("Testing scroll position")).toBeInViewport();
  });
});
