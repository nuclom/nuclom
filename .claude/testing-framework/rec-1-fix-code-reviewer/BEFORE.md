# BEFORE: code-reviewer.md Description Fix

## Current State

The `code-reviewer.md` agent file has a malformed YAML frontmatter. The `description` field contains literal `\n` escape sequences instead of proper YAML multiline formatting.

### Current Description (Line 3):
```yaml
description: Use this agent for comprehensive code reviews...\n\nExamples:\n\n<example>\nContext: User wants feedback...
```

### Problems:
1. **Parsing Issues**: YAML parsers may not correctly interpret `\n` as newlines
2. **Display Issues**: The description may appear garbled in Claude Code's agent list
3. **Readability**: The examples are not properly formatted for display
4. **Consistency**: Other agents use proper multiline YAML (with `|` or `>`)

## Test Scenario

**Prompt:** "I need to review the changes I made to the video upload API"

**Expected Behavior (if description works):**
- Claude recognizes "review" + "API" and suggests code-reviewer agent
- The agent's examples help Claude understand when to use it

**Potential Issue:**
- If description is malformed, Claude may not properly match the agent to the task

## Impact Assessment

| Aspect | Current State |
|--------|---------------|
| YAML validity | Questionable |
| Description readability | Poor |
| Example parsing | May fail |
| Agent matching | Potentially degraded |
