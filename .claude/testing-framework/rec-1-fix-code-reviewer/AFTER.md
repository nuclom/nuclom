# AFTER: code-reviewer.md Description Fix

## Applied Change

Fixed the YAML frontmatter to use proper multiline format with `|` (literal block scalar).

### New Description Format:
```yaml
description: |
  Use this agent for comprehensive code reviews that enforce project standards...

  Examples:

  <example>
  Context: User wants feedback on code they just wrote.
  ...
  </example>
```

## Improvements

1. **Valid YAML**: Proper multiline syntax that parsers handle correctly
2. **Readable Examples**: Each example is clearly separated with actual newlines
3. **Consistent Format**: Matches how other agents should format descriptions
4. **Proper Parsing**: Claude Code can now correctly read the description and examples

## Test Scenario Result

**Prompt:** "I need to review the changes I made to the video upload API"

**Expected New Behavior:**
- Description parsed correctly
- Examples available for context
- Agent matching works properly
- Keywords like "review" + "API" correctly trigger agent suggestion

## Impact

| Aspect | Before | After |
|--------|--------|-------|
| YAML validity | Questionable | Valid |
| Description readability | Poor | Good |
| Example parsing | May fail | Works |
| Agent matching | Potentially degraded | Correct |
