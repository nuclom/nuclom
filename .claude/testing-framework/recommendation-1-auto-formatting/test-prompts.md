# Test Prompts for Recommendation 1: Auto-Formatting Hook

## Purpose
Test whether a PostToolUse hook that auto-formats files improves code quality and reduces manual formatting steps.

## Test Prompt 1: Simple Function Creation

```
Create a simple utility function in src/lib/utils/string-helpers.ts that converts camelCase to kebab-case. Write it quickly without worrying about formatting.
```

**Expected BEFORE behavior:**
- Claude writes the function
- Formatting may be inconsistent with project standards
- No automatic formatting applied after write

**Expected AFTER behavior:**
- Claude writes the function
- Biome formatter automatically runs
- Output is consistently formatted

## Test Prompt 2: Multi-file Edit

```
Add a new field 'lastLoginAt' to the user extensions table in the database schema and update any related types.
```

**Expected BEFORE behavior:**
- Multiple file edits occur
- Each file may have different formatting consistency
- No automatic formatting

**Expected AFTER behavior:**
- Multiple file edits occur
- Formatting hook runs after each edit
- All files consistently formatted

## Metrics to Observe

1. Does Claude mention formatting in its response?
2. Are the resulting files properly formatted?
3. Is there any additional cognitive load on Claude regarding formatting?
4. Are there any tool calls specifically for formatting?
