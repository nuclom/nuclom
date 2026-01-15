---
name: code-quality
description: Run comprehensive code quality checks including type checking, linting, and common issue detection. Use before commits or to audit code health.
---

# Code Quality Audit

Run comprehensive quality checks on the codebase and report findings.

## Step 1: Run Automated Checks

Execute these checks in sequence:

```bash
# TypeScript type checking
echo "🔍 Running TypeScript check..."
pnpm tsc

# Biome linting
echo "🧹 Running linter..."
pnpm lint
```

## Step 2: Report Results

### If checks pass:
```
✅ All automated checks passed!
- TypeScript: No errors
- Lint: No issues
```

### If checks fail:
Report each failure category:

```
## Code Quality Report

### TypeScript Errors (X)
[List errors with file:line and description]

### Lint Issues (X)
[List lint issues with file:line and rule]

### Summary
- TypeScript: X errors
- Lint: X issues
- Status: ❌ Needs attention
```

## Step 3: Manual Scan (Optional)

If requested, also check for:

### Common Issues
- [ ] Console.log statements in production code
- [ ] Commented-out code blocks
- [ ] TODO/FIXME comments without issue links
- [ ] Unused imports or variables
- [ ] Hardcoded strings that should be constants

### Effect-TS Patterns
- [ ] Direct `db` access in API routes
- [ ] `await Effect.runPromise()` inside `Effect.gen`
- [ ] Missing error handling
- [ ] Missing layer provision

### Security
- [ ] Hardcoded secrets or API keys
- [ ] Unvalidated user input
- [ ] SQL injection risks
- [ ] XSS vulnerabilities

## Quick Fix Mode

If `--fix` is specified:

```bash
# Auto-fix lint issues
pnpm lint:fix

# Re-run checks
pnpm tsc
pnpm lint
```

## Output

Always end with a summary:

```
## Quality Summary

| Check | Status | Issues |
|-------|--------|--------|
| TypeScript | ✅/❌ | X |
| Lint | ✅/❌ | X |
| Manual | ✅/❌ | X |

**Overall**: Ready to commit / Needs fixes
```
