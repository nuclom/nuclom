import { test, expect } from "@playwright/test";

test.describe("Channels and Collections Management", () => {
  const orgId = "test-org";
  const mockUser = { id: "user-1", name: "Test User", email: "test@example.com" };
  const mockOrganization = { id: "org-1", name: "Test Organization", slug: orgId };

  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.route("**/api/auth/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ 
          data: { 
            session: { 
              user: mockUser,
              token: "mock-token"
            }
          }
        }),
      });
    });

    // Mock organizations
    await page.route("**/api/organizations**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockOrganization]),
      });
    });

    // Mock videos for the main page
    await page.route("**/api/videos**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ videos: [], total: 0 }),
      });
    });
  });

  test("should display channels page with empty state", async ({ page }) => {
    // Mock channels API to return empty list
    await page.route("**/api/organizations/*/channels", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ channels: [] }),
      });
    });

    await page.goto(`/${orgId}/channels`);

    await expect(page.getByText("Channels")).toBeVisible();
    await expect(page.getByText("Organize your content into channels")).toBeVisible();
    await expect(page.getByText("No channels yet")).toBeVisible();
    await expect(page.getByRole("button", { name: /create channel/i })).toBeVisible();
  });

  test("should display channels with data", async ({ page }) => {
    // Mock channels API to return channels
    await page.route("**/api/organizations/*/channels", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          channels: [
            {
              id: "channel-1",
              name: "General Discussion",
              description: "Main channel for team discussions",
              memberCount: 15,
              createdAt: "2023-12-01T00:00:00Z",
              organization: { id: "org-1", name: "Test Org", slug: "test-org" }
            },
            {
              id: "channel-2", 
              name: "Development",
              description: "Technical discussions and code reviews",
              memberCount: 8,
              createdAt: "2023-12-02T00:00:00Z",
              organization: { id: "org-1", name: "Test Org", slug: "test-org" }
            }
          ]
        }),
      });
    });

    await page.goto(`/${orgId}/channels`);

    await expect(page.getByText("General Discussion")).toBeVisible();
    await expect(page.getByText("Development")).toBeVisible();
    await expect(page.getByText("15 members")).toBeVisible();
    await expect(page.getByText("8 members")).toBeVisible();
    await expect(page.getByText("Main channel for team discussions")).toBeVisible();
  });

  test("should show create channel modal", async ({ page }) => {
    // Mock channels API
    await page.route("**/api/organizations/*/channels", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ channels: [] }),
      });
    });

    await page.goto(`/${orgId}/channels`);

    await page.getByRole("button", { name: /create channel/i }).click();

    await expect(page.getByText("Create Channel")).toBeVisible();
    await expect(page.getByText("Create a new channel to organize")).toBeVisible();
    await expect(page.getByPlaceholder("Enter channel name")).toBeVisible();
    await expect(page.getByPlaceholder("Enter description")).toBeVisible();
  });

  test("should search channels", async ({ page }) => {
    // Mock channels API
    await page.route("**/api/organizations/*/channels", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          channels: [
            {
              id: "channel-1",
              name: "General Discussion",
              description: "Main channel",
              memberCount: 15,
              createdAt: "2023-12-01T00:00:00Z",
              organization: { id: "org-1", name: "Test Org", slug: "test-org" }
            },
            {
              id: "channel-2",
              name: "Development",
              description: "Tech discussions",
              memberCount: 8,
              createdAt: "2023-12-02T00:00:00Z",
              organization: { id: "org-1", name: "Test Org", slug: "test-org" }
            }
          ]
        }),
      });
    });

    await page.goto(`/${orgId}/channels`);

    // Search for "dev"
    await page.getByPlaceholder("Search channels...").fill("dev");

    // Should show only Development channel
    await expect(page.getByText("Development")).toBeVisible();
    await expect(page.getByText("General Discussion")).not.toBeVisible();
  });

  test("should display series page with empty state", async ({ page }) => {
    // Mock collections API to return empty list
    await page.route("**/api/organizations/*/collections", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ collections: [] }),
      });
    });

    await page.goto(`/${orgId}/series`);

    await expect(page.getByText("Video Series")).toBeVisible();
    await expect(page.getByText("Create and manage video series")).toBeVisible();
    await expect(page.getByText("No video series yet")).toBeVisible();
    await expect(page.getByRole("button", { name: /create series/i })).toBeVisible();
  });

  test("should display series with data", async ({ page }) => {
    // Mock collections API to return series
    await page.route("**/api/organizations/*/collections", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          collections: [
            {
              id: "series-1",
              name: "React Fundamentals",
              description: "Learn React from basics to advanced",
              videoCount: 12,
              createdAt: "2023-12-01T00:00:00Z",
              updatedAt: "2023-12-15T00:00:00Z",
              organization: { id: "org-1", name: "Test Org", slug: "test-org" }
            },
            {
              id: "series-2",
              name: "TypeScript Deep Dive",
              description: "Master TypeScript concepts",
              videoCount: 8,
              createdAt: "2023-12-02T00:00:00Z",
              updatedAt: "2023-12-10T00:00:00Z",
              organization: { id: "org-1", name: "Test Org", slug: "test-org" }
            }
          ]
        }),
      });
    });

    await page.goto(`/${orgId}/series`);

    await expect(page.getByText("React Fundamentals")).toBeVisible();
    await expect(page.getByText("TypeScript Deep Dive")).toBeVisible();
    await expect(page.getByText("12 videos")).toBeVisible();
    await expect(page.getByText("8 videos")).toBeVisible();
    await expect(page.getByText("Learn React from basics to advanced")).toBeVisible();
  });

  test("should show create series modal", async ({ page }) => {
    // Mock collections API
    await page.route("**/api/organizations/*/collections", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ collections: [] }),
      });
    });

    await page.goto(`/${orgId}/series`);

    await page.getByRole("button", { name: /create series/i }).click();

    await expect(page.getByText("Create Video Series")).toBeVisible();
    await expect(page.getByText("Create a new video series to organize")).toBeVisible();
    await expect(page.getByPlaceholder("Enter series name")).toBeVisible();
    await expect(page.getByPlaceholder("Enter description")).toBeVisible();
  });

  test("should handle channels API errors gracefully", async ({ page }) => {
    // Mock channels API error
    await page.route("**/api/organizations/*/channels", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal server error" }),
      });
    });

    await page.goto(`/${orgId}/channels`);

    // Should show error toast
    await page.waitForTimeout(1000);
    await expect(page.getByText("Error")).toBeVisible();
    await expect(page.getByText("Failed to load channels")).toBeVisible();
  });

  test("should handle series API errors gracefully", async ({ page }) => {
    // Mock collections API error
    await page.route("**/api/organizations/*/collections", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal server error" }),
      });
    });

    await page.goto(`/${orgId}/series`);

    // Should show error toast
    await page.waitForTimeout(1000);
    await expect(page.getByText("Error")).toBeVisible();
    await expect(page.getByText("Failed to load series")).toBeVisible();
  });

  test("should sort channels by different criteria", async ({ page }) => {
    // Mock channels API
    await page.route("**/api/organizations/*/channels", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          channels: [
            {
              id: "channel-1",
              name: "Alpha Channel",
              memberCount: 5,
              createdAt: "2023-12-01T00:00:00Z",
              organization: { id: "org-1", name: "Test Org", slug: "test-org" }
            },
            {
              id: "channel-2",
              name: "Beta Channel",
              memberCount: 15,
              createdAt: "2023-12-02T00:00:00Z",
              organization: { id: "org-1", name: "Test Org", slug: "test-org" }
            }
          ]
        }),
      });
    });

    await page.goto(`/${orgId}/channels`);

    // Should show channels in name order by default
    const channelCards = page.locator('[data-testid="channel-card"]');
    await expect(channelCards.first()).toContainText("Alpha Channel");

    // Change sort to members
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Members" }).click();

    // Should show Beta Channel first (more members)
    await expect(channelCards.first()).toContainText("Beta Channel");
  });

  test("should handle empty search results", async ({ page }) => {
    // Mock channels API
    await page.route("**/api/organizations/*/channels", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          channels: [
            {
              id: "channel-1",
              name: "General Discussion",
              memberCount: 15,
              createdAt: "2023-12-01T00:00:00Z",
              organization: { id: "org-1", name: "Test Org", slug: "test-org" }
            }
          ]
        }),
      });
    });

    await page.goto(`/${orgId}/channels`);

    // Search for something that doesn't exist
    await page.getByPlaceholder("Search channels...").fill("nonexistent");

    // Should show no results
    await expect(page.getByText("No channels found")).toBeVisible();
    await expect(page.getByText("Try adjusting your search terms")).toBeVisible();
  });
});