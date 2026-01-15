# Test Prompts for Recommendation 2: Custom Slash Commands

## Purpose
Test whether custom slash commands like `/pr-review` improve consistency and reduce prompt complexity.

## Test Prompt 1: Manual PR Review Request

```
Review the changes in this branch and give me feedback on code quality, potential issues, and suggestions for improvement.
```

**Expected BEFORE behavior:**
- Claude interprets the request ad-hoc
- Review criteria may vary based on interpretation
- No standardized checklist applied

**Expected AFTER behavior (with /pr-review command):**
- Running `/pr-review` invokes standardized review process
- Consistent checklist applied every time
- Structured output with severity levels

## Test Prompt 2: Commit Workflow

```
I've made changes to fix the video upload bug. Create a commit with proper message.
```

**Expected BEFORE behavior:**
- Claude commits with whatever message format it decides
- No standardized pre-commit checks mentioned

**Expected AFTER behavior (with /commit command):**
- Running `/commit` applies standardized workflow
- Runs lint/type check before committing
- Follows conventional commit format

## Metrics to Observe

1. Is the output structure consistent?
2. Does the command apply project-specific standards?
3. Is the workflow repeatable and predictable?
4. How much context does the user need to provide?
