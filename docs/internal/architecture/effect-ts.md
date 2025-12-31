# Effect-TS Architecture

This document describes the Effect-TS integration in Nuclom, providing type-safe error handling, dependency injection, and composable services.

## Overview

Nuclom uses [Effect-TS](https://effect.website/) as its core functional programming library. Effect provides:

- **Type-safe error handling** - Errors are tracked in the type system
- **Dependency injection** - Services are composed using Layers
- **Composable operations** - Effects can be combined and transformed
- **Resource management** - Automatic cleanup of resources

## Directory Structure

```
src/lib/effect/
├── common.ts           # Common Effect exports
├── errors.ts           # Custom error types
├── config.ts           # Configuration with Effect Config
├── client.ts           # Client-side Effect utilities
├── runtime.ts          # Runtime and Layer configuration
├── retry.ts            # Retry utilities with exponential backoff
├── index.ts            # Main export file
└── services/
    ├── index.ts              # Services export
    ├── database.ts           # Database service (Drizzle)
    ├── storage.ts            # Storage service (R2/S3)
    ├── auth.ts               # Authentication service wrapper
    ├── ai.ts                 # AI service (Vercel AI SDK)
    ├── ai-structured.ts      # AI with structured outputs (Effect Schema)
    ├── video-processor.ts    # Video processing service
    ├── video-repository.ts   # Video data access
    ├── video-ai-processor.ts # AI video analysis pipeline
    ├── recommendations.ts    # Personalized video recommendations
    ├── presence.ts           # Real-time user presence
    ├── watch-later.ts        # Watch later/bookmarks
    ├── comment-reactions.ts  # Comment reactions
    ├── performance-monitoring.ts  # Performance metrics
    └── organization-repository.ts  # Organization data access
```

## Error Types

All errors extend `Data.TaggedError` for type-safe error handling:

```typescript
import { Data } from "effect";

// Database errors
class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly message: string;
  readonly operation?: string;
  readonly cause?: unknown;
}> {}

class NotFoundError extends Data.TaggedError("NotFoundError")<{
  readonly message: string;
  readonly entity: string;
  readonly id?: string;
}> {}

// Usage in Effect
const getVideo = (id: string): Effect.Effect<Video, DatabaseError | NotFoundError, Database> => ...
```

### Error Categories

| Category | Errors | HTTP Status |
|----------|--------|-------------|
| Auth | `UnauthorizedError`, `ForbiddenError`, `SessionError` | 401, 403 |
| Validation | `ValidationError`, `MissingFieldError` | 400 |
| Database | `DatabaseError`, `NotFoundError`, `DuplicateError`, `TransactionError` | 500, 404, 409 |
| Storage | `StorageNotConfiguredError`, `UploadError`, `DeleteError` | 503, 500 |
| Video | `UnsupportedFormatError`, `FileSizeExceededError`, `VideoProcessingError` | 400, 500 |
| AI | `AIServiceError` | 500 |

## Services

### Creating a Service

Services are defined using `Context.Tag`:

```typescript
import { Context, Effect, Layer } from "effect";

// Define service interface
interface StorageService {
  uploadFile: (buffer: Buffer, key: string) => Effect.Effect<UploadResult, UploadError>;
  deleteFile: (key: string) => Effect.Effect<void, DeleteError>;
}

// Create service tag
class Storage extends Context.Tag("Storage")<Storage, StorageService>() {}

// Create service implementation
const makeStorageService = Effect.gen(function* () {
  // Implementation here
  return {
    uploadFile: ...,
    deleteFile: ...,
  } satisfies StorageService;
});

// Create Layer
export const StorageLive = Layer.effect(Storage, makeStorageService);
```

### Using Services

```typescript
import { Effect } from "effect";
import { Storage, VideoRepository } from "@/lib/effect";

const uploadAndSaveVideo = Effect.gen(function* () {
  const storage = yield* Storage;
  const videoRepo = yield* VideoRepository;

  const uploadResult = yield* storage.uploadFile(buffer, key);
  const video = yield* videoRepo.createVideo({
    title: "My Video",
    videoUrl: uploadResult.url,
    ...
  });

  return video;
});
```

## Layers

Layers compose services together:

```typescript
// Base services
const BaseServicesLive = Layer.mergeAll(DatabaseLive, StorageLive);

// Application services
const AppServicesLive = Layer.mergeAll(
  AILive,
  VideoProcessorLive.pipe(Layer.provide(StorageLive))
);

// Repository services
const RepositoryServicesLive = Layer.mergeAll(
  VideoRepositoryLive.pipe(Layer.provide(DatabaseLive)),
  OrganizationRepositoryLive.pipe(Layer.provide(DatabaseLive))
);

// Full application layer
export const AppLive = Layer.mergeAll(
  BaseServicesLive,
  AppServicesLive,
  RepositoryServicesLive
);
```

## Runtime

### Global Runtime

For stateful services (database connections, etc.), use a global runtime:

```typescript
import GlobalValue from "effect/GlobalValue";
import { ManagedRuntime } from "effect";

export const AppRuntime = GlobalValue.globalValue("@nuclom/effect-runtime", () =>
  ManagedRuntime.make(AppLive)
);
```

### Running Effects

```typescript
// Run an effect
const result = await AppRuntime.runPromise(effect);

// Run with exit handling
const exit = await AppRuntime.runPromiseExit(effect);
```

## API Routes

### Converting to Effect

```typescript
import { Effect, Layer, Exit, Cause } from "effect";
import { AppLive, VideoRepository, MissingFieldError } from "@/lib/effect";

export async function GET(request: NextRequest) {
  const effect = Effect.gen(function* () {
    const videoRepo = yield* VideoRepository;
    return yield* videoRepo.getVideos(organizationId);
  });

  const runnable = Effect.provide(effect, AppLive);
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === "Some") {
        return mapErrorToResponse(error.value);
      }
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    },
    onSuccess: (data) => NextResponse.json(data),
  });
}
```

### Error Response Mapping

```typescript
const mapErrorToResponse = (error: unknown): NextResponse => {
  if (error && typeof error === "object" && "_tag" in error) {
    const taggedError = error as { _tag: string; message: string };

    switch (taggedError._tag) {
      case "UnauthorizedError":
        return NextResponse.json({ error: taggedError.message }, { status: 401 });
      case "NotFoundError":
        return NextResponse.json({ error: taggedError.message }, { status: 404 });
      // ... other cases
    }
  }
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
};
```

## Client-Side Usage

### Effect-based API Client

```typescript
import { videoApiEffect, runClientEffect } from "@/lib/effect/client";
import { Either } from "effect";

// Using Effect directly
const result = await runClientEffect(videoApiEffect.getVideos({ organizationId }));

Either.match(result, {
  onLeft: (error) => console.error(error),
  onRight: (data) => console.log(data),
});
```

### React Hooks

```typescript
import { useEffectQuery, useEffectMutation } from "@/hooks/use-effect";
import { videoApiEffect } from "@/lib/effect/client";

// Query hook
const { data, loading, error, refetch } = useEffectQuery(
  () => videoApiEffect.getVideos({ organizationId }),
  { deps: [organizationId] }
);

// Mutation hook
const { mutate, loading } = useEffectMutation(
  (data: CreateVideoInput) => videoApiEffect.createVideo(data)
);
```

## Best Practices

### 1. Use Tagged Errors

Always use `Data.TaggedError` for custom errors:

```typescript
class MyError extends Data.TaggedError("MyError")<{
  readonly message: string;
}> {}
```

### 2. Compose with gen

Use `Effect.gen` for readable, sequential code:

```typescript
const myEffect = Effect.gen(function* () {
  const serviceA = yield* ServiceA;
  const serviceB = yield* ServiceB;

  const resultA = yield* serviceA.doSomething();
  const resultB = yield* serviceB.doSomethingElse(resultA);

  return resultB;
});
```

### 3. Handle Errors Explicitly

Use `Effect.catchTag` or `Effect.catchAll` for error recovery:

```typescript
const withFallback = myEffect.pipe(
  Effect.catchTag("NotFoundError", () => Effect.succeed(null)),
  Effect.catchAll((error) => Effect.die(error))
);
```

### 4. Layer Composition

Compose layers from specific to general:

```typescript
const SpecificLayer = MyService.pipe(Layer.provide(DependencyLayer));
const FullLayer = Layer.mergeAll(SpecificLayer, OtherLayer);
```

### 5. Use GlobalValue for Stateful Services

For services with state (connections, caches), use `GlobalValue`:

```typescript
import GlobalValue from "effect/GlobalValue";

const myStatefulService = GlobalValue.globalValue("@app/service", () =>
  createService()
);
```

## Testing

### Mocking Services

```typescript
const MockVideoRepository = Layer.succeed(VideoRepository, {
  getVideos: () => Effect.succeed({ data: [], pagination: { ... } }),
  getVideo: () => Effect.succeed({ id: "1", title: "Test" }),
  // ...
});

const testEffect = myEffect.pipe(Effect.provide(MockVideoRepository));
```

### Testing Effects

```typescript
import { Effect, Exit } from "effect";

test("should fetch videos", async () => {
  const exit = await Effect.runPromiseExit(
    videoRepository.getVideos("org-1").pipe(Effect.provide(TestLayer))
  );

  expect(Exit.isSuccess(exit)).toBe(true);
});
```

## Migration Guide

### From Promise-based Code

Before:
```typescript
try {
  const result = await fetchSomething();
  return result;
} catch (error) {
  console.error(error);
  throw error;
}
```

After:
```typescript
const effect = Effect.tryPromise({
  try: () => fetchSomething(),
  catch: (error) => new MyError({ message: String(error) })
});
```

### From Class-based Services

Before:
```typescript
class MyService {
  async doSomething() { ... }
}
export const myService = new MyService();
```

After:
```typescript
class MyService extends Context.Tag("MyService")<MyService, MyServiceInterface>() {}

const makeMyService = Effect.gen(function* () {
  return {
    doSomething: () => Effect.tryPromise({ ... })
  };
});

export const MyServiceLive = Layer.effect(MyService, makeMyService);
```

## React Server Components

### Server-side Effect Utilities

The `server.ts` module provides utilities for using Effect in Server Components:

```typescript
import { getCachedVideos, getCachedOrganizationBySlug } from "@/lib/effect";

// Server Component
export default async function VideosPage({ params }) {
  const organization = await getCachedOrganizationBySlug(params.slug);
  const videos = await getCachedVideos(organization.id);

  return <VideoList videos={videos.data} />;
}
```

### Cached Queries

Queries are automatically cached using React's `cache` function for request-level deduplication:

```typescript
import { cache } from "react";
import { Effect } from "effect";
import { runServerEffect } from "@/lib/effect/server";
import { VideoRepository } from "@/lib/effect/services";

export const getVideos = cache(
  async (organizationId: string, page = 1, limit = 20) => {
    const effect = Effect.gen(function* () {
      const repo = yield* VideoRepository;
      return yield* repo.getVideos(organizationId, page, limit);
    });
    return runServerEffect(effect);
  }
);
```

### Revalidation

Use the revalidation helpers to invalidate cached data:

```typescript
import { revalidateVideos, revalidateVideo } from "@/lib/effect";

// After creating a video
await serverCreateVideo(data);
revalidateVideos(organizationId);

// After updating a specific video
await serverUpdateVideo(id, data);
revalidateVideo(id);
```

### Suspense Integration

Use Suspense boundaries with async Server Components for streaming:

```typescript
import { Suspense } from "react";

function LoadingSkeleton() {
  return <div className="animate-pulse bg-muted h-64 rounded-lg" />;
}

async function VideoList({ organizationId }: { organizationId: string }) {
  const videos = await getCachedVideos(organizationId);
  return <VideoGrid videos={videos.data} />;
}

export default async function Page({ params }) {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <VideoList organizationId={params.organizationId} />
    </Suspense>
  );
}
```

### Server Actions

Server actions use Effect for type-safe mutations:

```typescript
import { serverCreateVideo, serverUpdateVideo, serverDeleteVideo } from "@/lib/effect";

// In a client component
async function handleSubmit(formData: FormData) {
  const result = await serverCreateVideo({
    title: formData.get("title"),
    organizationId,
    // ...
  });

  if (result.success) {
    // Handle success
  } else {
    // Handle error
  }
}
```

### Data Flow Pattern

1. **Server Components** fetch data using cached Effect queries
2. **Client Components** receive data as props (no useEffect needed)
3. **Mutations** use server actions that revalidate caches
4. **Suspense** provides loading states and enables streaming

```
┌─────────────────────────────────────────────────────────────┐
│                     Server Component                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ const data = await getCachedVideos(orgId);          │   │
│  │ return <ClientComponent videos={data} />;           │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Client Component                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ // No useEffect needed - data comes via props        │   │
│  │ function VideoGrid({ videos }) {                     │   │
│  │   return videos.map(video => <VideoCard ... />);    │   │
│  │ }                                                    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ (on mutation)
┌─────────────────────────────────────────────────────────────┐
│                     Server Action                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ await serverCreateVideo(data);                       │   │
│  │ revalidateVideos(organizationId);                   │   │
│  │ // Cache is invalidated, components re-render       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## New Services (v2.0)

### AI Structured Service

The `AIStructured` service uses Effect Schema for guaranteed structured outputs from AI:

```typescript
import { AIStructured, VideoSummarySchema } from "@/lib/effect/services";

const summary = Effect.gen(function* () {
  const ai = yield* AIStructured;
  return yield* ai.generateVideoSummary(transcript);
});

// Returns typed VideoSummary with:
// - summary: string
// - keyPoints: string[]
// - actionItems: string[]
// - topics: string[]
// - sentiment: "positive" | "neutral" | "negative" | "mixed"
```

Available Effect Schemas:
- `VideoSummarySchema` - Video summary with key points
- `ActionItemsSchema` - Extracted action items with priorities
- `ChaptersSchema` - Video chapters with timestamps
- `CodeSnippetsSchema` - Detected code snippets with languages
- `VideoTagsSchema` - Generated tags and categories

### Recommendations Service

The `Recommendations` service provides personalized video recommendations:

```typescript
import { Recommendations, getContinueWatching, getTrending } from "@/lib/effect/services";

// Get personalized recommendations
const recommended = yield* Recommendations.pipe(
  Effect.flatMap((r) => r.getRecommendations(userId, orgId, { limit: 10 }))
);

// Get continue watching list
const continueWatching = yield* getContinueWatching(userId, orgId);

// Get trending videos
const trending = yield* getTrending(orgId, 10, "week");
```

Features:
- Personalized recommendations based on watch history
- Continue watching with progress tracking
- Trending videos with configurable timeframes
- Similar videos based on tags and content
- From favorite channels suggestions

### Presence Service

The `Presence` service tracks real-time user presence for collaboration:

```typescript
import { Presence, updatePresence, getVideoPresence } from "@/lib/effect/services";

// Update user presence
yield* updatePresence(userId, orgId, {
  videoId: "video-123",
  status: "online",
  currentTime: 120, // seconds
  metadata: { isTyping: true }
});

// Get users watching a video
const viewers = yield* getVideoPresence(videoId);
// Returns: { userId, userName, userImage, status, currentTime, lastSeen }[]
```

Features:
- Online/away/busy status tracking
- Video viewing position synchronization
- Typing indicators for comments
- Organization-wide presence
- Automatic stale presence cleanup

### Watch Later Service

The `WatchLaterService` manages user bookmarks:

```typescript
import { WatchLaterService, addToWatchLater, isInWatchLater } from "@/lib/effect/services";

// Add video to watch later
yield* addToWatchLater({
  userId,
  videoId,
  priority: 1,
  notes: "Review this for the meeting"
});

// Check if video is bookmarked
const isBookmarked = yield* isInWatchLater(userId, videoId);

// Get watch later list
const list = yield* getWatchLaterList(userId, orgId, "priority");
```

### Comment Reactions Service

The `CommentReactionsService` adds reactions to comments:

```typescript
import { CommentReactionsService, toggleReaction } from "@/lib/effect/services";

// Toggle a reaction
const { added } = yield* toggleReaction(commentId, userId, "like");

// Get reaction counts
const counts = yield* getReactionCounts(commentId);
// Returns: [{ reactionType: "like", count: 5 }, { reactionType: "love", count: 2 }]

// Get reactions for multiple comments (efficient batch query)
const reactionsMap = yield* getReactionsForComments(commentIds, userId);
```

Reaction Types: `like`, `love`, `laugh`, `surprised`, `sad`, `angry`, `thinking`, `celebrate`

### Performance Monitoring Service

The `PerformanceMonitoring` service tracks application metrics:

```typescript
import { PerformanceMonitoring, recordMetric } from "@/lib/effect/services";

// Record a metric
yield* recordMetric({
  organizationId,
  metricType: "video_load",
  metricName: "initial_load_time",
  value: 1234, // milliseconds
  videoId: "video-123"
});

// Get performance report
const report = yield* getPerformanceReport(orgId, startDate, endDate);
// Returns: { errorRate, avgVideoLoadTime, avgApiResponseTime, summary[] }
```

Metric Types:
- `video_load` - Video loading performance
- `video_buffer` - Buffering events
- `api_response` - API response times
- `upload_speed` - Upload performance
- `ai_processing` - AI processing times
- `error` - Error tracking

## Retry Utilities

The `retry.ts` module provides configurable retry strategies:

```typescript
import {
  withRetry,
  retryApiRequest,
  retryExternalService,
  apiRetryConfig,
  networkRetryConfig
} from "@/lib/effect/retry";

// Simple retry with exponential backoff
const result = withRetry(
  myEffect,
  { maxAttempts: 3, initialDelay: "500 millis", jitter: true }
);

// Preconfigured for API requests (3 attempts, 500ms-10s backoff)
const apiResult = retryApiRequest(apiEffect);

// For external services (4 attempts, 1s-60s backoff)
const externalResult = retryExternalService(externalEffect);

// With fallback value
const withFallback = withRetryOrDefault(myEffect, defaultValue);

// Filtered retry (only retry specific errors)
const filtered = withFilteredRetry(myEffect, (error) => isRetryableError(error));
```

## Related Documentation

- [Effect-TS Official Docs](https://effect.website/docs)
- [Effect-TS GitHub](https://github.com/Effect-TS/effect)
- [API Routes](./backend.md)
- [Database Schema](./database.md)
