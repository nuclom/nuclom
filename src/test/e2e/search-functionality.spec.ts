import { test, expect } from "@playwright/test";

test.describe("Search Functionality", () => {
  const orgId = "test-org";
  const mockUser = { id: "user-1", name: "Test User", email: "test@example.com" };
  const mockOrganization = { id: "org-1", name: "Test Organization", slug: orgId };

  test.beforeEach(async ({ page }) => {
    // Mock all authentication requests
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

    // Go directly to the search page to test it
    await page.goto(`/${orgId}/search`);
  });

  test("should display empty search state when no query", async ({ page }) => {
    await page.goto(`/${orgId}/search`);

    await expect(page.getByText("Start searching")).toBeVisible();
    await expect(page.getByText("Use the search bar above to find videos, channels, and more.")).toBeVisible();
  });

  test("should perform basic search and display results", async ({ page }) => {
    // Mock search API
    await page.route("**/api/search**", async (route) => {
      const url = new URL(route.request().url());
      const query = url.searchParams.get("q");
      
      if (query === "test video") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              query: "test video",
              total: 3,
              videos: [
                {
                  id: "video-1",
                  title: "Test Video 1",
                  description: "A test video description",
                  duration: "10:30",
                  thumbnailUrl: "/test-thumb.jpg",
                  author: { id: "user-1", name: "Test User", image: null },
                },
                {
                  id: "video-2", 
                  title: "Another Test Video",
                  description: "Another description",
                  duration: "05:45",
                  thumbnailUrl: "/test-thumb2.jpg",
                  author: { id: "user-2", name: "Other User", image: null },
                }
              ],
              channels: [
                {
                  id: "channel-1",
                  name: "Test Channel",
                  description: "A test channel",
                  memberCount: 15,
                }
              ],
              collections: [],
              users: [],
            },
          }),
        });
      }
    });

    await page.goto(`/${orgId}/search?q=test+video`);

    // Verify search results header
    await expect(page.getByText('Search results for "test video"')).toBeVisible();
    await expect(page.getByText("3 results found")).toBeVisible();

    // Verify tabs with counts
    await expect(page.getByRole("tab", { name: /all.*3/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /videos.*2/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /channels.*1/i })).toBeVisible();

    // Verify video results
    await expect(page.getByText("Test Video 1")).toBeVisible();
    await expect(page.getByText("Another Test Video")).toBeVisible();
    await expect(page.getByText("10:30")).toBeVisible();
    await expect(page.getByText("05:45")).toBeVisible();

    // Verify channel results
    await expect(page.getByText("Test Channel")).toBeVisible();
    await expect(page.getByText("15 members")).toBeVisible();
  });

  test("should filter results by content type tabs", async ({ page }) => {
    // Mock search API for different types
    await page.route("**/api/search**", async (route) => {
      const url = new URL(route.request().url());
      const type = url.searchParams.get("type");
      const query = url.searchParams.get("q");

      if (query === "content" && type === "videos") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              query: "content",
              total: 2,
              videos: [
                {
                  id: "video-1",
                  title: "Video Content 1",
                  duration: "08:30",
                  thumbnailUrl: "/thumb1.jpg",
                  author: { id: "user-1", name: "Creator", image: null },
                },
                {
                  id: "video-2",
                  title: "Video Content 2", 
                  duration: "12:15",
                  thumbnailUrl: "/thumb2.jpg",
                  author: { id: "user-1", name: "Creator", image: null },
                }
              ],
              channels: [],
              collections: [],
              users: [],
            },
          }),
        });
      } else if (query === "content" && type === "channels") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              query: "content",
              total: 1,
              videos: [],
              channels: [
                {
                  id: "channel-1",
                  name: "Content Channel",
                  description: "Channel for content creators",
                  memberCount: 25,
                }
              ],
              collections: [],
              users: [],
            },
          }),
        });
      }
    });

    await page.goto(`/${orgId}/search?q=content`);

    // Initially on "All" tab - should see videos tab
    await expect(page.getByRole("tab", { name: /all/i })).toHaveAttribute("data-state", "active");

    // Click Videos tab
    await page.getByRole("tab", { name: /videos/i }).click();
    await expect(page.getByText("Video Content 1")).toBeVisible();
    await expect(page.getByText("Video Content 2")).toBeVisible();
    await expect(page.getByText("Content Channel")).not.toBeVisible();

    // Click Channels tab
    await page.getByRole("tab", { name: /channels/i }).click();
    await expect(page.getByText("Content Channel")).toBeVisible();
    await expect(page.getByText("25 members")).toBeVisible();
    await expect(page.getByText("Video Content 1")).not.toBeVisible();
  });

  test("should sort search results by different criteria", async ({ page }) => {
    // Mock search API with different sorting
    await page.route("**/api/search**", async (route) => {
      const url = new URL(route.request().url());
      const sortBy = url.searchParams.get("sortBy");
      const query = url.searchParams.get("q");

      if (query === "tutorial") {
        let videos = [];
        if (sortBy === "date") {
          videos = [
            {
              id: "video-new",
              title: "Latest Tutorial",
              duration: "15:00",
              createdAt: "2023-12-01T00:00:00Z",
              author: { id: "user-1", name: "Creator", image: null },
            },
            {
              id: "video-old",
              title: "Older Tutorial",
              duration: "20:00", 
              createdAt: "2023-11-01T00:00:00Z",
              author: { id: "user-2", name: "Other", image: null },
            }
          ];
        } else if (sortBy === "title") {
          videos = [
            {
              id: "video-a",
              title: "A Tutorial",
              duration: "12:00",
              author: { id: "user-1", name: "Creator", image: null },
            },
            {
              id: "video-z",
              title: "Z Tutorial",
              duration: "08:00",
              author: { id: "user-2", name: "Other", image: null },
            }
          ];
        } else {
          videos = [
            {
              id: "video-rel",
              title: "Most Relevant Tutorial",
              duration: "10:00",
              author: { id: "user-1", name: "Creator", image: null },
            }
          ];
        }

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              query: "tutorial",
              total: videos.length,
              videos,
              channels: [],
              collections: [],
              users: [],
            },
          }),
        });
      }
    });

    await page.goto(`/${orgId}/search?q=tutorial`);

    // Default is relevance
    await expect(page.getByText("Most Relevant Tutorial")).toBeVisible();

    // Change to date sorting
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Date" }).click();
    await expect(page.getByText("Latest Tutorial")).toBeVisible();
    await expect(page.getByText("Older Tutorial")).toBeVisible();

    // Change to title sorting
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Title" }).click();
    await expect(page.getByText("A Tutorial")).toBeVisible();
    await expect(page.getByText("Z Tutorial")).toBeVisible();
  });

  test("should display no results message when search yields empty results", async ({ page }) => {
    // Mock empty search results
    await page.route("**/api/search**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            query: "nonexistent",
            total: 0,
            videos: [],
            channels: [],
            collections: [],
            users: [],
          },
        }),
      });
    });

    await page.goto(`/${orgId}/search?q=nonexistent`);

    await expect(page.getByText('Search results for "nonexistent"')).toBeVisible();
    await expect(page.getByText("0 results found")).toBeVisible();
    await expect(page.getByText("No results found")).toBeVisible();
    await expect(page.getByText("Try adjusting your search terms or filters.")).toBeVisible();
  });

  test("should show loading state during search", async ({ page }) => {
    // Mock delayed search API
    await page.route("**/api/search**", async (route) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            query: "slow",
            total: 1,
            videos: [{ id: "video-1", title: "Slow Video", duration: "05:00", author: { name: "User" } }],
            channels: [],
            collections: [],
            users: [],
          },
        }),
      });
    });

    await page.goto(`/${orgId}/search`);
    
    // Trigger search
    const searchParams = new URLSearchParams({ q: "slow" });
    await page.goto(`/${orgId}/search?${searchParams}`);

    // Should show loading spinner
    await expect(page.locator(".animate-spin")).toBeVisible();
    
    // Eventually shows results
    await expect(page.getByText("Slow Video")).toBeVisible();
  });

  test("should handle search API errors gracefully", async ({ page }) => {
    // Mock search API error
    await page.route("**/api/search**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal server error" }),
      });
    });

    await page.goto(`/${orgId}/search?q=error`);

    // Should show error toast
    await expect(page.getByText("Search Error")).toBeVisible();
    await expect(page.getByText("Failed to perform search. Please try again.")).toBeVisible();
  });

  test("should display empty state for specific content types with no results", async ({ page }) => {
    // Mock search with videos but no channels
    await page.route("**/api/search**", async (route) => {
      const url = new URL(route.request().url());
      const type = url.searchParams.get("type");

      if (type === "channels") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              query: "video",
              total: 0,
              videos: [],
              channels: [],
              collections: [],
              users: [],
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              query: "video",
              total: 1,
              videos: [{ id: "video-1", title: "Test Video", duration: "05:00", author: { name: "User" } }],
              channels: [],
              collections: [],
              users: [],
            },
          }),
        });
      }
    });

    await page.goto(`/${orgId}/search?q=video`);

    // Switch to channels tab
    await page.getByRole("tab", { name: /channels/i }).click();

    // Should show empty state for channels
    await expect(page.getByText("No channels found")).toBeVisible();
    await expect(page.getByText("No channels match your search criteria.")).toBeVisible();
  });

  test("should navigate to video detail from search results", async ({ page }) => {
    // Mock search results
    await page.route("**/api/search**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            query: "navigate",
            total: 1,
            videos: [
              {
                id: "nav-video-1",
                title: "Navigation Test Video",
                duration: "07:30",
                thumbnailUrl: "/nav-thumb.jpg",
                author: { id: "user-1", name: "Test User", image: null },
              }
            ],
            channels: [],
            collections: [],
            users: [],
          },
        }),
      });
    });

    // Mock video detail API
    await page.route("**/api/videos/nav-video-1", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "nav-video-1",
          title: "Navigation Test Video",
          description: "Video for testing navigation",
          duration: "07:30",
          videoUrl: "/nav-video.mp4",
          author: { id: "user-1", name: "Test User", image: null },
        }),
      });
    });

    await page.goto(`/${orgId}/search?q=navigate`);

    // Click on video
    await page.getByText("Navigation Test Video").click();

    // Should navigate to video page
    await expect(page).toHaveURL(`**/${orgId}/videos/nav-video-1`);
    await expect(page.getByText("Video for testing navigation")).toBeVisible();
  });

  test("should search across multiple content types in all tab", async ({ page }) => {
    // Mock comprehensive search results
    await page.route("**/api/search**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            query: "comprehensive",
            total: 6,
            videos: [
              {
                id: "comp-video-1",
                title: "Comprehensive Video 1",
                duration: "10:00",
                author: { name: "Creator 1" },
              },
              {
                id: "comp-video-2",
                title: "Comprehensive Video 2", 
                duration: "15:00",
                author: { name: "Creator 2" },
              }
            ],
            channels: [
              {
                id: "comp-channel-1",
                name: "Comprehensive Channel",
                description: "A comprehensive channel",
                memberCount: 50,
              }
            ],
            collections: [
              {
                id: "comp-collection-1",
                name: "Comprehensive Series",
                description: "A comprehensive collection",
              }
            ],
            users: [
              {
                id: "comp-user-1",
                name: "Comprehensive User",
                role: "member",
                organization: { name: "Test Org" },
              },
              {
                id: "comp-user-2",
                name: "Another Comprehensive User",
                role: "owner", 
                organization: { name: "Test Org" },
              }
            ],
          },
        }),
      });
    });

    await page.goto(`/${orgId}/search?q=comprehensive`);

    // Should show all sections on "All" tab
    await expect(page.getByText("Videos", { exact: true })).toBeVisible();
    await expect(page.getByText("Channels", { exact: true })).toBeVisible();
    await expect(page.getByText("Series", { exact: true })).toBeVisible();
    await expect(page.getByText("People", { exact: true })).toBeVisible();

    // Check video results
    await expect(page.getByText("Comprehensive Video 1")).toBeVisible();
    await expect(page.getByText("Comprehensive Video 2")).toBeVisible();

    // Check channel results  
    await expect(page.getByText("Comprehensive Channel")).toBeVisible();
    await expect(page.getByText("50 members")).toBeVisible();

    // Check collection results
    await expect(page.getByText("Comprehensive Series")).toBeVisible();

    // Check user results
    await expect(page.getByText("Comprehensive User")).toBeVisible();
    await expect(page.getByText("Another Comprehensive User")).toBeVisible();
    await expect(page.getByText("member in Test Org")).toBeVisible();
    await expect(page.getByText("owner in Test Org")).toBeVisible();
  });

  test("should maintain search state when switching between tabs", async ({ page }) => {
    // Mock search API
    await page.route("**/api/search**", async (route) => {
      const url = new URL(route.request().url());
      const type = url.searchParams.get("type");
      
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            query: "state",
            total: 2,
            videos: type === "all" || type === "videos" ? [
              { id: "state-video", title: "State Video", duration: "05:00", author: { name: "User" } }
            ] : [],
            channels: type === "all" || type === "channels" ? [
              { id: "state-channel", name: "State Channel", memberCount: 10 }
            ] : [],
            collections: [],
            users: [],
          },
        }),
      });
    });

    await page.goto(`/${orgId}/search?q=state`);

    // Should show results on All tab
    await expect(page.getByText("State Video")).toBeVisible();
    await expect(page.getByText("State Channel")).toBeVisible();

    // Switch to Videos tab
    await page.getByRole("tab", { name: /videos/i }).click();
    await expect(page.getByText("State Video")).toBeVisible();
    await expect(page.getByText("State Channel")).not.toBeVisible();

    // Switch to Channels tab  
    await page.getByRole("tab", { name: /channels/i }).click();
    await expect(page.getByText("State Channel")).toBeVisible();
    await expect(page.getByText("State Video")).not.toBeVisible();

    // Switch back to All tab
    await page.getByRole("tab", { name: /all/i }).click();
    await expect(page.getByText("State Video")).toBeVisible();
    await expect(page.getByText("State Channel")).toBeVisible();
  });
});