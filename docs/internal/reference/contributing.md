# Contributing Guidelines

Welcome to the Nuclom project! We're excited to have you contribute to building the future of video collaboration. This guide will help you understand our development workflow, coding standards, and contribution process.

## Getting Started

### Prerequisites

Before contributing, make sure you have:

1. **Development Environment**: [Set up your local environment](./development-setup.md)
2. **Database**: [Configure PostgreSQL](./database-setup.md)
3. **Environment Variables**: [Set up your .env.local](./environment-config.md)

### First Contribution

1. **Find an issue**: Look for issues labeled `good first issue` or `help wanted`
2. **Fork the repository**: Create your own fork of the project
3. **Clone your fork**: `git clone https://github.com/yourusername/nuclom.git`
4. **Create a branch**: `git checkout -b feature/your-feature-name`
5. **Make your changes**: Follow our coding standards
6. **Test your changes**: Run tests and ensure everything works
7. **Submit a pull request**: Create a PR with a clear description

## Development Workflow

### Branch Naming Convention

Use descriptive branch names that indicate the type of change:

```bash
# Features
feature/user-authentication
feature/video-upload
feature/organization-management

# Bug fixes
fix/video-player-controls
fix/database-connection
fix/mobile-responsive-issues

# Documentation
docs/api-reference
docs/contributing-guide
docs/deployment-instructions

# Refactoring
refactor/component-structure
refactor/api-endpoints
refactor/database-schema

# Chores
chore/dependency-updates
chore/build-optimization
chore/lint-configuration
```

### Commit Message Convention

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```bash
# Format
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]

# Examples
feat: add video upload functionality
fix: resolve video player pause issue
docs: update API documentation
style: fix code formatting issues
refactor: restructure component architecture
test: add unit tests for video service
chore: update dependencies
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, missing semicolons, etc.)
- **refactor**: Code refactoring
- **test**: Adding or updating tests
- **chore**: Maintenance tasks

## Code Standards

### TypeScript

#### Type Definitions

```typescript
// ✅ Good: Use specific types
interface VideoCardProps {
  readonly video: {
    id: string;
    title: string;
    duration: string;
    thumbnailUrl?: string;
  };
  readonly onClick: () => void;
  readonly className?: string;
}

// ❌ Bad: Use generic types
interface VideoCardProps {
  readonly video: any;
  readonly onClick: Function;
  readonly className?: string;
}
```

#### Import Types

```typescript
// ✅ Good: Import types separately
import type { ReactNode } from "react";
import type { Video } from "@/lib/types";
import { Button } from "@/components/ui/button";

// ❌ Bad: Mix type and value imports
import { ReactNode, Button } from "react";
```

#### Readonly Props

```typescript
// ✅ Good: Use readonly for React props
interface ComponentProps {
  readonly title: string;
  readonly items: readonly string[];
  readonly onSubmit: (data: FormData) => void;
}

// ❌ Bad: Mutable props
interface ComponentProps {
  title: string;
  items: string[];
  onSubmit: (data: FormData) => void;
}
```

### React Components

#### Component Structure

```typescript
// ✅ Good: Functional component with proper typing
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MyComponentProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly variant?: "default" | "primary" | "secondary";
}

export function MyComponent({
  children,
  className,
  variant = "default",
}: MyComponentProps) {
  return (
    <div
      className={cn(
        "base-styles",
        variant === "primary" && "primary-styles",
        variant === "secondary" && "secondary-styles",
        className
      )}
    >
      {children}
    </div>
  );
}
```

#### Hooks Usage

```typescript
// ✅ Good: Proper hook usage
import { useState, useEffect, useCallback } from "react";

export function VideoPlayer({ videoId }: { videoId: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
  }, []);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      setIsPlaying(false);
    };
  }, []);

  return <div>{/* Component JSX */}</div>;
}
```

### CSS and Styling

#### Tailwind CSS

```typescript
// ✅ Good: Use semantic classes and utilities
<div className="rounded-lg border border-border bg-card p-6">
  <h2 className="text-2xl font-semibold text-foreground">Title</h2>
  <p className="text-muted-foreground">Description</p>
</div>

// ❌ Bad: Hardcoded values
<div className="rounded-lg border border-gray-200 bg-white p-6">
  <h2 className="text-2xl font-semibold text-black">Title</h2>
  <p className="text-gray-600">Description</p>
</div>
```

#### Conditional Styling

```typescript
// ✅ Good: Use cn utility for conditional classes
import { cn } from "@/lib/utils";

<Button
  className={cn(
    "base-button-styles",
    variant === "primary" && "bg-primary text-primary-foreground",
    variant === "secondary" && "bg-secondary text-secondary-foreground",
    size === "sm" && "h-8 px-3 text-sm",
    size === "lg" && "h-12 px-6 text-lg",
    disabled && "opacity-50 cursor-not-allowed"
  )}
/>;
```

### API and Database

#### API Routes

Use the centralized API handler utilities from `@/lib/api-handler`:

```typescript
// ✅ Good: Use centralized helpers for consistent error handling
import { Effect } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { createFullLayer, handleEffectExit } from "@/lib/api-handler";
import { Auth } from "@/lib/effect/services/auth";
import { VideoRepository } from "@/lib/effect/services/video-repository";
import { validateRequestBody } from "@/lib/validation";
import { createVideoSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authentication
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Validation
    const data = yield* validateRequestBody(createVideoSchema, request);

    // Business logic
    const videoRepo = yield* VideoRepository;
    return yield* videoRepo.createVideo({
      ...data,
      authorId: user.id,
    });
  });

  const FullLayer = createFullLayer();
  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

  // Use handleEffectExit for GET, handleEffectExitWithStatus for POST (201)
  return handleEffectExit(exit);
}
```

#### Database Operations

```typescript
// ✅ Good: Use proper error handling and transactions
import { db } from "@/lib/db";
import { videos, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function createVideoWithAuthor(
  videoData: CreateVideoData,
  authorId: string
) {
  try {
    // Verify author exists
    const author = await db.query.users.findFirst({
      where: eq(users.id, authorId),
    });

    if (!author) {
      throw new Error("Author not found");
    }

    // Create video
    const [video] = await db
      .insert(videos)
      .values({
        ...videoData,
        authorId,
      })
      .returning();

    return video;
  } catch (error) {
    console.error("Database Error:", error);
    throw error;
  }
}
```

### Utility Functions

Use centralized utility functions instead of defining local helpers:

```typescript
// ✅ Good: Use centralized formatting utilities
import { formatTime, formatDate, formatRelativeTime, formatDuration } from "@/lib/format-utils";

// Format video timestamps (MM:SS or HH:MM:SS)
<span>{formatTime(video.currentTime)}</span>

// Format dates
<span>{formatDate(video.createdAt)}</span> // "Dec 31, 2024"

// Format relative time
<span>{formatRelativeTime(video.createdAt)}</span> // "2 days ago"

// Format duration
<span>{formatDuration(video.durationSeconds)}</span> // "1:05:30"

// ❌ Bad: Define local formatting functions
function formatTime(seconds) { ... } // Duplicates existing utility
```

Available formatting utilities in `@/lib/format-utils`:
- `formatTime(seconds)` - Video timestamps (MM:SS or HH:MM:SS)
- `formatTimePrecise(seconds)` - Timestamps with milliseconds (MM:SS.mmm)
- `formatDuration(seconds)` - Duration display
- `formatDurationHuman(minutes)` - Human-readable duration (1h 30m)
- `formatDate(date)` - Date formatting (Dec 31, 2024)
- `formatDateTime(date)` - Full date-time formatting
- `formatRelativeTime(date)` - Relative time (2 days ago)
- `formatCompactNumber(value)` - Compact numbers (1.5K, 2.5M)
- `formatFileSize(bytes)` - File size formatting (1.5 MB)

## Testing Requirements

### Unit Tests

All new features must include unit tests:

```typescript
// src/components/__tests__/my-component.test.tsx
import { render, screen } from "@/lib/test-utils";
import { MyComponent } from "../my-component";

describe("MyComponent", () => {
  it("renders correctly", () => {
    render(<MyComponent>Test content</MyComponent>);
    expect(screen.getByText("Test content")).toBeInTheDocument();
  });

  it("handles click events", async () => {
    const handleClick = jest.fn();
    render(<MyComponent onClick={handleClick}>Click me</MyComponent>);

    await user.click(screen.getByText("Click me"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Integration Tests

API endpoints should have integration tests:

```typescript
// src/app/api/videos/__tests__/route.test.ts
import { GET, POST } from "../route";
import { NextRequest } from "next/server";

describe("/api/videos", () => {
  it("creates video successfully", async () => {
    const request = new NextRequest("http://localhost:5001/api/videos", {
      method: "POST",
      body: JSON.stringify({
        title: "Test Video",
        duration: "10:30",
        organizationId: "organization-1",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
  });
});
```

### Test Coverage

- **Minimum coverage**: 70% for new code
- **Critical paths**: 90% coverage required
- **Run tests**: `pnpm test` before submitting PR

## Code Review Process

### Pull Request Requirements

1. **Clear description**: Explain what changes were made and why
2. **Screenshots**: Include screenshots for UI changes
3. **Test coverage**: Ensure tests pass and coverage is adequate
4. **Documentation**: Update documentation if needed
5. **Breaking changes**: Clearly document any breaking changes

### PR Template

```markdown
## Description

Brief description of the changes made.

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed
- [ ] All tests pass

## Screenshots

Include screenshots for UI changes.

## Checklist

- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
```

### Review Criteria

Reviewers will check for:

1. **Code quality**: Clean, readable, and maintainable code
2. **Performance**: Efficient implementations
3. **Security**: No security vulnerabilities
4. **Accessibility**: UI components are accessible
5. **Testing**: Adequate test coverage
6. **Documentation**: Code is well-documented

## Documentation

### Code Documentation

```typescript
// ✅ Good: Clear JSDoc comments
/**
 * Creates a new video in the specified organization.
 *
 * @param videoData - The video data to create
 * @param organizationId - The ID of the organization
 * @returns Promise resolving to the created video
 * @throws Error if organization doesn't exist
 */
export async function createVideo(
  videoData: CreateVideoData,
  organizationId: string
): Promise<Video> {
  // Implementation
}
```

### README Updates

Update documentation when:

- Adding new features
- Changing API endpoints
- Modifying environment variables
- Adding new dependencies

## Performance Guidelines

### Component Performance

```typescript
// ✅ Good: Memoize expensive components
import { memo, useMemo } from "react";

const ExpensiveComponent = memo(function ExpensiveComponent({ data }) {
  const processedData = useMemo(() => {
    return data.map((item) => ({
      ...item,
      processed: expensiveOperation(item),
    }));
  }, [data]);

  return (
    <div>
      {processedData.map((item) => (
        <div key={item.id}>{item.processed}</div>
      ))}
    </div>
  );
});
```

### Database Performance

```typescript
// ✅ Good: Efficient database queries
const videos = await db.query.videos.findMany({
  where: eq(videos.organizationId, organizationId),
  with: {
    author: {
      columns: {
        id: true,
        name: true,
        avatarUrl: true,
      },
    },
  },
  limit: 20,
  offset: page * 20,
});
```

## Security Guidelines

### Input Validation

```typescript
// ✅ Good: Validate all inputs
import { Effect, Schema } from "effect";
import { validate } from "@/lib/validation";

const updateVideoSchema = Schema.Struct({
  title: Schema.String,
  description: Schema.optional(Schema.String),
  duration: Schema.String,
});

export async function updateVideo(id: string, data: unknown) {
  const validatedData = await Effect.runPromise(validate(updateVideoSchema, data));
  // Process validated data
}
```

### Environment Variables

```typescript
// ✅ Good: Validate environment variables
import { Config, Effect } from "effect";

const EnvConfig = Config.all({
  DATABASE_URL: Config.string("DATABASE_URL"),
  BETTER_AUTH_SECRET: Config.string("BETTER_AUTH_SECRET"),
  REPLICATE_API_TOKEN: Config.string("REPLICATE_API_TOKEN").pipe(Config.option),
});

export const env = Effect.runSync(Config.unwrap(EnvConfig));
```

## Accessibility Requirements

### ARIA Attributes

```typescript
// ✅ Good: Proper ARIA attributes
<button aria-label="Play video" aria-pressed={isPlaying} onClick={handlePlay}>
  {isPlaying ? <PauseIcon /> : <PlayIcon />}
</button>
```

### Keyboard Navigation

```typescript
// ✅ Good: Keyboard navigation support
<div
  role="button"
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  }}
  onClick={handleClick}
>
  Clickable content
</div>
```

## Common Mistakes to Avoid

### TypeScript

```typescript
// ❌ Bad: Using any
function processData(data: any): any {
  return data.map((item) => item.value);
}

// ✅ Good: Using proper types
function processData<T extends { value: string }>(data: T[]): string[] {
  return data.map((item) => item.value);
}
```

### React

```typescript
// ❌ Bad: Missing dependency array
useEffect(() => {
  fetchData(id);
}, []); // Missing 'id' dependency

// ✅ Good: Proper dependency array
useEffect(() => {
  fetchData(id);
}, [id]);
```

### CSS

```typescript
// ❌ Bad: Hardcoded colors
<div className="bg-blue-500 text-white">
  Content
</div>

// ✅ Good: Semantic colors
<div className="bg-primary text-primary-foreground">
  Content
</div>
```

## Getting Help

### Resources

- **Documentation**: Check the [docs/](../README.md) directory
- **GitHub Issues**: Search existing issues or create new ones
- **Discussions**: Use GitHub Discussions for questions
- **Code Review**: Request reviews from maintainers

### Communication

- **Be respectful**: Treat all contributors with respect
- **Be specific**: Provide clear descriptions of issues and questions
- **Be patient**: Maintainers are volunteers with limited time
- **Be helpful**: Help other contributors when possible

## Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):

- **Major** (1.0.0): Breaking changes
- **Minor** (0.1.0): New features, backwards compatible
- **Patch** (0.0.1): Bug fixes, backwards compatible

### Changelog

All changes are documented in [CHANGELOG.md](../CHANGELOG.md):

```markdown
## [1.2.0] - 2024-01-15

### Added

- Video upload functionality
- Organization management
- User authentication

### Changed

- Improved video player performance
- Updated UI components

### Fixed

- Fixed video playback issues
- Resolved database connection problems

### Removed

- Removed deprecated API endpoints
```

## Recognition

Contributors are recognized in:

- **README.md**: Contributors section
- **Release notes**: Major contributor mentions
- **GitHub**: Contributor insights and statistics

Thank you for contributing to Nuclom! Your efforts help make video collaboration better for everyone.
