import { test, expect } from "@playwright/test";

test.describe("Organization Management", () => {
  let userId: string;
  let orgId: string;

  test.beforeEach(async ({ page }) => {
    userId = "test-user-1";
    orgId = "test-org-1";

    // Mock authentication
    await page.route("**/api/auth/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          user: { id: userId, name: "Test User", email: "test@example.com" },
        }),
      });
    });

    // Mock organizations list
    await page.route("**/api/organizations", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              id: orgId,
              name: "Test Organization",
              slug: "test-org",
              role: "owner",
              logo: null,
              description: null,
              createdAt: new Date().toISOString(),
            },
          ]),
        });
      } else if (route.request().method() === "POST") {
        const body = await route.request().postDataJSON();
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            id: `org-${Date.now()}`,
            name: body.name,
            slug: body.slug,
            logo: body.logo || null,
            description: body.description || null,
            role: "owner",
            createdAt: new Date().toISOString(),
          }),
        });
      }
    });

    // Mock specific organization
    await page.route(`**/api/organizations/${orgId}`, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: orgId,
            name: "Test Organization",
            slug: "test-org",
            logo: null,
            description: "A test organization for E2E testing",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        });
      } else if (route.request().method() === "PUT") {
        const body = await route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: orgId,
            name: body.name || "Test Organization",
            slug: body.slug || "test-org",
            logo: body.logo || null,
            description: body.description || "A test organization for E2E testing",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        });
      } else if (route.request().method() === "DELETE") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      }
    });

    // Mock organization members
    await page.route(`**/api/organizations/${orgId}/members`, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: "member-1",
                role: "owner",
                createdAt: new Date().toISOString(),
                user: {
                  id: userId,
                  name: "Test User",
                  email: "test@example.com",
                  image: null,
                },
              },
              {
                id: "member-2",
                role: "member",
                createdAt: new Date(Date.now() - 86400000).toISOString(),
                user: {
                  id: "user-2",
                  name: "John Doe",
                  email: "john@example.com",
                  image: "/avatars/john.jpg",
                },
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
            type: "member",
            data: {
              id: `member-${Date.now()}`,
              role: body.role || "member",
              createdAt: new Date().toISOString(),
              user: {
                id: "new-user",
                name: "New User",
                email: body.email,
                image: null,
              },
            },
          }),
        });
      }
    });

    // Mock videos for organization dashboard
    await page.route(`**/api/organizations/${orgId}/videos`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: "video-1",
              title: "Sample Video",
              thumbnailUrl: "/thumbnails/sample.jpg",
              duration: "05:30",
              author: { name: "Test User" },
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    // Login first
    await page.goto("/login");
    await page.getByLabel("Email").fill("test@example.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();
  });

  test("should display organization dashboard", async ({ page }) => {
    await page.goto(`/${orgId}`);

    // Check organization name in header
    await expect(page.getByText("Test Organization")).toBeVisible();

    // Check for video sections
    await expect(page.getByText("New videos")).toBeVisible();
    await expect(page.getByText("Continue watching")).toBeVisible();

    // Check for upload button
    await expect(page.getByRole("button", { name: /upload/i })).toBeVisible();
  });

  test("should create new organization", async ({ page }) => {
    await page.goto(`/${orgId}`);

    // Open organization switcher
    await page.getByTestId("organization-switcher").click();

    // Click create organization
    await page.getByRole("button", { name: /create organization/i }).click();

    // Fill organization form
    await page.getByLabel("Organization name").fill("New Test Organization");
    await page.getByLabel("Slug").fill("new-test-org");

    // Submit form
    await page.getByRole("button", { name: /create/i }).click();

    // Should redirect to new organization
    await expect(page).toHaveURL(/\/org-\d+/);
    await expect(page.getByText("New Test Organization")).toBeVisible();
  });

  test("should switch between organizations", async ({ page }) => {
    // Mock additional organization
    await page.route("**/api/organizations", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              id: orgId,
              name: "Test Organization",
              slug: "test-org",
              role: "owner",
            },
            {
              id: "org-2",
              name: "Another Organization",
              slug: "another-org",
              role: "member",
            },
          ]),
        });
      }
    });

    await page.goto(`/${orgId}`);

    // Open organization switcher
    await page.getByTestId("organization-switcher").click();

    // Should show both organizations
    await expect(page.getByText("Test Organization")).toBeVisible();
    await expect(page.getByText("Another Organization")).toBeVisible();

    // Click on another organization
    await page.getByText("Another Organization").click();

    // Should switch to new organization
    await expect(page).toHaveURL(/\/another-org/);
  });

  test("should access organization settings", async ({ page }) => {
    await page.goto(`/${orgId}`);

    // Navigate to settings
    await page.getByRole("button", { name: /settings/i }).click();

    // Should be on settings page
    await expect(page).toHaveURL(`/${orgId}/settings`);
    await expect(page.getByText("Organization Settings")).toBeVisible();
  });

  test("should update organization details", async ({ page }) => {
    await page.goto(`/${orgId}/settings/organization`);

    // Check current values
    await expect(page.getByRole("textbox", { name: /organization name/i })).toHaveValue("Test Organization");
    await expect(page.getByRole("textbox", { name: /slug/i })).toHaveValue("test-org");

    // Update organization name
    await page.getByLabel("Organization name").fill("Updated Test Organization");

    // Update description
    await page.getByLabel("Description").fill("An updated description for testing");

    // Save changes
    await page.getByRole("button", { name: /save/i }).click();

    // Should show success message
    await expect(page.getByText("Organization updated successfully")).toBeVisible();
  });

  test("should delete organization", async ({ page }) => {
    await page.goto(`/${orgId}/settings/organization`);

    // Scroll to delete section
    await page.getByText("Delete Organization").scrollIntoViewIfNeeded();

    // Click delete button
    await page.getByRole("button", { name: /delete organization/i }).click();

    // Confirm deletion
    await page.getByRole("button", { name: /confirm delete/i }).click();

    // Should redirect to another organization or onboarding
    await expect(page).not.toHaveURL(new RegExp(`/${orgId}`));
  });

  test("should manage organization members", async ({ page }) => {
    await page.goto(`/${orgId}/settings/members`);

    // Check member list
    await expect(page.getByText("Test User")).toBeVisible();
    await expect(page.getByText("John Doe")).toBeVisible();
    await expect(page.getByText("owner")).toBeVisible();
    await expect(page.getByText("member")).toBeVisible();

    // Should show member count
    await expect(page.getByText("2 members")).toBeVisible();
  });

  test("should invite new member", async ({ page }) => {
    await page.goto(`/${orgId}/settings/members`);

    // Click invite member button
    await page.getByRole("button", { name: /invite member/i }).click();

    // Fill invitation form
    await page.getByLabel("Email").fill("newuser@example.com");
    await page.getByLabel("Role").selectOption("member");

    // Send invitation
    await page.getByRole("button", { name: /send invitation/i }).click();

    // Should show success message
    await expect(page.getByText("Member invited successfully")).toBeVisible();

    // Should update member list
    await expect(page.getByText("newuser@example.com")).toBeVisible();
  });

  test("should update member role", async ({ page }) => {
    await page.goto(`/${orgId}/settings/members`);

    // Find member actions menu
    const memberRow = page.locator("text=John Doe").locator("xpath=ancestor::tr");
    await memberRow.getByRole("button", { name: /more/i }).click();

    // Click change role
    await page.getByText("Change role").click();

    // Select new role
    await page.getByLabel("Role").selectOption("owner");

    // Save changes
    await page.getByRole("button", { name: /save/i }).click();

    // Should show success message
    await expect(page.getByText("Member role updated")).toBeVisible();
  });

  test("should remove member", async ({ page }) => {
    await page.goto(`/${orgId}/settings/members`);

    // Find member actions menu
    const memberRow = page.locator("text=John Doe").locator("xpath=ancestor::tr");
    await memberRow.getByRole("button", { name: /more/i }).click();

    // Click remove member
    await page.getByText("Remove member").click();

    // Confirm removal
    await page.getByRole("button", { name: /confirm/i }).click();

    // Should show success message
    await expect(page.getByText("Member removed successfully")).toBeVisible();

    // Member should be removed from list
    await expect(page.getByText("John Doe")).not.toBeVisible();
  });

  test("should handle organization creation errors", async ({ page }) => {
    // Mock error response
    await page.route("**/api/organizations", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            error: "Organization with this slug already exists",
          }),
        });
      }
    });

    await page.goto(`/${orgId}`);

    // Open organization switcher
    await page.getByTestId("organization-switcher").click();

    // Click create organization
    await page.getByRole("button", { name: /create organization/i }).click();

    // Fill organization form
    await page.getByLabel("Organization name").fill("Duplicate Org");
    await page.getByLabel("Slug").fill("duplicate-slug");

    // Submit form
    await page.getByRole("button", { name: /create/i }).click();

    // Should show error message
    await expect(page.getByText("Organization with this slug already exists")).toBeVisible();
  });

  test("should handle member invitation errors", async ({ page }) => {
    // Mock error response
    await page.route(`**/api/organizations/${orgId}/members`, async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            error: "User is already a member",
          }),
        });
      }
    });

    await page.goto(`/${orgId}/settings/members`);

    // Click invite member button
    await page.getByRole("button", { name: /invite member/i }).click();

    // Fill invitation form
    await page.getByLabel("Email").fill("existing@example.com");

    // Send invitation
    await page.getByRole("button", { name: /send invitation/i }).click();

    // Should show error message
    await expect(page.getByText("User is already a member")).toBeVisible();
  });

  test("should validate organization form", async ({ page }) => {
    await page.goto(`/${orgId}`);

    // Open organization switcher
    await page.getByTestId("organization-switcher").click();

    // Click create organization
    await page.getByRole("button", { name: /create organization/i }).click();

    // Try to submit empty form
    await page.getByRole("button", { name: /create/i }).click();

    // Should show validation errors
    await expect(page.getByText("Name is required")).toBeVisible();
    await expect(page.getByText("Slug is required")).toBeVisible();

    // Fill invalid slug
    await page.getByLabel("Slug").fill("invalid slug with spaces");

    // Should show slug validation error
    await expect(page.getByText("Slug must contain only letters, numbers, and hyphens")).toBeVisible();
  });

  test("should show organization statistics", async ({ page }) => {
    // Mock statistics
    await page.route(`**/api/organizations/${orgId}/stats`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          members: 5,
          videos: 23,
          channels: 3,
          storage: "2.5 GB",
        }),
      });
    });

    await page.goto(`/${orgId}/settings`);

    // Should show organization stats
    await expect(page.getByText("5 members")).toBeVisible();
    await expect(page.getByText("23 videos")).toBeVisible();
    await expect(page.getByText("3 channels")).toBeVisible();
    await expect(page.getByText("2.5 GB storage")).toBeVisible();
  });

  test("should handle permission restrictions", async ({ page }) => {
    // Mock user as member (not owner)
    await page.route(`**/api/organizations/${orgId}/members`, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: "member-1",
                role: "member", // Changed from owner to member
                createdAt: new Date().toISOString(),
                user: {
                  id: userId,
                  name: "Test User",
                  email: "test@example.com",
                  image: null,
                },
              },
            ],
          }),
        });
      }
    });

    await page.goto(`/${orgId}/settings/organization`);

    // Should show permission restrictions
    await expect(page.getByText("Only owners can modify organization settings")).toBeVisible();

    // Form fields should be disabled
    await expect(page.getByLabel("Organization name")).toBeDisabled();
    await expect(page.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  test("should search organizations in switcher", async ({ page }) => {
    // Mock multiple organizations
    await page.route("**/api/organizations", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            { id: "org-1", name: "Alpha Organization", slug: "alpha-org", role: "owner" },
            { id: "org-2", name: "Beta Organization", slug: "beta-org", role: "member" },
            { id: "org-3", name: "Gamma Organization", slug: "gamma-org", role: "member" },
          ]),
        });
      }
    });

    await page.goto(`/${orgId}`);

    // Open organization switcher
    await page.getByTestId("organization-switcher").click();

    // Should show all organizations
    await expect(page.getByText("Alpha Organization")).toBeVisible();
    await expect(page.getByText("Beta Organization")).toBeVisible();
    await expect(page.getByText("Gamma Organization")).toBeVisible();

    // Search for specific organization
    await page.getByPlaceholder("Search organizations...").fill("Beta");

    // Should filter results
    await expect(page.getByText("Beta Organization")).toBeVisible();
    await expect(page.getByText("Alpha Organization")).not.toBeVisible();
    await expect(page.getByText("Gamma Organization")).not.toBeVisible();
  });

  test("should handle organization loading states", async ({ page }) => {
    // Mock slow response
    await page.route("**/api/organizations", async (route) => {
      if (route.request().method() === "GET") {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      }
    });

    await page.goto("/");

    // Should show loading skeleton
    await expect(page.locator(".animate-pulse")).toBeVisible();
  });

  test("should handle empty organization state", async ({ page }) => {
    // Mock empty organizations
    await page.route("**/api/organizations", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      }
    });

    await page.goto("/");

    // Should show empty state
    await expect(page.getByText("No organizations found")).toBeVisible();
    await expect(page.getByRole("button", { name: /create your first organization/i })).toBeVisible();
  });

  test("should preserve organization context during navigation", async ({ page }) => {
    await page.goto(`/${orgId}`);

    // Navigate to different pages within organization
    await page.getByRole("link", { name: "Videos" }).click();
    await expect(page).toHaveURL(`/${orgId}/videos`);

    await page.getByRole("link", { name: "Channels" }).click();
    await expect(page).toHaveURL(`/${orgId}/channels`);

    await page.getByRole("link", { name: "Series" }).click();
    await expect(page).toHaveURL(`/${orgId}/series`);

    // Organization context should be preserved
    await expect(page.getByText("Test Organization")).toBeVisible();
  });
});
