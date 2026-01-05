# Effect-TS Migration Guide

This document tracks Effect-TS pattern violations in the codebase and provides guidance for migrating to best practices.

## Current State Summary

| Issue | Count | Priority |
|-------|-------|----------|
| Direct `db` import in API routes | ~50 files | Medium |
| Manual `Exit.match` instead of `handleEffectExit` | ~46 files | Low |
| `try/catch` instead of Effect | ~45 files | Medium |
| `Cause.failureOption` manual handling | ~45 files | Low |
| `Effect.runPromise` instead of `runPromiseExit` | ~25 files | Medium |
| Plain class errors (not `Data.TaggedError`) | ~3 files | High |
| Direct `auth.api.getSession()` instead of Auth service | ~10 files | Medium |

## Issue Categories

### 1. Direct Database Access (Medium Priority)

**Problem**: Routes import `db` directly instead of using repository services.

**Files affected**: ~50 API routes

**Examples**:
```typescript
// BAD: Direct db import
import { db } from "@/lib/db";

const data = yield* Effect.tryPromise({
  try: () => db.query.videos.findFirst({...}),
  catch: (error) => new DatabaseError({...}),
});

// GOOD: Use repository service
const videoRepo = yield* VideoRepository;
const data = yield* videoRepo.getVideo(videoId);
```

**When direct `db` access is acceptable**:
- Health check endpoints (`/api/health/*`) - simple connectivity tests
- Webhook handlers - idempotency checks and event logging
- One-off admin operations

**Migration steps**:
1. Identify if a repository service already exists for the entity
2. If not, create a new method in the appropriate repository
3. Replace direct `db` calls with repository service calls
4. Run `pnpm tsc` to catch any type issues

### 2. Manual Exit.match (Low Priority)

**Problem**: Routes use `Exit.match` with `Cause.failureOption` instead of `handleEffectExit`.

**Files affected**: ~46 API routes

**Examples**:
```typescript
// BAD: Manual Exit handling
return Exit.match(exit, {
  onFailure: (cause) => {
    const error = Cause.failureOption(cause);
    if (error._tag === "Some") {
      return mapErrorToApiResponse(error.value);
    }
    return mapErrorToApiResponse(new Error("Internal server error"));
  },
  onSuccess: (data) => NextResponse.json(data),
});

// GOOD: Use helper
return handleEffectExit(exit);
```

**When manual `Exit.match` is acceptable**:
- Custom response headers (e.g., `Cache-Control`)
- Custom HTTP status codes not covered by error mapping
- Streaming responses

**Migration steps**:
1. Replace `Exit.match` + `Cause.failureOption` pattern with `handleEffectExit`
2. For POST/PUT with 201/204, use `handleEffectExitWithStatus(exit, 201)`
3. If custom headers needed, consider extending `handleEffectExit` or use manual pattern

### 3. Try/Catch Instead of Effect (Medium Priority)

**Problem**: Routes use traditional `try/catch` blocks instead of Effect patterns.

**Files affected**: ~45 API routes (mostly health checks, integrations)

**Examples**:
```typescript
// BAD: try/catch pattern
export async function GET() {
  try {
    const data = await db.execute(sql`SELECT 1`);
    return Response.json({ status: "healthy" });
  } catch (error) {
    return Response.json({ status: "unhealthy" }, { status: 503 });
  }
}

// GOOD: Effect pattern
export async function GET() {
  const effect = Effect.gen(function* () {
    const { db } = yield* Database;
    yield* Effect.tryPromise({
      try: () => db.execute(sql`SELECT 1`),
      catch: (error) => error,
    });
    return { status: "healthy" };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
```

**When try/catch is acceptable**:
- External webhook handlers that must return specific formats
- Integration callbacks (OAuth, etc.)
- Simple health probes where Effect overhead is undesirable

**Migration steps**:
1. Wrap logic in `Effect.gen(function* () {...})`
2. Replace `await` with `yield* Effect.tryPromise` or `yield* Effect.promise`
3. Add layer provision and exit handling
4. Replace catch blocks with Effect error handling

### 4. Effect.runPromise vs runPromiseExit (Medium Priority)

**Problem**: Using `Effect.runPromise` loses error type information and throws exceptions.

**Files affected**: ~25 API routes

**Examples**:
```typescript
// BAD: Effect.runPromise loses error information
try {
  const result = await Effect.runPromise(Effect.provide(effect, layer));
  return NextResponse.json(result);
} catch (err) {
  return NextResponse.json({ error: "Failed" }, { status: 500 });
}

// GOOD: Effect.runPromiseExit preserves error information
const exit = await Effect.runPromiseExit(Effect.provide(effect, layer));
return handleEffectExit(exit);
```

**Migration steps**:
1. Replace `Effect.runPromise` with `Effect.runPromiseExit`
2. Remove surrounding try/catch
3. Use `handleEffectExit` or `Exit.match` to handle the exit

### 5. Plain Class Errors (High Priority)

**Problem**: Using plain class errors instead of `Data.TaggedError` loses stack traces and Effect integration.

**Files affected**:
- ~~`/api/insights/export/route.ts`~~ ✅ Fixed
- ~~`/lib/effect/services/email-notifications.ts`~~ ✅ Fixed
- `/lib/api.ts` (acceptable - client-side backwards compatibility)

**Examples**:
```typescript
// BAD: Plain class error
class DatabaseError {
  readonly _tag = "DatabaseError";
  constructor(readonly message: string) {}
}

// GOOD: Data.TaggedError
export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly message: string;
  readonly operation?: string;
  readonly cause?: unknown;
}> {}
```

**Benefits of Data.TaggedError**:
- Automatically collects stack traces
- Works with `catchTag`/`catchTags`
- Integrates with Effect's error handling
- Provides better debugging information

### 6. Direct Auth Calls (Medium Priority)

**Problem**: Calling `auth.api.getSession()` directly instead of using the Auth service.

**Files affected**: ~10 API routes

**Examples**:
```typescript
// BAD: Direct auth call outside Effect
const session = await auth.api.getSession({ headers: request.headers });
if (!session?.user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// GOOD: Auth service inside Effect
const effect = Effect.gen(function* () {
  const authService = yield* Auth;
  const { user } = yield* authService.getSession(request.headers);
  // user is now available
});
```

**Benefits of Auth service**:
- Consistent error handling with `UnauthorizedError`
- Type-safe session data
- Works with Effect's dependency injection
- Testable with mock layers

## Priority Files to Migrate

### High Priority (User-Facing APIs)

1. `/api/insights/topics/route.ts` - Direct db, manual Exit.match
2. `/api/insights/overview/route.ts` - Direct db, manual Exit.match
3. `/api/insights/keywords/route.ts` - Direct db, manual Exit.match
4. `/api/insights/effectiveness/route.ts` - Direct db, manual Exit.match
5. `/api/organizations/[id]/analytics/route.ts` - Direct db, manual Exit.match

### Medium Priority (Admin/Internal APIs)

1. `/api/status/route.ts` - try/catch, direct db
2. `/api/health/db/route.ts` - try/catch, direct db
3. `/api/health/ai/route.ts` - try/catch
4. `/api/health/r2/route.ts` - try/catch

### Lower Priority (Already Functional)

- Webhook handlers - Working, complex migration
- Integration callbacks - OAuth flows, complex dependencies

## New Route Checklist

When creating new API routes, follow this checklist:

- [ ] Use `Effect.gen(function* () {...})` for all business logic
- [ ] Authenticate using `const authService = yield* Auth`
- [ ] Use repository services instead of direct `db` access
- [ ] Validate input with `validateRequestBody` or `validateQueryParams`
- [ ] Provide layer with `createFullLayer()` or `createPublicLayer()`
- [ ] Handle exit with `handleEffectExit()` or `handleEffectExitWithStatus()`
- [ ] Use `Data.TaggedError` for custom errors
- [ ] Handle errors close to where they occur with `catchTag`

## Creating Repository Methods

If you need database access that doesn't exist in a repository:

1. Find the appropriate repository in `src/lib/effect/services/`
2. Add a new method to the service interface
3. Implement the method using `Effect.tryPromise`
4. Use proper error types (`DatabaseError`, `NotFoundError`, etc.)

Example:
```typescript
// In video-repository.ts

// Add to interface
interface VideoRepositoryService {
  getVideosByTopic: (topicId: string) => Effect.Effect<Video[], DatabaseError>;
}

// Implement
const makeVideoRepository = Effect.gen(function* () {
  const { db } = yield* Database;

  return {
    getVideosByTopic: (topicId: string) =>
      Effect.tryPromise({
        try: () =>
          db.query.videos.findMany({
            where: eq(videos.topicId, topicId),
          }),
        catch: (error) =>
          new DatabaseError({
            message: "Failed to fetch videos by topic",
            operation: "getVideosByTopic",
            cause: error,
          }),
      }),
  };
});
```

## Tracking Progress

Update this document as migrations are completed:

### Recently Completed ✅

- [x] `/api/health/route.ts` - Converted to Effect pattern
- [x] `/api/status/route.ts` - Converted to Effect pattern with Database service
- [x] `/api/videos/[id]/process/route.ts` - Now uses VideoRepository and handleEffectExit
- [x] `/api/activity/route.ts` - Now uses Auth service and handleEffectExit
- [x] `/api/insights/export/route.ts` - Now uses Data.TaggedError and Database service
- [x] `/lib/effect/services/email-notifications.ts` - EmailError now extends Data.TaggedError

### Pending Migrations

- [ ] `/api/insights/topics/route.ts`
- [ ] `/api/insights/overview/route.ts`
- [ ] `/api/insights/keywords/route.ts`
- [ ] `/api/insights/effectiveness/route.ts`
- [ ] `/api/insights/patterns/route.ts`
- [ ] `/api/insights/summary/route.ts`
- [ ] (Add more as identified)
