# Nuclom - Video Collaboration Platform

All documentation is in `content/docs/` and served via Mintlify. Always keep documentation up to date after making changes to the code.

## Commands

- `pnpm tsc` - TypeScript type checking
- `pnpm dev` - Start development server (uses Vercel CLI)
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run biome checker
- `pnpm format` - Run biome formatter
- `pnpm test` - Run unit tests (Vitest)
- `pnpm test:e2e` - Run end-to-end tests (Playwright)
- `pnpm db:generate` - Generate Drizzle migrations
- `pnpm db:migrate` - Run database migrations
- `pnpm db:push` - Push schema changes to database

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui
- **Backend**: Next.js API Routes with Effect-TS for error handling
- **Database**: PostgreSQL with Drizzle ORM (type-safe queries)
- **Auth**: better-auth with OAuth providers (GitHub, Google)
- **Storage**: Cloudflare R2 (S3-compatible)
- **AI**: OpenAI + Vercel AI SDK with structured outputs

## Project Structure

```
src/
├── app/                    # Next.js App Router pages and layouts
│   ├── (app)/             # Authenticated app routes
│   ├── (auth)/            # Authentication pages
│   ├── (marketing)/       # Public marketing pages
│   └── api/               # API route handlers
├── components/            # React components
│   ├── ui/               # shadcn/ui primitives
│   └── [feature]/        # Feature-specific components
├── lib/                   # Core utilities and services
│   ├── auth/             # Authentication configuration
│   ├── db/               # Database schema and queries
│   ├── effect/           # Effect-TS services and layers
│   │   ├── services/    # Repository and service implementations
│   │   ├── runtime.ts   # Application layer composition
│   │   └── server.ts    # Server-side Effect utilities
│   ├── api-handler.ts   # Standardized API route helpers
│   ├── api-errors.ts    # Error codes and response mapping
│   ├── validation/      # Effect Schema validation utilities
│   └── utils/            # Shared utilities
├── hooks/                # Custom React hooks
├── workflows/            # Background job workflows
└── middleware.ts         # Next.js middleware
```

## Code Patterns

### API Routes

API routes use Effect-TS with dependency injection layers for type-safe error handling. Use the standardized helpers from `@/lib/api-handler`:

```typescript
import { Effect } from "effect";
import type { NextRequest } from "next/server";
import { createFullLayer, handleEffectExit, handleEffectExitWithStatus } from "@/lib/api-handler";
import { Auth } from "@/lib/effect/services/auth";

export async function GET(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Use repository services for database operations
    const repo = yield* SomeRepository;
    return yield* repo.getData(user.id);
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit); // For GET requests
  // return handleEffectExitWithStatus(exit, 201); // For POST (201 Created)
}
```

**Key helpers:**
- `createFullLayer()` - Creates the full application layer with authentication
- `handleEffectExit(exit)` - Standard response handling for GET/PUT/DELETE
- `handleEffectExitWithStatus(exit, 201)` - For POST requests returning 201
- `mapErrorToApiResponse(error)` - Maps Effect errors to standardized API responses

> **Important**: Do NOT use `export const dynamic = "force-dynamic"` - this pattern no longer works on Vercel deployments. The Effect layer system handles database connections automatically.

### Database Queries

Use Drizzle ORM with the query builder pattern:

```typescript
import { db } from "@/lib/db"
import { videos, users } from "@/lib/db/schema"

// Query with relations
const video = await db.query.videos.findFirst({
  where: eq(videos.id, videoId),
  with: { user: true, comments: true }
})

// Insert/Update
await db.insert(videos).values({...})
await db.update(videos).set({...}).where(eq(videos.id, id))
```

### Component Structure

Components follow this pattern:
- UI primitives in `src/components/ui/` (shadcn/ui based)
- Feature components colocated with their routes
- Use `cn()` utility for conditional classNames
- Prefer Server Components, add `"use client"` only when needed

### Form Handling

Use react-hook-form with Effect Schema validation:

```typescript
import { useForm } from "react-hook-form"
import { Schema } from "effect"
import { validateRequestBody, validateQueryParams } from "@/lib/validation"

// Define schema with Effect Schema (recommended for API routes)
const createVideoSchema = Schema.Struct({
  title: Schema.String,
  description: Schema.optional(Schema.String),
  organizationId: Schema.String,
});

// In API routes, use validation helpers
const data = yield* validateRequestBody(createVideoSchema, request);
const params = yield* validateQueryParams(querySchema, request.url);
```

### AI Integration

AI features use Vercel AI SDK with structured outputs:

```typescript
import { generateObject } from "ai"
import { Schema } from "effect"

const result = await generateObject({
  model: openai("gpt-4o"),
  schema: Schema.standardSchemaV1(
    Schema.Struct({
      // ...
    })
  ),
  prompt: "..."
})
```

## Database Schema

Schema is organized in `src/lib/db/schema/` with domain-specific files:
- `auth.ts` - Better-auth managed tables (DO NOT EDIT directly)
- `user-extensions.ts` - App-specific user data (decoupled from auth)
- `videos.ts` - Video metadata and storage refs
- `comments.ts` - Video comments and reactions
- `notifications.ts` - User notifications
- `billing.ts` - Subscriptions and payments
- `clips.ts` - Video clips and highlights
- See `content/docs/internal/architecture/database.mdx` for full schema docs

**Important**: Store application user data in `userExtensions` table, not `users`. The `users` table is managed by better-auth.

## Common Tasks

### Adding a New API Endpoint

1. Create route handler in `src/app/api/[resource]/route.ts` (following Next.js App Router conventions)
2. Use Effect-TS pattern with `createFullLayer()` and `handleEffectExit()` helpers
3. Use repository services for database operations (e.g., `VideoRepository`, `OrganizationRepository`)
4. Update API route documentation (OpenAPI spec is auto-generated)

### Adding a New Database Table

1. Add table in the appropriate domain file in `src/lib/db/schema/`
2. Add relations in `src/lib/db/schema/relations.ts`
3. Run `pnpm db:generate` to create migration
4. Run `pnpm db:migrate` to apply
5. Update `content/docs/internal/architecture/database.mdx`

### Adding a New Component

1. Create in `src/components/[feature]/`
2. Use existing UI primitives from `src/components/ui/`
3. Follow existing patterns for props and styling
4. Add Storybook story if complex

### Adding a New Page

1. Create route in `src/app/(app)/[route]/page.tsx`
2. Add layout if needed: `layout.tsx`
3. Implement loading state: `loading.tsx`
4. Handle errors: `error.tsx`

## Testing

### Unit Tests (Vitest)
```bash
pnpm test              # Run all tests
pnpm test [pattern]    # Run matching tests
pnpm test:coverage     # Run with coverage
```

### E2E Tests (Playwright)
```bash
pnpm test:e2e          # Run e2e tests
pnpm test:e2e --ui     # Interactive mode
```

Test files:
- Unit tests: `*.test.ts` next to source files
- E2E tests: `src/test/e2e/`

## Environment Variables

Required variables (see `.env.example`):
- `DATABASE_URL` - PostgreSQL connection string
- `BETTER_AUTH_SECRET` - Auth encryption key
- `R2_*` - Cloudflare R2 credentials
- `REPLICATE_API_TOKEN` - For video transcription (Whisper)
- OAuth provider keys

## Effect-TS Patterns

This codebase uses Effect-TS for type-safe error handling and dependency injection. See `content/docs/internal/architecture/effect-best-practices.mdx` for comprehensive patterns.

### Core Principles

1. **Effects are lazy** - Creating an Effect doesn't execute it; use `Effect.runPromise` or runtime
2. **Three-channel model** - `Effect<Success, Error, Requirements>` tracks success, failure, and dependencies
3. **Use `Effect.gen`** - Write sequential async code that looks like async/await
4. **Separate program from error handling** - Define logic first, handle errors via `.pipe()`

### Service Pattern

```typescript
// Use Context.Tag for services
export class VideoRepository extends Context.Tag("VideoRepository")<
  VideoRepository,
  VideoRepositoryService
>() {}

// Use Effect.Service for simpler cases (requires object return type)
export class ApiService extends Effect.Service<ApiService>()(
  "ApiService",
  { effect: Effect.gen(function* () { return { ... }; }) }
) {}
```

### Error Handling

```typescript
// Always use Data.TaggedError
class NotFoundError extends Data.TaggedError("NotFoundError")<{
  readonly message: string;
  readonly entity: string;
}> {}

// Handle errors close to where they happen
const result = program.pipe(
  Effect.catchTag("NotFoundError", (e) => Effect.succeed(null)),
  Effect.catchTag("ValidationError", (e) => Effect.fail(new BadRequestError({ message: e.message }))),
);
```

### Common Footguns to Avoid

| Mistake | Solution |
|---------|----------|
| Executing effects mid-chain | Use `yield*` in `Effect.gen`, never `await Effect.runPromise()` inside |
| Forgetting layers | Always `Effect.provide(effect, layer)` before execution |
| Long flatMap chains | Use `Effect.gen` for readable sequential code |
| Direct DB access in routes | Use repository services (`VideoRepository`, `UserRepository`, etc.) |
| Resource leaks | Use `Effect.acquireRelease` or `Layer.scoped` for cleanup |
| Unbounded concurrency | Add `{ concurrency: N }` to `Effect.forEach` and similar |

### API Route Checklist

1. Use `Effect.gen` for business logic
2. Authenticate with `Auth` service
3. Use repository services (not direct `db` access)
4. Provide layer with `createFullLayer()` or `createPublicLayer()`
5. Handle exit with `handleEffectExit()` or `handleEffectExitWithStatus()`

## Best Practices

### Do

- Run `pnpm tsc` before committing to catch type errors
- Run `pnpm lint` to check code quality
- Update documentation when changing APIs or features
- Use existing patterns - check similar code first
- Keep components focused and composable
- Use proper error boundaries for user-facing errors
- Test database queries locally before deploying
- Use repository services instead of direct database access in API routes
- Use `Data.TaggedError` for all custom error types
- Handle errors close to where they occur with `catchTag`

### Don't

- Don't disable TypeScript errors with `@ts-ignore`
- Don't use `any` types - use `unknown` and narrow
- Don't skip migrations - always generate and apply
- Don't hardcode secrets - use environment variables
- Don't commit console.log statements
- Don't bypass authentication in API routes
- Don't use `await Effect.runPromise()` inside `Effect.gen` blocks
- Don't create effects without eventually executing them
- Don't access `db` directly in API routes - use repository services

## Performance Guidelines

**IMPORTANT**: Always follow the React and Next.js performance best practices documented in `.claude/skills/react-best-practices/SKILL.md`. These are based on Vercel Engineering guidelines and are critical for perceived speed.

### Perceived Speed Optimization (Critical)

1. **Eliminate Waterfalls** - Use `Promise.all()` for independent fetches, defer awaits until needed
2. **Optimize Bundle Size** - Use direct imports (not barrel files), dynamic imports for heavy components
3. **Strategic Suspense** - Show shell immediately, stream data with Suspense boundaries
4. **Preload on Intent** - Preload modules on hover/focus before user clicks

### Quick Performance Checklist

When writing React/Next.js code, always verify:

- [ ] **Independent fetches use `Promise.all()`** - Never sequential awaits for unrelated data
- [ ] **RSC components structured for parallel fetch** - Sibling components fetch in parallel
- [ ] **Direct imports (not barrel files)** - Import from specific paths, not index files
- [ ] **Dynamic imports for heavy components** - Code editors, charts, maps load on demand
- [ ] **Minimal props to client components** - Only pass fields actually used
- [ ] **`React.cache()` for request deduplication** - Wrap repeated server queries
- [ ] **`after()` for non-blocking operations** - Logging, analytics after response sent
- [ ] **SWR for client data fetching** - Automatic deduplication and caching
- [ ] **Functional setState updates** - Use `setState(prev => ...)` to prevent stale closures
- [ ] **Lazy state initialization** - Use `useState(() => expensive())` for computed defaults
- [ ] **`content-visibility: auto`** for long lists - Defer off-screen rendering
- [ ] **Immutable array methods** - Use `.toSorted()` not `.sort()` to prevent mutations

### Bundle Size Rules

```typescript
// WRONG: Barrel file import (loads entire library)
import { Button, Input } from '@/components/ui'
import { Check, X } from 'lucide-react'

// CORRECT: Direct imports
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Check from 'lucide-react/dist/esm/icons/check'
import X from 'lucide-react/dist/esm/icons/x'
```

### Data Fetching Patterns

```typescript
// WRONG: Sequential waterfall
async function Page() {
  const user = await getUser()
  const posts = await getPosts(user.id)
  const comments = await getComments()
  return <Content user={user} posts={posts} comments={comments} />
}

// CORRECT: Parallel fetching
async function Page() {
  const userPromise = getUser()
  const commentsPromise = getComments()
  const user = await userPromise
  const [posts, comments] = await Promise.all([
    getPosts(user.id),
    commentsPromise
  ])
  return <Content user={user} posts={posts} comments={comments} />
}

// BETTER: Component composition for RSC
function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <UserSection />
      <PostsSection />
      <CommentsSection />
    </Suspense>
  )
}
```

### Client Component Optimization

```typescript
// WRONG: Passing entire object
async function Page() {
  const user = await getUser() // 50 fields
  return <Profile user={user} />
}

// CORRECT: Pass only needed fields
async function Page() {
  const user = await getUser()
  return <Profile name={user.name} avatar={user.avatar} />
}
```

## Troubleshooting

### Common Issues

**Type errors after schema changes:**
```bash
pnpm db:generate  # Regenerate types
```

**Database connection issues:**
- Check `DATABASE_URL` format
- Ensure PostgreSQL is running
- Check connection pool limits

**Build failures:**
```bash
pnpm tsc          # Check for type errors first
pnpm lint         # Check for linting issues
```

**Auth not working:**
- Verify `BETTER_AUTH_SECRET` is set
- Check OAuth callback URLs in provider settings

## Documentation

All documentation is in `content/docs/`:

- **Architecture**: `internal/architecture/` - Database, Effect-TS, deployment, security
- **User Guides**: `guides/` - Getting started, collaboration, team management
- **Development Reference**: `internal/reference/` - Setup, testing, migrations
- **AI/LLM Instructions**: `AGENTS.md`

### Claude Skills (LLM Guidelines)

The following skills provide detailed guidelines for AI agents working on this codebase:

- **React Best Practices**: `.claude/skills/react-best-practices/SKILL.md` - Performance optimization for React/Next.js (40+ rules from Vercel Engineering)
- **Web Design Guidelines**: `.claude/skills/web-design-guidelines/SKILL.md` - UI review checklist (100+ rules for accessibility, UX, performance)
- **Effect-TS Patterns**: `.claude/skills/effect-ts-patterns/SKILL.md` - Effect-TS patterns specific to this codebase

**IMPORTANT**: LLMs and AI agents MUST follow these skills when:
- Writing new React components or pages
- Implementing data fetching (server or client)
- Reviewing or refactoring existing code
- Optimizing performance or bundle size
- Building accessible UI components

Always update relevant documentation after making code changes.
