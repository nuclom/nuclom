# Test Prompts for Recommendation 4: Code Reviewer Agent

## Purpose
Test whether a dedicated code-reviewer agent with project-specific checklist improves code review quality.

## Test Prompt 1: Review API Endpoint

```
Review this new API endpoint I created at src/app/api/videos/clips/route.ts for any issues.
```

**Expected BEFORE behavior (without code-reviewer):**
- Review based on general best practices
- May miss project-specific patterns (Effect-TS, repository pattern)
- No structured checklist

**Expected AFTER behavior (with code-reviewer agent):**
- Applies project-specific checklist
- Checks Effect-TS patterns, error handling, repository usage
- Structured output with Critical/Warning/Suggestion categories

## Test Prompt 2: Review Component

```
Review the new VideoPlayer component I added in src/components/video/video-player.tsx
```

**Expected BEFORE behavior:**
- General React best practices review
- May not check project-specific patterns
- No loading/error/empty state verification

**Expected AFTER behavior:**
- Checks against project component standards
- Verifies loading/error/empty states
- Checks accessibility and performance patterns

## Checklist to Verify in Reviews

1. TypeScript strict mode compliance (no `any`)
2. Effect-TS pattern usage in API routes
3. Repository pattern for database access
4. Loading/error/empty state handling
5. Proper error handling with Data.TaggedError
6. Security considerations (auth, input validation)
7. Performance considerations (N+1 queries, unnecessary re-renders)

## Metrics to Observe

1. Does the review cover all checklist items?
2. Is feedback actionable with code examples?
3. Is severity categorization helpful?
4. Are project-specific patterns correctly identified?
