# AI/LLM Coding Agent Instructions

**IMPORTANT**: These instructions are mandatory. Follow them exactly.

This file contains instructions for AI/LLM systems when working with the Nuclom codebase. See also:
- `CLAUDE.md` (root) - Quick reference for commands and project structure
- `AI.md` (root) - Detailed coding guidelines and patterns

## Core Principles (Always Follow)

1. **Read before writing** - ALWAYS read existing code and documentation before making changes
2. **Match existing patterns** - Follow conventions already in the codebase
3. **Verify with tools** - Run `pnpm tsc` and `pnpm lint` before finishing every task
4. **Update documentation** - Keep docs in sync with code changes

## Code Quality Mandate (Non-Negotiable)

These rules apply to EVERY task. Do not skip them.

### 1. Fix All Errors
- Fix ANY errors you encounter—whether they're part of your task or preexisting
- Do not leave broken code behind under any circumstances
- If you see type errors, lint errors, or failing tests in files you touch, fix them immediately
- Do not say "this error was preexisting" as an excuse—fix it anyway

### 2. No Backwards Compatibility
- Do NOT try to maintain backwards compatibility
- Do NOT avoid breaking changes
- Refactor freely, rename boldly, restructure as needed
- Delete deprecated code paths entirely—do not keep them "just in case"
- The goal is clean, correct code—not preserving legacy interfaces

### 3. Delete Dead Code
- ALWAYS perform a final cleanup pass after completing your main task
- Remove: unused imports, dead code paths, commented-out code, deprecated functions, old implementations
- If something is unused, delete it completely
- Never leave: `// TODO: remove` comments, `_unused` variable prefixes, re-exports for backwards compatibility

### 4. Simplify and DRY
- Actively look for opportunities to simplify
- Consolidate duplicate logic into reusable functions
- If you see three similar code blocks, extract a common abstraction
- Reduce complexity wherever possible
- Less code is better than more code

### 5. Use Modern Libraries
- Prefer state-of-the-art, well-maintained libraries over custom code
- Do NOT write glue code or boilerplate that a library handles better
- Do NOT reinvent wheels
- Keep dependencies current
- If a library exists for the task, use it

## Quick Start Workflow

```bash
# 1. Understand the codebase structure
# Read CLAUDE.md and relevant docs

# 2. Make changes following existing patterns

# 3. Verify changes
pnpm tsc           # Type check
pnpm lint          # Code quality
pnpm test          # Run tests
pnpm build         # Verify build

# 4. Update documentation if needed
```

## Codebase Navigation

### Where to Find Things

| Need | Location | Notes |
|------|----------|-------|
| Database schema | `packages/lib/src/db/schema/` | Drizzle ORM definitions |
| Effect services | `packages/lib/src/effect/services/` | Repository and service implementations |
| API handler helpers | `packages/lib/src/api-handler.ts` | Effect-TS API route utilities |
| Shared UI components | `packages/ui/` | shadcn/ui based components |
| Auth utilities | `packages/auth/` | Shared authentication code |
| App routes | `apps/saas/src/app/` | Next.js App Router pages |
| Feature components | `apps/saas/src/components/` | App-specific React components |
| Custom hooks | `apps/saas/src/hooks/` | React hooks |
| App utilities | `apps/saas/src/lib/` | App-specific utilities |
| Tests | `*.test.ts` next to source | Vitest unit tests |
| E2E tests | `apps/saas/src/test/e2e/` | Playwright tests |

### Key Architectural Decisions

1. **Next.js 16 App Router** - Use Server Components by default
2. **Drizzle ORM** - Type-safe database queries
3. **better-auth** - Authentication with OAuth support
4. **Effect-TS** - Error handling in API routes
5. **Effect Schema** - Schema validation
6. **shadcn/ui** - UI component library

## Code Modification Guidelines

### Before Making Changes

1. Read the file(s) you're about to modify
2. Check related files that might need updates
3. Look for existing patterns to follow
4. Understand the data flow

### During Development

1. Use TypeScript properly - no `any` types
2. Follow component patterns in `packages/ui/` for shared components
3. Use Effect-TS patterns for API error handling
4. Validate inputs with Effect Schema

### After Making Changes

1. Run `pnpm tsc` - catch type errors
2. Run `pnpm lint` - check code quality
3. Run `pnpm test` - verify tests pass
4. Update documentation if APIs changed

## Documentation Standards

### When to Update Documentation

Update docs when you:
- Add new API endpoints
- Change existing API behavior
- Add new database tables or columns
- Create new components with public APIs
- Change environment variables
- Modify authentication flows

### Documentation Locations

All documentation is in `content/docs/`:

| Type | Location |
|------|----------|
| API reference | Auto-generated from OpenAPI spec |
| User guides | `guides/` |
| Architecture | `internal/architecture/` |
| Dev reference | `internal/reference/` |
| Database schema | `internal/architecture/database.mdx` |

### Documentation Format

```markdown
# Feature Name

Brief description.

## Overview
What it does and why.

## Usage

\`\`\`typescript
// Code example
\`\`\`

## API Reference
Parameters, return values, errors.

## Examples
Real-world usage examples.
```

## API Development

### Creating New Endpoints

1. Create route handler in `apps/saas/src/app/(api)/api/[resource]/route.ts`
2. Use Effect-TS pattern with repository services:

```typescript
import { Effect } from "effect";
import type { NextRequest } from "next/server";
import { Auth, handleEffectExitWithOptions, runApiEffect } from "@nuclom/lib/api-handler";
import { VideoRepository } from "@nuclom/lib/effect";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const { id } = yield* Effect.promise(() => params);
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);
    const videoRepo = yield* VideoRepository;
    return yield* videoRepo.getVideo(id);
  });

  const exit = await runApiEffect(effect);
  return handleEffectExitWithOptions(exit);
}
```

3. Always authenticate with `Auth` service
4. Always use repository services (not direct `db` access)

### Error Handling Pattern

```typescript
import { Effect } from "effect"

// Wrap async operations
const result = await Effect.runPromise(
  Effect.tryPromise({
    try: () => db.query.items.findFirst({ where: eq(items.id, id) }),
    catch: (error) => new DatabaseError("Failed to fetch item", { cause: error })
  })
)

// Return proper HTTP status codes
if (!result) {
  return Response.json({ error: "Not found" }, { status: 404 })
}
```

## Database Operations

### Schema Changes

1. Modify schema in `packages/lib/src/db/schema/[table].ts`
2. Export from `packages/lib/src/db/schema/index.ts`
3. Generate migration: `pnpm db:generate`
4. Apply migration: `pnpm db:migrate`
5. Update `content/docs/internal/architecture/database.mdx`

### Query Patterns

```typescript
// Simple query
const item = await db.query.items.findFirst({
  where: eq(items.id, itemId)
})

// With relations
const itemWithRelations = await db.query.items.findFirst({
  where: eq(items.id, itemId),
  with: { user: true, comments: { with: { author: true } } }
})

// Transactions
await db.transaction(async (tx) => {
  await tx.insert(items).values({ ... })
  await tx.update(users).set({ ... }).where(eq(users.id, userId))
})
```

## Component Development

### Component Structure

```typescript
// Server Component (default)
export default async function Component({ id }: { id: string }) {
  const data = await fetchData(id)
  return <div>{data.name}</div>
}

// Client Component (when interactivity needed)
"use client"
export function InteractiveComponent() {
  const [state, setState] = useState(...)
  return <button onClick={() => setState(...)}>Click</button>
}
```

### Styling

```typescript
import { cn } from "@ui/lib/utils"

// Use cn() for conditional classes
<div className={cn(
  "base-classes",
  isActive && "active-classes",
  variant === "primary" && "primary-variant"
)}>
```

## Testing

### Unit Tests

```typescript
import { describe, it, expect } from "vitest"

describe("functionName", () => {
  it("should handle normal case", () => {
    expect(functionName("input")).toBe("expected")
  })

  it("should handle edge case", () => {
    expect(() => functionName(null)).toThrow()
  })
})
```

### E2E Tests

```typescript
import { test, expect } from "@playwright/test"

test("user flow", async ({ page }) => {
  await page.goto("/path")
  await page.click("button")
  await expect(page.locator("result")).toBeVisible()
})
```

## NEVER Do These Things

These are explicit prohibitions. Violating any of these is a failure.

| Never Do This | Do This Instead |
|---------------|-----------------|
| Use `any` type | Use proper types or `unknown` with type guards |
| Skip running `pnpm tsc` | Run it after every change |
| Disable lint rules | Fix the underlying issue |
| Hardcode secrets/URLs | Use environment variables |
| Leave docs outdated | Update docs when behavior changes |
| Bypass authentication | Add proper auth checks to all protected routes |
| Access `db` directly in routes | Use repository services |
| Ignore preexisting errors | Fix ALL errors you encounter |
| Comment out dead code | Delete it completely |
| Keep unused imports | Remove them |
| Add `_unused` prefix to keep code | Delete the code |
| Write custom code for common tasks | Use established libraries |
| Preserve backwards compatibility | Delete old interfaces, rename freely |
| Add re-exports for old names | Update all usages to new names |

## Verification Checklist

Before completing ANY task, verify ALL of these:

### Build Verification
- [ ] `pnpm tsc` passes with zero errors
- [ ] `pnpm lint` passes with zero errors
- [ ] `pnpm test` passes (all tests green)
- [ ] `pnpm build` succeeds

### Code Quality
- [ ] No `any` types introduced
- [ ] No debug code (console.log, debugger statements)
- [ ] No hardcoded secrets or credentials
- [ ] Follows existing code patterns

### Cleanup (Do This Last)
- [ ] All unused imports removed
- [ ] All dead code deleted (not commented out)
- [ ] No backwards-compatibility shims left behind
- [ ] No `// TODO: remove` or similar comments
- [ ] Duplicate code consolidated

### Documentation
- [ ] Updated docs if APIs or behavior changed
- [ ] Updated types if interfaces changed

## File Naming Conventions

- Components: `PascalCase.tsx` (e.g., `VideoPlayer.tsx`)
- Hooks: `camelCase.ts` starting with `use` (e.g., `useVideo.ts`)
- Utilities: `kebab-case.ts` (e.g., `format-date.ts`)
- Tests: `*.test.ts` next to source file
- Schemas: `kebab-case.ts` (e.g., `video-schema.ts`)

## Getting Help

All documentation is in `content/docs/`:

- **Architecture overview**: `content/docs/internal/architecture/summary.mdx`
- **Database schema**: `content/docs/internal/architecture/database.mdx`
- **Effect-TS patterns**: `content/docs/internal/architecture/effect-best-practices.mdx`
- **Development setup**: `content/docs/internal/reference/development-setup.mdx`
- **React best practices**: `.claude/skills/react-best-practices/SKILL.md`

When in doubt, read `CLAUDE.md` in the project root for the most up-to-date patterns.
