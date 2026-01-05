# Effect-TS Best Practices

This document outlines Effect-TS best practices based on official documentation, [TypeOnce courses](https://www.typeonce.dev/), and [EffectPatterns](https://github.com/PaulJPhilp/EffectPatterns) community patterns.

## Core Principles

### 1. Effects Are Lazy Blueprints

An Effect is an immutable description of a computation that **executes only when explicitly run** by a runtime. This is fundamentally different from Promises which execute immediately.

```typescript
// This does NOT execute - it's just a blueprint
const effect = Effect.gen(function* () {
  const result = yield* someOperation();
  return result;
});

// This executes the effect
await Effect.runPromise(effect);
```

### 2. Three-Channel Model

Effects have three type parameters: `Effect<Success, Error, Requirements>`

| Channel | Purpose |
|---------|---------|
| Success (`A`) | The value returned on successful completion |
| Error (`E`) | The type of expected failures that can occur |
| Requirements (`R`) | The services/dependencies needed to run |

### 3. Composition Over Direct Execution

Use `.pipe()` to chain operations in readable, top-to-bottom sequences. Never execute effects in the middle of a chain.

```typescript
// Good: Compose effects
const result = program.pipe(
  Effect.flatMap(process),
  Effect.map(transform),
  Effect.catchTag("SomeError", handleError)
);

// Bad: Executing mid-chain breaks composition
const result = await Effect.runPromise(intermediate); // Don't do this
```

## Service Definition Patterns

### Using Context.Tag (Standard Pattern)

For services returning any value type including primitives:

```typescript
import { Context, Effect, Layer } from "effect";

// 1. Define the service interface
interface StorageService {
  readonly uploadFile: (buffer: Buffer, key: string) => Effect.Effect<UploadResult, UploadError>;
  readonly deleteFile: (key: string) => Effect.Effect<void, DeleteError>;
}

// 2. Create service tag
export class Storage extends Context.Tag("Storage")<Storage, StorageService>() {}

// 3. Create implementation
const makeStorageService = Effect.gen(function* () {
  // Dependencies can be accessed here
  const config = yield* Config.string("STORAGE_URL");

  return {
    uploadFile: (buffer, key) => Effect.tryPromise({...}),
    deleteFile: (key) => Effect.tryPromise({...}),
  } satisfies StorageService;
});

// 4. Create Layer
export const StorageLive = Layer.scoped(Storage, makeStorageService);
```

### Using Effect.Service (Simplified Pattern)

For services returning objects, `Effect.Service` combines service definition and layer in one class:

```typescript
import { Effect, Layer } from "effect";

export class ApiService extends Effect.Service<ApiService>()(
  "ApiService",
  {
    effect: Effect.gen(function* () {
      const baseUrl = yield* Config.string("API_URL");

      return {
        getPosts: Effect.tryPromise({
          try: () => fetch(`${baseUrl}/posts`).then(r => r.json()),
          catch: () => new FetchError(),
        }),
        getPost: (id: string) => Effect.tryPromise({
          try: () => fetch(`${baseUrl}/posts/${id}`).then(r => r.json()),
          catch: () => new FetchError(),
        }),
      };
    }),
    dependencies: [ConfigLive], // Optional: specify dependencies
  }
) {}

// Usage: ApiService.Default provides the complete layer with dependencies
const MainLayer = Layer.mergeAll(ApiService.Default);
```

For simple non-Effect values, use `succeed`:

```typescript
export class AppConfig extends Effect.Service<AppConfig>()(
  "AppConfig",
  {
    succeed: {
      apiUrl: "https://api.example.com",
      timeout: 5000,
    },
  }
) {}
```

**Note**: `Effect.Service` requires object types. For primitives like strings, use `Context.Tag`.

## Layer Composition Patterns

### Independent Layers (Use Layer.mergeAll)

For layers with no dependencies on each other:

```typescript
const BaseServicesLive = Layer.mergeAll(
  DatabaseLive,
  StorageLive,
  AILive,
  StripeLive,
);
```

### Dependent Layers (Use Layer.provide)

When a layer depends on another:

```typescript
// VideoProcessor depends on Storage
const VideoProcessorWithDeps = VideoProcessorLive.pipe(
  Layer.provide(StorageLive)
);

// Repository depends on Database and Storage
const VideoRepositoryWithDeps = VideoRepositoryLive.pipe(
  Layer.provide(Layer.mergeAll(DatabaseLive, StorageLive))
);
```

### Provide Dependencies Inside the Layer

Best practice: Provide each layer's dependencies directly within that layer's definition:

```typescript
// In video-processor.ts
export const VideoProcessorLive = Layer.effect(
  VideoProcessor,
  Effect.gen(function* () {
    const storage = yield* Storage; // Will be provided
    return { processVideo: ... };
  })
).pipe(Layer.provide(StorageLive)); // Dependencies provided here
```

This creates self-contained layers that don't require external dependency management.

### Full Application Layer

```typescript
export const AppLive = Layer.mergeAll(
  BaseServicesLive,
  AppServicesLive, // Layers with their dependencies resolved
);
```

## Error Handling Patterns

### Use Data.TaggedError for All Errors

Always extend `Data.TaggedError` for custom errors:

```typescript
import { Data } from "effect";

export class NotFoundError extends Data.TaggedError("NotFoundError")<{
  readonly message: string;
  readonly entity: string;
  readonly id?: string;
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string;
  readonly field?: string;
  readonly errors?: Array<{ path: string; message: string }>;
}> {}
```

Benefits over plain interfaces:
- Automatically includes `_tag` property
- Collects stack traces
- Integrates with `catchTag`/`catchTags`
- Provides better debugging information

### Separate Program Definition from Error Handling

Keep business logic separate from error recovery:

```typescript
// Program definition - clean business logic
const program = Effect.gen(function* () {
  const video = yield* videoRepo.getVideo(id);
  const processed = yield* processor.process(video);
  return processed;
});

// Error handling - applied separately via pipe
const main = program.pipe(
  Effect.catchTag("NotFoundError", (error) =>
    Effect.succeed({ notFound: true, message: error.message })
  ),
  Effect.catchTag("ProcessingError", (error) =>
    Effect.fail(new UserFacingError({ message: "Video processing failed" }))
  )
);
```

### Handle Errors Close to Where They Happen

From the TypeOnce course: "It's recommended that you handle most of the library-supplied failure types very close to where they happen."

```typescript
// Handle specific library errors immediately
const fetchData = httpClient.get("/data").pipe(
  Effect.catchTag("RequestError", (error) =>
    Effect.fail(new NetworkError({ message: "Failed to fetch data", cause: error }))
  ),
  Effect.catchTag("ParseError", (error) =>
    Effect.fail(new DataFormatError({ message: "Invalid response format" }))
  )
);
```

### Use catchTags for Multiple Error Types

```typescript
const result = program.pipe(
  Effect.catchTags({
    NotFoundError: (e) => Effect.succeed(null),
    ValidationError: (e) => Effect.fail(new BadRequestError({ message: e.message })),
    DatabaseError: (e) => Effect.die(e), // Convert to defect
  })
);
```

### Expected Errors vs Defects

| Type | Description | Tracking | Recovery |
|------|-------------|----------|----------|
| Expected Errors | Anticipated failures (network, validation) | Type-level in `E` | Use `catchTag`/`catchTags` |
| Defects | Unexpected failures (crashes, bugs) | Runtime-level in `Cause` | Use `catchAllCause` |

```typescript
// Access defects through Exit and Cause
const exit = await Effect.runPromiseExit(program);

Exit.match(exit, {
  onFailure: (cause) => {
    const failure = Cause.failureOption(cause); // Expected errors
    const defect = Cause.dieOption(cause);       // Unexpected defects
  },
  onSuccess: (data) => data,
});
```

## Runtime Patterns

### Use ManagedRuntime for Production

ManagedRuntime embeds layer configuration, eliminating manual `Effect.provide()` calls:

```typescript
import { ManagedRuntime, Layer } from "effect";
import { globalValue } from "effect/GlobalValue";

// Create runtime with all layers
export const AppRuntime = globalValue("@app/runtime", () =>
  ManagedRuntime.make(AppLive)
);

// Execute effects directly
await AppRuntime.runPromise(myEffect);

// No need for manual layer provision
// Before: Effect.provide(effect, AppLive)
// After: Just run it
```

### Separate Server and Client Runtimes

For React 19/Next.js applications, maintain distinct runtimes:

```typescript
// RuntimeServer.ts
const ServerLayer = Layer.mergeAll(DatabaseLive, AuthLive, StorageLive);
export const ServerRuntime = ManagedRuntime.make(ServerLayer);

// RuntimeClient.ts
const ClientLayer = Layer.mergeAll(GeolocationLive, FormDataLive);
export const ClientRuntime = ManagedRuntime.make(ClientLayer);
```

This provides compile-time guarantees that server-only code cannot run on the client.

## API Route Patterns

### Standard API Route Handler

```typescript
import { Effect } from "effect";
import type { NextRequest } from "next/server";
import { createFullLayer, handleEffectExit } from "@/lib/api-handler";
import { Auth } from "@/lib/effect/services/auth";
import { VideoRepository } from "@/lib/effect/services/video-repository";

export async function GET(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // 1. Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // 2. Use repository services
    const videoRepo = yield* VideoRepository;
    return yield* videoRepo.getVideos(user.organizationId);
  });

  // 3. Execute with layer and handle exit
  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
```

### POST with Custom Status Code

```typescript
export async function POST(request: NextRequest) {
  const effect = Effect.gen(function* () {
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const data = yield* validateRequestBody(createVideoSchema, request);
    const videoRepo = yield* VideoRepository;
    return yield* videoRepo.createVideo({ ...data, userId: user.id });
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExitWithStatus(exit, 201); // 201 Created
}
```

## Schema Patterns

### Define Schemas with Schema.Class

```typescript
import { Schema } from "effect";

export class Video extends Schema.Class<Video>("Video")({
  id: Schema.String,
  title: Schema.String,
  description: Schema.optional(Schema.String),
  duration: Schema.Number,
  status: Schema.Literal("draft", "published", "archived"),
}) {
  // Add static helpers for convenience
  static readonly Array = Schema.Array(this);
}

// Use in API routes
const data = yield* validateRequestBody(Video, request);
```

### Validate API Responses

```typescript
const fetchPost = (id: string) =>
  client.get(`/posts/${id}`).pipe(
    Effect.flatMap(HttpClientResponse.schemaBodyJson(Post)),
    Effect.scoped
  );
```

## Common Footguns to Avoid

### 1. Forgetting Effects Are Lazy

```typescript
// BAD: Effect is created but never executed
const effect = Effect.log("Hello");
// Nothing happens!

// GOOD: Execute the effect
await Effect.runPromise(effect);
```

### 2. Executing Effects Inside Effect.gen

```typescript
// BAD: Mixing execution contexts
const program = Effect.gen(function* () {
  const result = await Effect.runPromise(someEffect); // DON'T DO THIS
});

// GOOD: Use yield*
const program = Effect.gen(function* () {
  const result = yield* someEffect;
});
```

### 3. Long andThen/flatMap Chains

```typescript
// BAD: Hard to read and maintain
const program = effect1.pipe(
  Effect.flatMap((a) => effect2(a).pipe(
    Effect.flatMap((b) => effect3(b).pipe(
      Effect.flatMap((c) => effect4(c))
    ))
  ))
);

// GOOD: Use Effect.gen
const program = Effect.gen(function* () {
  const a = yield* effect1;
  const b = yield* effect2(a);
  const c = yield* effect3(b);
  return yield* effect4(c);
});
```

### 4. Forgetting to Provide Required Layers

```typescript
// BAD: Type error at runtime
const program = Effect.gen(function* () {
  const db = yield* Database;
  // ...
});
await Effect.runPromise(program); // Missing Database!

// GOOD: Always provide layers before execution
const runnable = Effect.provide(program, DatabaseLive);
await Effect.runPromise(runnable);
```

### 5. Resource Leaks

```typescript
// BAD: Connection never closed
const db = await Effect.runPromise(createConnection());
// ...

// GOOD: Use acquireRelease or Layer.scoped
const withConnection = Effect.acquireRelease(
  createConnection(),
  (conn) => Effect.sync(() => conn.close())
);
```

### 6. Unbounded Concurrency

```typescript
// BAD: Can overwhelm resources
await Effect.forEach(items, processItem);

// GOOD: Limit concurrency
await Effect.forEach(items, processItem, { concurrency: 10 });
```

### 7. Race Conditions on Shared State

```typescript
// BAD: Direct mutation
let counter = 0;
await Effect.forEach(items, () => {
  counter++; // Race condition!
});

// GOOD: Use Ref for atomic updates
const counter = yield* Ref.make(0);
await Effect.forEach(items, () =>
  Ref.update(counter, (n) => n + 1)
);
```

## Import Patterns

### Use Namespace Imports for Tree Shaking

```typescript
// GOOD: Tree-shakeable
import { Effect, Layer, Context } from "effect";
import * as Schema from "effect/Schema";

// Also acceptable in application code
import { Effect } from "effect";
```

### Use Functions Over Methods

Functions are tree-shakeable and more composable:

```typescript
// Prefer function-based composition
Effect.flatMap(effect, transform);

// Over method chaining
effect.flatMap(transform);
```

## Testing Patterns

### Mock Services with Layer.succeed

```typescript
const MockVideoRepository = Layer.succeed(VideoRepository, {
  getVideos: () => Effect.succeed({ data: [], pagination: { total: 0 } }),
  getVideo: () => Effect.succeed({ id: "1", title: "Test" }),
  createVideo: (data) => Effect.succeed({ id: "new", ...data }),
});

const testEffect = myEffect.pipe(Effect.provide(MockVideoRepository));
```

### Test with Effect.runPromiseExit

```typescript
import { Effect, Exit } from "effect";

test("should fetch videos", async () => {
  const exit = await Effect.runPromiseExit(
    videoRepo.getVideos("org-1").pipe(Effect.provide(TestLayer))
  );

  expect(Exit.isSuccess(exit)).toBe(true);
});
```

## Pragmatic Exceptions

While the patterns above are recommended, some situations warrant exceptions:

### When Direct `db` Access is Acceptable

| Scenario | Reason |
|----------|--------|
| Health check endpoints | Simple connectivity tests, minimal overhead |
| Webhook idempotency checks | Quick lookups before processing |
| One-off admin/migration scripts | Temporary code, not worth repository method |
| Complex raw SQL queries | Performance-critical, hard to abstract |

**Note**: Even when using direct `db`, wrap in `Effect.tryPromise` with proper error types.

### When Manual `Exit.match` is Acceptable

| Scenario | Reason |
|----------|--------|
| Custom cache headers | `handleEffectExit` doesn't support headers |
| Custom HTTP status codes | Beyond standard error mapping |
| Streaming responses | Different response construction |
| Webhook responses | External systems expect specific formats |

**Example with custom headers**:
```typescript
return Exit.match(exit, {
  onFailure: (cause) => mapErrorToApiResponse(Cause.failureOption(cause).value),
  onSuccess: (data) =>
    NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=60" },
    }),
});
```

### When `try/catch` is Acceptable

| Scenario | Reason |
|----------|--------|
| External OAuth callbacks | Must return redirects, specific formats |
| Integration webhooks | External systems expect specific responses |
| Simple health probes | Minimal overhead, reliability critical |

**However**: New API routes should default to Effect patterns unless there's a specific reason not to.

## Migration Strategy

When migrating existing code to Effect patterns, follow this priority order:

1. User-facing APIs with direct `db` access
2. APIs with complex error scenarios
3. Internal/admin APIs
4. Health checks and webhooks (lowest priority)

**Migration steps:**
1. Identify direct `db` access and wrap in repository service
2. Replace `try/catch` with `Effect.tryPromise` and tagged errors
3. Use `Effect.gen` for sequential operations
4. Add proper layer composition with `createFullLayer()`
5. Use `handleEffectExit()` for consistent response handling

## Related Resources

- [Effect Official Documentation](https://effect.website/docs)
- [TypeOnce Effect Beginners Course](https://www.typeonce.dev/course/effect-beginners-complete-getting-started)
- [TypeOnce Effect + React 19 Course](https://www.typeonce.dev/course/effect-react-19-project-template)
- [EffectPatterns Repository](https://github.com/PaulJPhilp/EffectPatterns)
- [Effect-TS Architecture Documentation](./effect-ts.md)
