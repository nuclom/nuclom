---
name: pr-review
description: Review code changes against project standards with a comprehensive checklist. Use for PR reviews or pre-commit code quality checks.
---

# Pull Request Review

You are performing a comprehensive code review for the Nuclom video collaboration platform. Follow this structured process:

## Step 1: Gather Context

Run these commands to understand the changes:

```bash
git diff HEAD~1..HEAD --stat    # Files changed
git diff HEAD~1..HEAD           # Actual changes
git log -1 --format="%s%n%n%b"  # Commit message
```

If reviewing a PR, use:
```bash
gh pr view --json title,body,files
gh pr diff
```

## Step 2: Review Checklist

Evaluate ALL changes against this checklist:

### TypeScript & Type Safety
- [ ] No `any` types (use `unknown` and narrow)
- [ ] No `@ts-ignore` or `@ts-expect-error` without justification
- [ ] Proper type annotations on function parameters and returns
- [ ] Effect Schema used for validation (not Zod)

### Effect-TS Patterns (API Routes)
- [ ] Uses `Effect.gen` for business logic
- [ ] Uses repository services (not direct `db` access)
- [ ] Uses `createFullLayer()` or `createPublicLayer()`
- [ ] Uses `handleEffectExit()` or `handleEffectExitWithStatus()`
- [ ] Custom errors extend `Data.TaggedError`
- [ ] Errors handled with `catchTag` close to source
- [ ] No `await Effect.runPromise()` inside `Effect.gen`

### React & Components
- [ ] Server Components preferred (no unnecessary `"use client"`)
- [ ] Loading states handled (skeleton or spinner)
- [ ] Error states handled (error boundary or try/catch)
- [ ] Empty states handled (for lists and optional data)
- [ ] Props typed with explicit interface
- [ ] Uses `cn()` for conditional classNames
- [ ] Accessibility: proper aria labels, keyboard navigation

### Database & Queries
- [ ] Uses repository pattern (not direct `db` access in routes)
- [ ] No N+1 query patterns
- [ ] Proper eager loading with `with: { ... }`
- [ ] Uses `userExtensions` table for app data (not `users`)

### Security
- [ ] Input validation at boundaries
- [ ] No hardcoded secrets
- [ ] Authentication checked in protected routes
- [ ] No SQL injection risks (using parameterized queries)
- [ ] No XSS risks (proper output encoding)

### Code Quality
- [ ] No console.log statements committed
- [ ] Clear, intention-revealing names
- [ ] Functions focused and reasonably sized
- [ ] No dead code or commented-out code
- [ ] Documentation updated if API changed

## Step 3: Categorize Findings

Organize your findings into three categories:

### Critical (Must Fix)
Issues that could cause bugs, security vulnerabilities, or break production.

### Warning (Should Fix)
Issues that violate project patterns or could cause future problems.

### Suggestion (Nice to Have)
Minor improvements for readability or maintainability.

## Step 4: Provide Feedback

Structure your review as:

```
## PR Review: [Title or Description]

### Summary
[1-2 sentence overall assessment]

### Critical Issues
[List with file:line references and specific fixes]

### Warnings
[List with file:line references and recommendations]

### Suggestions
[List of optional improvements]

### What's Done Well
[Acknowledge good patterns and practices]

### Verdict
[ ] Ready to merge
[ ] Needs changes (see Critical issues)
[ ] Needs discussion
```

## Additional Context

- Check `docs/` folder for architecture decisions
- Reference `CLAUDE.md` for project patterns
- Run `pnpm tsc` if type issues suspected
- Run `pnpm lint` if style issues suspected
