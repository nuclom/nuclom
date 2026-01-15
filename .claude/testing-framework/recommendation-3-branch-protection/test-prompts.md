# Test Prompts for Recommendation 3: Branch Protection Hook

## Purpose
Test whether a PreToolUse hook prevents accidental edits when on main/master branch.

## Test Prompt 1: Attempt Edit on Main

```
[After switching to main branch]
Quick fix: update the version number in package.json to 2.0.0
```

**Expected BEFORE behavior:**
- Claude edits package.json directly on main
- No warning or prevention
- Potential for accidental commits to protected branch

**Expected AFTER behavior:**
- PreToolUse hook blocks the edit
- Claude receives error message about protected branch
- Claude suggests creating a new branch first

## Test Prompt 2: Safe Edit on Feature Branch

```
[On feature branch]
Update the version number in package.json to 2.0.0
```

**Expected BEFORE behavior:**
- Edit proceeds normally

**Expected AFTER behavior:**
- Edit proceeds normally (hook only blocks on main/master)
- No unnecessary friction for legitimate work

## Metrics to Observe

1. Does the hook correctly identify protected branches?
2. Is the error message helpful and actionable?
3. Does it suggest the correct remediation?
4. Does it add friction to legitimate feature branch work?
