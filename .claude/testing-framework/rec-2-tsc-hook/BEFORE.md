# BEFORE: TypeScript Check Hook

## Current State

The `settings.json` file has hooks for:
- **PostToolUse**: Auto-format on Write/Edit
- **PreToolUse**: Branch protection on Write/Edit

No hook exists to run TypeScript type checking after file edits.

## Test Scenario

**Prompt:** "Add a new function to src/lib/utils/helpers.ts that returns the user's initials"

**Current Behavior:**
1. Claude writes/edits the file
2. Auto-format runs (PostToolUse)
3. **No type checking** - type errors could be introduced silently
4. User discovers errors later when running `pnpm tsc` or at CI time

**Sample Problem Code:**
```typescript
// Claude might write this without realizing the type error
export function getInitials(user: User): string {
  return user.firstName[0] + user.lastName[0];  // Error if firstName is undefined
}
```

## Issues

| Problem | Impact |
|---------|--------|
| No immediate type feedback | Errors discovered late |
| Broken code committed | CI failures, wasted time |
| False sense of completion | Code seems done but isn't |
| Manual checking required | User must remember to run tsc |

## Current Workflow

1. Claude edits TypeScript file
2. Format hook runs
3. User manually runs `pnpm tsc` (or forgets)
4. Errors found later (if at all)
