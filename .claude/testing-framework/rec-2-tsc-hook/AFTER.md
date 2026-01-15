# AFTER: TypeScript Check Hook

## Applied Change

Added PostToolUse hook to run TypeScript type checking after `.ts` or `.tsx` file edits.

### New Hook:
```json
{
  "matcher": "Write|Edit",
  "hooks": [
    {
      "type": "command",
      "command": "if [[ \"$TOOL_INPUT\" =~ \\.(ts|tsx)$ ]]; then echo '🔍 Running TypeScript check...' && pnpm tsc --noEmit 2>&1 | head -20 || true; fi",
      "timeout": 60000
    }
  ]
}
```

## Behavior

1. **Trigger**: Runs after any Write/Edit to `.ts` or `.tsx` files
2. **Output**: Shows first 20 lines of tsc output (truncated to avoid flooding)
3. **Non-blocking**: Uses `|| true` so errors don't block Claude
4. **Timeout**: 60 seconds to allow for type checking

## New Workflow

1. Claude edits TypeScript file
2. Format hook runs (formats code)
3. **TypeScript check runs** (reports errors immediately)
4. Claude sees errors and can fix them
5. Iterate until clean

## Expected Output

```
🔍 Running TypeScript check...
src/lib/utils/helpers.ts:15:3 - error TS2322: Type 'undefined' is not assignable to type 'string'.
```

## Impact

| Aspect | Before | After |
|--------|--------|-------|
| Error discovery | Late (manual) | Immediate |
| Feedback loop | Minutes/hours | Seconds |
| Type safety | Enforced at CI | Enforced at edit time |
| Developer experience | Must remember tsc | Automatic |
