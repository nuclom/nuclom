# AI/LLM Coding Agent Instructions

This file contains instructions for AI/LLM systems when working with the Nuclom codebase. See also:
- `CLAUDE.md` (root) - Quick reference for commands and project structure
- `AI.md` (root) - Detailed coding guidelines and patterns

## Core Principles

1. **Read before writing** - Always read existing code and documentation first
2. **Match existing patterns** - Follow conventions already in the codebase
3. **Minimal changes** - Only modify what's necessary for the task
4. **Verify with tools** - Run `pnpm tsc` and `pnpm lint` before finishing
5. **Update documentation** - Keep docs in sync with code changes

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
| Database schema | `src/lib/db/schema/` | Drizzle ORM definitions |
| API endpoints | `src/lib/openapi/endpoints.ts` | OpenAPI route handlers |
| Auth logic | `src/lib/auth.ts` | better-auth configuration (server) |
| Auth client | `src/lib/auth-client.ts` | better-auth client with helpers |
| Access control | `src/lib/access-control.ts` | Roles and permissions |
| React components | `src/components/` | UI and feature components |
| App routes | `src/app/` | Next.js App Router pages |
| Custom hooks | `src/hooks/` | React hooks |
| Utilities | `src/lib/utils/` | Helper functions |
| Types | `src/lib/types/` | TypeScript type definitions |
| Tests | `src/test/` and `*.test.ts` | Vitest and Playwright |

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
2. Follow component patterns in `src/components/ui/`
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

1. Define route in `src/lib/openapi/endpoints.ts`:
```typescript
export const newEndpoint = createRoute({
  method: "post",
  path: "/api/resource",
  request: { body: { content: { "application/json": { schema: inputSchema } } } },
  responses: { 200: { description: "Success", content: { "application/json": { schema: outputSchema } } } }
})
```

2. Implement handler with proper error handling
3. Add authentication checks
4. API documentation is auto-generated from OpenAPI spec

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

1. Modify schema in `src/lib/db/schema/[table].ts`
2. Export from `src/lib/db/schema/index.ts`
3. Generate migration: `pnpm db:generate`
4. Apply migration: `pnpm db:migrate`
5. Update `internal/architecture/database.mdx`

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
import { cn } from "@/lib/utils"

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

## Common Mistakes to Avoid

1. **Using `any` types** - Always use proper types or `unknown`
2. **Skipping type checks** - Always run `pnpm tsc`
3. **Ignoring lint errors** - Fix them, don't disable rules
4. **Hardcoding values** - Use environment variables
5. **Not updating docs** - Keep documentation in sync
6. **Bypassing auth** - All protected routes need auth checks
7. **Direct DB mutations** - Use Drizzle ORM methods
8. **Over-engineering** - Keep solutions simple and focused

## Verification Checklist

Before completing any task:

- [ ] Code compiles: `pnpm tsc` passes
- [ ] Code quality: `pnpm lint` passes
- [ ] Tests pass: `pnpm test` passes
- [ ] Build works: `pnpm build` succeeds
- [ ] No debug code (console.log, debugger)
- [ ] No hardcoded secrets
- [ ] Documentation updated where needed
- [ ] Follows existing code patterns

## File Naming Conventions

- Components: `PascalCase.tsx` (e.g., `VideoPlayer.tsx`)
- Hooks: `camelCase.ts` starting with `use` (e.g., `useVideo.ts`)
- Utilities: `kebab-case.ts` (e.g., `format-date.ts`)
- Tests: `*.test.ts` next to source file
- Schemas: `kebab-case.ts` (e.g., `video-schema.ts`)

## Getting Help

All documentation is in `content/docs/`:

- **Architecture overview**: `internal/architecture/summary.mdx`
- **Component reference**: `internal/reference/components.mdx`
- **Database schema**: `internal/architecture/database.mdx`
- **API documentation**: Auto-generated from OpenAPI at `/api-reference`
- **Development setup**: `internal/reference/development-setup.mdx`
