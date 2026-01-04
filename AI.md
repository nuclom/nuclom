# Nuclom - Video Collaboration Platform

Use docs/ folder for documentation, make sure you look there for any guidance and always keep it up to date after making changes to the code.

## Commands

- `pnpm tsc` - TypeScript type checking
- `pnpm dev` - Start development server
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

Use react-hook-form with Effect Schema validation (preferred) or Zod:

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
import { z } from "zod"

const result = await generateObject({
  model: openai("gpt-4o"),
  schema: z.object({...}),
  prompt: "..."
})
```

## Database Schema

Key tables (see `src/lib/db/schema/`):
- `users` - User accounts
- `organizations` - Multi-tenant organizations
- `videos` - Video metadata and storage refs
- `comments` - Video comments with timestamps
- `comment_reactions` - Reactions to comments
- `watch_history` - User watch progress
- `watch_later` - Bookmarked videos
- `notifications` - User notifications

## Common Tasks

### Adding a New API Endpoint

1. Define the route in `src/lib/openapi/endpoints.ts`
2. Add route handler in `src/app/api/[...route]/route.ts`
3. Update types in `src/lib/types/` if needed
4. Add to API documentation in `docs/public/api/`

### Adding a New Database Table

1. Add schema in `src/lib/db/schema/[table].ts`
2. Export from `src/lib/db/schema/index.ts`
3. Run `pnpm db:generate` to create migration
4. Run `pnpm db:migrate` to apply
5. Update `docs/internal/architecture/database.md`

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
- `OPENAI_API_KEY` - For AI features
- OAuth provider keys

## Best Practices

### Do

- Run `pnpm tsc` before committing to catch type errors
- Run `pnpm lint` to check code quality
- Update documentation when changing APIs or features
- Use existing patterns - check similar code first
- Keep components focused and composable
- Use proper error boundaries for user-facing errors
- Test database queries locally before deploying

### Don't

- Don't disable TypeScript errors with `@ts-ignore`
- Don't use `any` types - use `unknown` and narrow
- Don't skip migrations - always generate and apply
- Don't hardcode secrets - use environment variables
- Don't commit console.log statements
- Don't bypass authentication in API routes

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

- **Architecture**: `docs/internal/architecture/`
- **API Reference**: `docs/public/api/`
- **User Guides**: `docs/public/guides/`
- **Development**: `docs/internal/reference/`
- **AI/LLM Instructions**: `docs/AGENTS.md`

Always update relevant documentation after making code changes.
