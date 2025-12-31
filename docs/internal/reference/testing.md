# Testing Guide

This guide covers testing strategies, patterns, and best practices for the Nuclom video collaboration platform.

## Testing Strategy

### Testing Pyramid

```
    /\
   /  \     E2E Tests (Few, High-level)
  /____\    Integration Tests (Some, API & Components)
 /______\   Unit Tests (Many, Functions & Hooks)
```

### Current Status

**E2E Tests**: Configured with Playwright. Tests are located in the `e2e/` directory and run via GitHub Actions on every push/PR.

**Unit/Integration Tests**: Configured with Vitest. Tests are located in `__tests__` directories or files with `.test.ts` suffix.

## Running E2E Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run tests with UI mode (interactive)
pnpm test:e2e:ui

# Run tests in headed mode (see browser)
pnpm test:e2e:headed

# View test report
pnpm test:e2e:report
```

### E2E Test Coverage

The E2E test suite covers:
- **Landing Page**: Hero section, features, pricing, about, footer, navigation
- **Authentication**: Login form, registration form, OAuth buttons, validation, redirects
- **Organization Dashboard**: Video sections, empty states, navigation
- **Video Upload**: Upload page layout, drag-and-drop area, back navigation
- **Video Management**: Video list, detail pages, search, my-videos, shared, channels, series
- **Settings**: Profile, organization, members settings pages
- **Public Pages**: Privacy policy, terms of service, support, contact, 404 handling
- **Performance**: Page load times

## Running Unit Tests

```bash
# Run all unit tests
pnpm test

# Run tests in watch mode
pnpm test -- --watch

# Run tests with coverage
pnpm test:coverage

# Run tests with UI mode
pnpm test:ui
```

## Test Configuration

### Vitest Configuration

The project uses Vitest for unit and integration testing. Configuration is in `vitest.config.ts`:

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["**/__tests__/**/*.test.{ts,tsx}", "**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", "e2e"],
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules", ".next", "e2e"],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
```

### Test Setup File

```typescript
// src/test/setup.ts
import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
  usePathname: () => "/",
}));

// Mock next-themes
vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "light",
    setTheme: vi.fn(),
  }),
}));
```

### Package.json Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

## Unit Testing

### Testing Utilities

```typescript
// src/lib/test-utils.tsx
import { render, RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme-provider";
import { ReactElement } from "react";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

interface AllTheProvidersProps {
  children: React.ReactNode;
}

const AllTheProviders = ({ children }: AllTheProvidersProps) => {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light">
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) => render(ui, { wrapper: AllTheProviders, ...options });

// Re-export everything
export * from "@testing-library/react";
export { customRender as render };
```

### Component Testing

```typescript
// src/components/__tests__/video-card.test.tsx
import { render, screen } from "@/lib/test-utils";
import { VideoCard } from "../video-card";
import { mockVideo } from "@/lib/mock-data";
import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";

describe("VideoCard", () => {
  it("renders video information", () => {
    render(<VideoCard video={mockVideo} onClick={vi.fn()} />);

    expect(screen.getByText(mockVideo.title)).toBeInTheDocument();
    expect(screen.getByText(mockVideo.description)).toBeInTheDocument();
    expect(screen.getByText(mockVideo.duration)).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const mockOnClick = vi.fn();

    render(<VideoCard video={mockVideo} onClick={mockOnClick} />);

    const card = screen.getByRole("button");
    await user.click(card);

    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it("displays thumbnail when provided", () => {
    render(
      <VideoCard
        video={{
          ...mockVideo,
          thumbnailUrl: "https://example.com/thumbnail.jpg",
        }}
        onClick={vi.fn()}
      />
    );

    const thumbnail = screen.getByRole("img");
    expect(thumbnail).toHaveAttribute(
      "src",
      "https://example.com/thumbnail.jpg"
    );
  });

  it("shows placeholder when no thumbnail", () => {
    render(
      <VideoCard
        video={{
          ...mockVideo,
          thumbnailUrl: undefined,
        }}
        onClick={vi.fn()}
      />
    );

    expect(screen.getByText("No thumbnail")).toBeInTheDocument();
  });
});
```

### Hook Testing

```typescript
// src/hooks/__tests__/use-videos.test.ts
import { renderHook, waitFor } from "@testing-library/react";
import { useVideos } from "../use-api";
import { server } from "@/mocks/server";
import { rest } from "msw";

describe("useVideos", () => {
  it("fetches videos successfully", async () => {
    const { result } = renderHook(() =>
      useVideos({
        organizationId: "organization-1",
      })
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeDefined();
    expect(result.current.error).toBeNull();
  });

  it("handles fetch error", async () => {
    server.use(
      rest.get("/api/videos", (req, res, ctx) => {
        return res(ctx.status(500), ctx.json({ error: "Server error" }));
      })
    );

    const { result } = renderHook(() =>
      useVideos({
        organizationId: "organization-1",
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Failed to fetch videos (500)");
    expect(result.current.data).toBeNull();
  });

  it("refetches when parameters change", async () => {
    const { result, rerender } = renderHook(
      ({ organizationId }) => useVideos({ organizationId }),
      {
        initialProps: { organizationId: "organization-1" },
      }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    rerender({ organizationId: "organization-2" });

    expect(result.current.loading).toBe(true);
  });
});
```

### Utility Testing

```typescript
// src/lib/__tests__/utils.test.ts
import { cn } from "../utils";

describe("cn utility", () => {
  it("merges class names", () => {
    expect(cn("class1", "class2")).toBe("class1 class2");
  });

  it("handles conditional classes", () => {
    expect(cn("base", true && "conditional")).toBe("base conditional");
    expect(cn("base", false && "conditional")).toBe("base");
  });

  it("merges tailwind classes correctly", () => {
    expect(cn("px-4", "px-6")).toBe("px-6");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("handles arrays and objects", () => {
    expect(cn(["class1", "class2"])).toBe("class1 class2");
    expect(cn({ class1: true, class2: false })).toBe("class1");
  });
});
```

## Integration Testing

### API Route Testing

```typescript
// src/app/api/videos/__tests__/route.test.ts
import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import { db } from "@/lib/db";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database
vi.mock("@/lib/db");

describe("/api/videos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("returns videos for organization", async () => {
      const mockVideos = [
        {
          id: "video-1",
          title: "Test Video",
          organizationId: "organization-1",
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockVideos),
        }),
      } as any);

      const request = new NextRequest(
        "http://localhost:3000/api/videos?organizationId=organization-1"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockVideos);
    });

    it("returns 400 for missing organizationId", async () => {
      const request = new NextRequest("http://localhost:3000/api/videos");

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Organization ID is required");
    });
  });

  describe("POST", () => {
    it("creates video successfully", async () => {
      const mockVideo = {
        id: "video-1",
        title: "New Video",
        organizationId: "organization-1",
      };

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockVideo]),
        }),
      } as any);

      const request = new NextRequest("http://localhost:3000/api/videos", {
        method: "POST",
        body: JSON.stringify({
          title: "New Video",
          organizationId: "organization-1",
          duration: "10:30",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockVideo);
    });

    it("returns 400 for invalid data", async () => {
      const request = new NextRequest("http://localhost:3000/api/videos", {
        method: "POST",
        body: JSON.stringify({
          title: "", // Invalid: empty title
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Title is required");
    });
  });
});
```

### Database Testing

```typescript
// src/lib/db/__tests__/operations.test.ts
import { db } from "../index";
import { users, videos, organizations } from "../schema";
import { eq } from "drizzle-orm";
import { setupTestDatabase, cleanupTestDatabase } from "@/lib/test-db";

describe("Database Operations", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(videos);
    await db.delete(organizations);
    await db.delete(users);
  });

  it("creates user successfully", async () => {
    const userData = {
      email: "test@example.com",
      name: "Test User",
    };

    const [user] = await db.insert(users).values(userData).returning();

    expect(user.id).toBeDefined();
    expect(user.email).toBe(userData.email);
    expect(user.name).toBe(userData.name);
  });

  it("creates video with relationships", async () => {
    // Create user
    const [user] = await db
      .insert(users)
      .values({
        email: "author@example.com",
        name: "Author",
      })
      .returning();

    // Create organization
    const [organization] = await db
      .insert(organizations)
      .values({
        name: "Test Organization",
        slug: "test-organization",
      })
      .returning();

    // Create video
    const [video] = await db
      .insert(videos)
      .values({
        title: "Test Video",
        duration: "10:30",
        authorId: user.id,
        organizationId: organization.id,
      })
      .returning();

    expect(video.id).toBeDefined();
    expect(video.authorId).toBe(user.id);
    expect(video.organizationId).toBe(organization.id);
  });

  it("enforces foreign key constraints", async () => {
    await expect(
      db.insert(videos).values({
        title: "Test Video",
        duration: "10:30",
        authorId: "non-existent-user",
        organizationId: "non-existent-organization",
      })
    ).rejects.toThrow();
  });
});
```

## E2E Testing

### Playwright Configuration

The project uses Playwright for E2E testing. Configuration is in `playwright.config.ts`:

```typescript
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
      dependencies: ["setup"],
    },
  ],
  webServer: process.env.CI ? undefined : {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
```

### Test File Structure

```
e2e/
├── auth.setup.ts       # Authentication setup for tests
├── fixtures.ts         # Test fixtures and utilities
├── landing.spec.ts     # Landing page tests
├── auth.spec.ts        # Authentication flow tests
├── organization.spec.ts # Organization dashboard tests
├── upload.spec.ts      # Video upload tests
├── videos.spec.ts      # Video management tests
├── settings.spec.ts    # Settings pages tests
└── public-pages.spec.ts # Public pages tests
```

### E2E Test Examples

```typescript
// tests/e2e/video-management.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Video Management", () => {
  test.beforeEach(async ({ page }) => {
    // Setup authentication
    await page.goto("/login");
    await page.fill('[data-testid="email"]', "test@example.com");
    await page.fill('[data-testid="password"]', "password");
    await page.click('[data-testid="login-button"]');
    await page.waitForURL("/organization-1");
  });

  test("displays videos in organization", async ({ page }) => {
    await page.goto("/organization-1/videos");

    await expect(page.locator('[data-testid="video-card"]')).toBeVisible();
    await expect(page.locator("h1")).toContainText("Videos");
  });

  test("creates new video", async ({ page }) => {
    await page.goto("/organization-1/videos");
    await page.click('[data-testid="create-video-button"]');

    await page.fill('[data-testid="video-title"]', "Test Video");
    await page.fill('[data-testid="video-description"]', "Test Description");
    await page.fill('[data-testid="video-duration"]', "10:30");

    await page.click('[data-testid="save-video-button"]');

    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page.locator("text=Test Video")).toBeVisible();
  });

  test("edits existing video", async ({ page }) => {
    await page.goto("/organization-1/videos");
    await page.click('[data-testid="video-card"]:first-child');
    await page.click('[data-testid="edit-video-button"]');

    await page.fill('[data-testid="video-title"]', "Updated Video Title");
    await page.click('[data-testid="save-video-button"]');

    await expect(page.locator("text=Updated Video Title")).toBeVisible();
  });

  test("deletes video", async ({ page }) => {
    await page.goto("/organization-1/videos");
    await page.click('[data-testid="video-card"]:first-child');
    await page.click('[data-testid="delete-video-button"]');
    await page.click('[data-testid="confirm-delete"]');

    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
  });
});
```

### Page Object Model

```typescript
// tests/e2e/pages/video-page.ts
import { Page, Locator } from "@playwright/test";

export class VideoPage {
  readonly page: Page;
  readonly createButton: Locator;
  readonly titleInput: Locator;
  readonly descriptionInput: Locator;
  readonly durationInput: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.createButton = page.locator('[data-testid="create-video-button"]');
    this.titleInput = page.locator('[data-testid="video-title"]');
    this.descriptionInput = page.locator('[data-testid="video-description"]');
    this.durationInput = page.locator('[data-testid="video-duration"]');
    this.saveButton = page.locator('[data-testid="save-video-button"]');
  }

  async goto(organizationId: string) {
    await this.page.goto(`/${organizationId}/videos`);
  }

  async createVideo(title: string, description: string, duration: string) {
    await this.createButton.click();
    await this.titleInput.fill(title);
    await this.descriptionInput.fill(description);
    await this.durationInput.fill(duration);
    await this.saveButton.click();
  }

  async expectVideoToExist(title: string) {
    await this.page.waitForSelector(`text=${title}`);
  }
}
```

## Mock Data and MSW

### Mock Service Worker Setup

```typescript
// src/mocks/server.ts
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
```

### API Handlers

```typescript
// src/mocks/handlers.ts
import { rest } from "msw";
import { mockVideos, mockOrganizations } from "@/lib/mock-data";

export const handlers = [
  rest.get("/api/videos", (req, res, ctx) => {
    const organizationId = req.url.searchParams.get("organizationId");

    if (!organizationId) {
      return res(
        ctx.status(400),
        ctx.json({ success: false, error: "Organization ID is required" })
      );
    }

    const videos = mockVideos.filter(
      (v) => v.organizationId === organizationId
    );

    return res(
      ctx.json({
        success: true,
        data: {
          data: videos,
          pagination: {
            page: 1,
            limit: 20,
            total: videos.length,
            totalPages: 1,
          },
        },
      })
    );
  }),

  rest.post("/api/videos", async (req, res, ctx) => {
    const body = await req.json();

    const newVideo = {
      id: `video-${Date.now()}`,
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return res(
      ctx.status(201),
      ctx.json({
        success: true,
        data: newVideo,
      })
    );
  }),

  rest.get("/api/organizations", (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        data: mockOrganizations,
      })
    );
  }),
];
```

## Test Data Management

### Database Test Utilities

```typescript
// src/lib/test-db.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";

let testDb: ReturnType<typeof drizzle>;

export async function setupTestDatabase() {
  const connectionString =
    process.env.TEST_DATABASE_URL ||
    "postgresql://test:test@localhost:5432/nuclom_test";

  const client = postgres(connectionString);
  testDb = drizzle(client);

  // Run migrations
  await migrate(testDb, { migrationsFolder: "./drizzle" });

  return testDb;
}

export async function cleanupTestDatabase() {
  // Clean up test data
  await testDb.delete(videos);
  await testDb.delete(organizations);
  await testDb.delete(users);
}

export function getTestDb() {
  return testDb;
}
```

### Factory Pattern for Test Data

```typescript
// src/lib/test-factories.ts
import { faker } from "@faker-js/faker";
import type { User, Video, Organization } from "@/lib/db/schema";

export function createUserFactory(overrides: Partial<User> = {}): User {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    avatarUrl: faker.image.avatar(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createVideoFactory(overrides: Partial<Video> = {}): Video {
  return {
    id: faker.string.uuid(),
    title: faker.lorem.words(3),
    description: faker.lorem.sentence(),
    duration: "10:30",
    thumbnailUrl: faker.image.url(),
    videoUrl: faker.internet.url(),
    authorId: faker.string.uuid(),
    organizationId: faker.string.uuid(),
    channelId: null,
    seriesId: null,
    transcript: null,
    aiSummary: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createOrganizationFactory(
  overrides: Partial<Organization> = {}
): Organization {
  return {
    id: faker.string.uuid(),
    name: faker.company.name(),
    slug: faker.lorem.slug(),
    description: faker.lorem.sentence(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
```

## Best Practices

### Test Organization

1. **Group related tests** in describe blocks
2. **Use descriptive test names**
3. **Follow AAA pattern** (Arrange, Act, Assert)
4. **Keep tests isolated** and independent
5. **Use appropriate test types** for different scenarios

### Test Data

1. **Use factories** for test data creation
2. **Clean up** after each test
3. **Use realistic data** that reflects real usage
4. **Mock external dependencies**
5. **Use separate test databases**

### Coverage Goals

- **Unit Tests**: 80%+ coverage
- **Integration Tests**: Critical paths covered
- **E2E Tests**: Happy path and error scenarios
- **Visual Tests**: Component rendering

### CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: nuclom_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "18"
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install

      - name: Run unit tests
        run: pnpm test
        env:
          TEST_DATABASE_URL: postgresql://postgres:test@localhost:5432/nuclom_test

      - name: Run E2E tests
        run: pnpm test:e2e

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Next Steps

- [Learn about the component library](./components.md)
- [Understand the hook system](./hooks.md)
- [Read the contributing guidelines](./contributing.md)
- [Set up the development environment](./development-setup.md)
