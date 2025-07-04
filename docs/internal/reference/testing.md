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

**Note**: Nuclom currently has no tests configured. This guide provides the foundation for implementing a comprehensive testing strategy.

## Test Setup

### Installing Testing Dependencies

```bash
# Testing framework and utilities
pnpm add -D jest @jest/globals
pnpm add -D @testing-library/react @testing-library/jest-dom @testing-library/user-event
pnpm add -D @types/jest

# Next.js testing utilities
pnpm add -D @next/env jest-environment-jsdom

# Database testing
pnpm add -D @testcontainers/postgresql

# E2E testing
pnpm add -D playwright @playwright/test
```

### Jest Configuration

```javascript
// jest.config.js
const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testEnvironment: "jest-environment-jsdom",
  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],
  moduleNameMapping: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  collectCoverageFrom: [
    "src/**/*.{js,jsx,ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/*.stories.{js,jsx,ts,tsx}",
    "!src/**/index.{js,jsx,ts,tsx}",
  ],
  testMatch: [
    "**/__tests__/**/*.(test|spec).(js|jsx|ts|tsx)",
    "**/*.(test|spec).(js|jsx|ts|tsx)",
  ],
};

module.exports = createJestConfig(customJestConfig);
```

### Test Setup File

```javascript
// jest.setup.js
import "@testing-library/jest-dom";
import { server } from "./src/mocks/server";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
  usePathname: () => "/",
}));

// Mock next-themes
jest.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "light",
    setTheme: jest.fn(),
  }),
}));

// Setup MSW
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Package.json Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:db": "jest --testPathPattern=__tests__/database"
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

describe("VideoCard", () => {
  it("renders video information", () => {
    render(
      <VideoCard
        video={mockVideo}
        onClick={jest.fn()}
      />
    );

    expect(screen.getByText(mockVideo.title)).toBeInTheDocument();
    expect(screen.getByText(mockVideo.description)).toBeInTheDocument();
    expect(screen.getByText(mockVideo.duration)).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const mockOnClick = jest.fn();
    
    render(
      <VideoCard
        video={mockVideo}
        onClick={mockOnClick}
      />
    );

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
        onClick={jest.fn()}
      />
    );

    const thumbnail = screen.getByRole("img");
    expect(thumbnail).toHaveAttribute("src", "https://example.com/thumbnail.jpg");
  });

  it("shows placeholder when no thumbnail", () => {
    render(
      <VideoCard
        video={{
          ...mockVideo,
          thumbnailUrl: undefined,
        }}
        onClick={jest.fn()}
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
    const { result } = renderHook(() => useVideos({
      workspaceId: "workspace-1",
    }));

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

    const { result } = renderHook(() => useVideos({
      workspaceId: "workspace-1",
    }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Failed to fetch videos (500)");
    expect(result.current.data).toBeNull();
  });

  it("refetches when parameters change", async () => {
    const { result, rerender } = renderHook(
      ({ workspaceId }) => useVideos({ workspaceId }),
      {
        initialProps: { workspaceId: "workspace-1" },
      }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    rerender({ workspaceId: "workspace-2" });

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
import { videos } from "@/lib/db/schema";

// Mock database
jest.mock("@/lib/db");

describe("/api/videos", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET", () => {
    it("returns videos for workspace", async () => {
      const mockVideos = [
        {
          id: "video-1",
          title: "Test Video",
          workspaceId: "workspace-1",
        },
      ];

      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockVideos),
        }),
      });

      const request = new NextRequest(
        "http://localhost:3000/api/videos?workspaceId=workspace-1"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockVideos);
    });

    it("returns 400 for missing workspaceId", async () => {
      const request = new NextRequest("http://localhost:3000/api/videos");

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Workspace ID is required");
    });
  });

  describe("POST", () => {
    it("creates video successfully", async () => {
      const mockVideo = {
        id: "video-1",
        title: "New Video",
        workspaceId: "workspace-1",
      };

      (db.insert as jest.Mock).mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockVideo]),
        }),
      });

      const request = new NextRequest("http://localhost:3000/api/videos", {
        method: "POST",
        body: JSON.stringify({
          title: "New Video",
          workspaceId: "workspace-1",
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
import { users, videos, workspaces } from "../schema";
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
    await db.delete(workspaces);
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
    const [user] = await db.insert(users).values({
      email: "author@example.com",
      name: "Author",
    }).returning();

    // Create workspace
    const [workspace] = await db.insert(workspaces).values({
      name: "Test Workspace",
      slug: "test-workspace",
    }).returning();

    // Create video
    const [video] = await db.insert(videos).values({
      title: "Test Video",
      duration: "10:30",
      authorId: user.id,
      workspaceId: workspace.id,
    }).returning();

    expect(video.id).toBeDefined();
    expect(video.authorId).toBe(user.id);
    expect(video.workspaceId).toBe(workspace.id);
  });

  it("enforces foreign key constraints", async () => {
    await expect(
      db.insert(videos).values({
        title: "Test Video",
        duration: "10:30",
        authorId: "non-existent-user",
        workspaceId: "non-existent-workspace",
      })
    ).rejects.toThrow();
  });
});
```

## E2E Testing

### Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
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
    await page.waitForURL("/workspace-1");
  });

  test("displays videos in workspace", async ({ page }) => {
    await page.goto("/workspace-1/videos");

    await expect(page.locator('[data-testid="video-card"]')).toBeVisible();
    await expect(page.locator("h1")).toContainText("Videos");
  });

  test("creates new video", async ({ page }) => {
    await page.goto("/workspace-1/videos");
    await page.click('[data-testid="create-video-button"]');

    await page.fill('[data-testid="video-title"]', "Test Video");
    await page.fill('[data-testid="video-description"]', "Test Description");
    await page.fill('[data-testid="video-duration"]', "10:30");

    await page.click('[data-testid="save-video-button"]');

    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page.locator("text=Test Video")).toBeVisible();
  });

  test("edits existing video", async ({ page }) => {
    await page.goto("/workspace-1/videos");
    await page.click('[data-testid="video-card"]:first-child');
    await page.click('[data-testid="edit-video-button"]');

    await page.fill('[data-testid="video-title"]', "Updated Video Title");
    await page.click('[data-testid="save-video-button"]');

    await expect(page.locator("text=Updated Video Title")).toBeVisible();
  });

  test("deletes video", async ({ page }) => {
    await page.goto("/workspace-1/videos");
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

  async goto(workspaceId: string) {
    await this.page.goto(`/${workspaceId}/videos`);
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
import { mockVideos, mockWorkspaces } from "@/lib/mock-data";

export const handlers = [
  rest.get("/api/videos", (req, res, ctx) => {
    const workspaceId = req.url.searchParams.get("workspaceId");
    
    if (!workspaceId) {
      return res(
        ctx.status(400),
        ctx.json({ success: false, error: "Workspace ID is required" })
      );
    }

    const videos = mockVideos.filter(v => v.workspaceId === workspaceId);
    
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

  rest.get("/api/workspaces", (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        data: mockWorkspaces,
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
  const connectionString = process.env.TEST_DATABASE_URL || 
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
  await testDb.delete(workspaces);
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
import type { User, Video, Workspace } from "@/lib/db/schema";

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
    workspaceId: faker.string.uuid(),
    channelId: null,
    seriesId: null,
    transcript: null,
    aiSummary: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createWorkspaceFactory(overrides: Partial<Workspace> = {}): Workspace {
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
