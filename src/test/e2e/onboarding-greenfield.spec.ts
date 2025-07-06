import { test, expect } from "@playwright/test";

test.describe("Greenfield Onboarding Journey", () => {
  test.describe("Complete New User Flow", () => {
    test("should complete full signup → organization creation → first video upload flow", async ({ page }) => {
      // Step 1: User arrives at landing page
      await page.goto("/");
      
      await expect(page.getByText("Video Collaboration Platform")).toBeVisible();
      await expect(page.getByRole("button", { name: /get started/i })).toBeVisible();
      
      // Navigate to signup
      await page.getByRole("button", { name: /get started/i }).click();
      await expect(page).toHaveURL(/.*\/register/);

      // Step 2: User Registration
      await expect(page.getByText("Create your account")).toBeVisible();
      
      // Mock successful registration
      await page.route("**/api/auth/**", async (route) => {
        const url = route.request().url();
        if (url.includes("register") || url.includes("sign-up")) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ 
              success: true, 
              user: { 
                id: "new-user-1", 
                name: "New User", 
                email: "newuser@example.com",
                emailVerified: true
              }
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ 
              data: { 
                session: { 
                  user: { id: "new-user-1", name: "New User", email: "newuser@example.com" },
                  token: "mock-token"
                }
              }
            }),
          });
        }
      });

      // Fill registration form
      await page.getByLabel("Name").fill("New User");
      await page.getByLabel("Email").fill("newuser@example.com");
      await page.getByLabel("Password").fill("SecurePassword123!");
      await page.getByRole("button", { name: /create account/i }).click();

      // Step 3: Organization Creation (First-time setup)
      // Mock empty organizations (new user has no orgs)
      await page.route("**/api/organizations**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      });

      // Should redirect to organization creation
      await expect(page.getByText("Create your first organization")).toBeVisible();
      await expect(page.getByText("Get started by creating your organization")).toBeVisible();

      // Mock organization creation
      await page.route("**/api/organizations", async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              id: "new-org-1",
              name: "My First Organization", 
              slug: "my-first-org",
              createdAt: new Date().toISOString()
            }),
          });
        }
      });

      // Fill organization creation form
      await page.getByLabel("Organization Name").fill("My First Organization");
      await page.getByLabel("Slug").fill("my-first-org");
      await page.getByRole("button", { name: /create organization/i }).click();

      // Step 4: Welcome to Organization Dashboard
      // Mock videos API for empty state
      await page.route("**/api/videos**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ videos: [], total: 0 }),
        });
      });

      await expect(page).toHaveURL(/.*\/my-first-org/);
      await expect(page.getByText("Welcome to My First Organization")).toBeVisible();
      await expect(page.getByText("No videos yet")).toBeVisible();
      await expect(page.getByRole("button", { name: /upload your first video/i })).toBeVisible();

      // Step 5: First Video Upload
      await page.getByRole("button", { name: /upload your first video/i }).click();
      await expect(page).toHaveURL(/.*\/my-first-org\/upload/);

      // Mock video upload APIs
      await page.route("**/api/videos/upload", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            videoUrl: "/uploads/first-video.mp4",
            thumbnailUrl: "/uploads/first-video-thumb.jpg",
          }),
        });
      });

      await page.route("**/api/videos", async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              id: "first-video-1",
              title: "My First Video",
              duration: "02:30",
              thumbnailUrl: "/uploads/first-video-thumb.jpg",
              videoUrl: "/uploads/first-video.mp4",
              author: { id: "new-user-1", name: "New User" }
            }),
          });
        }
      });

      // Upload first video
      await expect(page.getByText("Upload Video")).toBeVisible();
      await page.getByLabel("Title").fill("My First Video");
      await page.getByLabel("Description").fill("This is my very first video upload!");

      // Mock file upload
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: "first-video.mp4",
        mimeType: "video/mp4",
        buffer: Buffer.from("fake video content for first upload"),
      });

      await page.getByRole("button", { name: /upload/i }).click();

      // Step 6: Upload Success and Return to Dashboard
      await expect(page.getByText("Video uploaded successfully")).toBeVisible();
      
      // Mock updated videos API with first video
      await page.route("**/api/videos**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ 
            videos: [{
              id: "first-video-1",
              title: "My First Video",
              duration: "02:30",
              thumbnailUrl: "/uploads/first-video-thumb.jpg",
              author: { id: "new-user-1", name: "New User", image: null }
            }],
            total: 1 
          }),
        });
      });

      // Return to dashboard
      await page.getByRole("button", { name: /go to dashboard/i }).click();
      await expect(page).toHaveURL(/.*\/my-first-org/);

      // Step 7: Verify Completed Onboarding
      await expect(page.getByText("My First Video")).toBeVisible();
      await expect(page.getByText("02:30")).toBeVisible();
      await expect(page.getByText("New User")).toBeVisible();
      
      // Verify navigation is working
      await expect(page.getByText("My First Organization")).toBeVisible();
      await expect(page.getByRole("button", { name: /upload video/i })).toBeVisible();
    });

    test("should handle organization creation with custom settings", async ({ page }) => {
      // Mock authenticated user with no organizations
      await page.route("**/api/auth/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ 
            data: { 
              session: { 
                user: { id: "user-2", name: "Advanced User", email: "advanced@example.com" },
                token: "mock-token"
              }
            }
          }),
        });
      });

      await page.route("**/api/organizations**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      });

      await page.goto("/");
      
      // User should be redirected to organization creation
      await expect(page.getByText("Create your first organization")).toBeVisible();

      // Mock organization creation with advanced settings
      await page.route("**/api/organizations", async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              id: "advanced-org-1",
              name: "Advanced Video Team",
              slug: "advanced-video-team",
              description: "Professional video collaboration workspace",
              createdAt: new Date().toISOString()
            }),
          });
        }
      });

      // Fill advanced organization form
      await page.getByLabel("Organization Name").fill("Advanced Video Team");
      await page.getByLabel("Slug").fill("advanced-video-team");
      await page.getByLabel("Description").fill("Professional video collaboration workspace");
      
      // Test slug validation and auto-generation
      await page.getByLabel("Organization Name").fill("Updated Team Name");
      await expect(page.getByLabel("Slug")).toHaveValue("updated-team-name");

      await page.getByRole("button", { name: /create organization/i }).click();

      await expect(page).toHaveURL(/.*\/updated-team-name/);
      await expect(page.getByText("Welcome to Updated Team Name")).toBeVisible();
    });

    test("should handle onboarding interruption and resumption", async ({ page }) => {
      // Mock authenticated user
      await page.route("**/api/auth/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ 
            data: { 
              session: { 
                user: { id: "user-3", name: "Interrupted User", email: "interrupted@example.com" },
                token: "mock-token"
              }
            }
          }),
        });
      });

      // Start with no organizations
      await page.route("**/api/organizations**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      });

      await page.goto("/");
      await expect(page.getByText("Create your first organization")).toBeVisible();

      // User starts filling form but doesn't complete it
      await page.getByLabel("Organization Name").fill("Partial Organization");
      
      // Simulate page refresh/navigation away
      await page.reload();
      
      // Should still show organization creation form
      await expect(page.getByText("Create your first organization")).toBeVisible();
      
      // Form should be empty (no persistence in this version)
      await expect(page.getByLabel("Organization Name")).toHaveValue("");

      // User completes the process
      await page.route("**/api/organizations", async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              id: "resumed-org-1",
              name: "Resumed Organization",
              slug: "resumed-org",
              createdAt: new Date().toISOString()
            }),
          });
        }
      });

      await page.getByLabel("Organization Name").fill("Resumed Organization");
      await page.getByRole("button", { name: /create organization/i }).click();

      await expect(page).toHaveURL(/.*\/resumed-org/);
    });

    test("should handle organization creation errors gracefully", async ({ page }) => {
      // Mock authenticated user
      await page.route("**/api/auth/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ 
            data: { 
              session: { 
                user: { id: "user-4", name: "Error User", email: "error@example.com" },
                token: "mock-token"
              }
            }
          }),
        });
      });

      await page.route("**/api/organizations**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      });

      await page.goto("/");

      // Mock organization creation failure
      await page.route("**/api/organizations", async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 409,
            contentType: "application/json",
            body: JSON.stringify({
              error: "Organization slug already exists",
              code: "SLUG_TAKEN"
            }),
          });
        }
      });

      await page.getByLabel("Organization Name").fill("Duplicate Org");
      await page.getByLabel("Slug").fill("existing-slug");
      await page.getByRole("button", { name: /create organization/i }).click();

      // Should show error message
      await expect(page.getByText("Organization slug already exists")).toBeVisible();
      
      // Form should still be filled
      await expect(page.getByLabel("Organization Name")).toHaveValue("Duplicate Org");
      await expect(page.getByLabel("Slug")).toHaveValue("existing-slug");

      // User can try again with different slug
      await page.route("**/api/organizations", async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              id: "success-org-1",
              name: "Duplicate Org",
              slug: "unique-slug",
              createdAt: new Date().toISOString()
            }),
          });
        }
      });

      await page.getByLabel("Slug").fill("unique-slug");
      await page.getByRole("button", { name: /create organization/i }).click();

      await expect(page).toHaveURL(/.*\/unique-slug/);
    });

    test("should guide user through video upload best practices", async ({ page }) => {
      // Mock authenticated user with existing organization
      await page.route("**/api/auth/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ 
            data: { 
              session: { 
                user: { id: "user-5", name: "Guided User", email: "guided@example.com" },
                token: "mock-token"
              }
            }
          }),
        });
      });

      await page.route("**/api/organizations**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            { id: "guided-org-1", name: "Guided Organization", slug: "guided-org" }
          ]),
        });
      });

      await page.route("**/api/videos**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ videos: [], total: 0 }),
        });
      });

      await page.goto("/guided-org");

      // New user sees empty state with guidance
      await expect(page.getByText("No videos yet")).toBeVisible();
      await expect(page.getByText("Upload your first video to get started")).toBeVisible();
      
      await page.getByRole("button", { name: /upload your first video/i }).click();
      await expect(page).toHaveURL(/.*\/guided-org\/upload/);

      // Should show onboarding tips
      await expect(page.getByText("Tips for your first video")).toBeVisible();
      await expect(page.getByText("Keep it under 5 minutes")).toBeVisible();
      await expect(page.getByText("Add a clear title and description")).toBeVisible();
      await expect(page.getByText("Choose an eye-catching thumbnail")).toBeVisible();

      // Test form validation
      await page.getByRole("button", { name: /upload/i }).click();
      await expect(page.getByText("Title is required")).toBeVisible();
      await expect(page.getByText("Please select a video file")).toBeVisible();

      // Fill form with guidance
      await page.getByLabel("Title").fill("My Amazing First Video");
      
      // Should show character count
      await expect(page.getByText("25 characters")).toBeVisible();
      
      await page.getByLabel("Description").fill("This video demonstrates our new product features and how to use them effectively.");
      
      // Mock successful upload
      await page.route("**/api/videos/upload", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            videoUrl: "/uploads/amazing-video.mp4",
            thumbnailUrl: "/uploads/amazing-video-thumb.jpg",
          }),
        });
      });

      await page.route("**/api/videos", async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              id: "amazing-video-1",
              title: "My Amazing First Video",
              duration: "03:45",
              thumbnailUrl: "/uploads/amazing-video-thumb.jpg",
              videoUrl: "/uploads/amazing-video.mp4",
              author: { id: "user-5", name: "Guided User" }
            }),
          });
        }
      });

      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: "amazing-video.mp4",
        mimeType: "video/mp4",
        buffer: Buffer.from("high quality video content"),
      });

      await page.getByRole("button", { name: /upload/i }).click();

      // Should show upload progress and success
      await expect(page.getByText("Uploading...")).toBeVisible();
      await expect(page.getByText("Video uploaded successfully")).toBeVisible();
      
      // Should show next steps
      await expect(page.getByText("Great job! Your first video is ready")).toBeVisible();
      await expect(page.getByText("Share your video")).toBeVisible();
      await expect(page.getByText("Invite team members")).toBeVisible();
      await expect(page.getByText("Create more content")).toBeVisible();
    });

    test("should handle user with existing organizations", async ({ page }) => {
      // Mock user who already has organizations (not a greenfield case)
      await page.route("**/api/auth/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ 
            data: { 
              session: { 
                user: { id: "experienced-user", name: "Experienced User", email: "exp@example.com" },
                token: "mock-token"
              }
            }
          }),
        });
      });

      await page.route("**/api/organizations**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            { id: "existing-org-1", name: "Existing Organization", slug: "existing-org" },
            { id: "existing-org-2", name: "Another Org", slug: "another-org" }
          ]),
        });
      });

      await page.goto("/");

      // Should redirect to first organization, not onboarding
      await expect(page).toHaveURL(/.*\/existing-org/);
      await expect(page.getByText("Existing Organization")).toBeVisible();
      
      // Should not show onboarding messages
      await expect(page.getByText("Create your first organization")).not.toBeVisible();
      await expect(page.getByText("Upload your first video")).not.toBeVisible();
    });
  });
});