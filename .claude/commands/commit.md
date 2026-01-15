---
name: commit
description: Create a well-formatted commit with pre-commit checks. Runs type checking and linting before committing.
---

# Commit with Quality Checks

You are creating a commit for the Nuclom project. Follow this workflow:

## Step 1: Pre-Commit Checks

Run these checks before committing:

```bash
# Type check
pnpm tsc

# Lint check
pnpm lint
```

If either fails, fix the issues before proceeding.

## Step 2: Review Changes

```bash
git status
git diff --staged
```

If no files are staged, stage the relevant changes:
```bash
git add [files...]
```

## Step 3: Analyze Changes

Examine what's being committed:
- What type of change is this? (feat/fix/refactor/docs/test/chore)
- What's the scope? (component name, feature area)
- What's the core change and why?

## Step 4: Write Commit Message

Follow conventional commits format:

```
<type>(<scope>): <description>

[optional body explaining why]

[optional footer with breaking changes or issue refs]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code change that neither fixes bug nor adds feature
- `docs`: Documentation only
- `test`: Adding or updating tests
- `chore`: Build process, dependencies, tooling

**Guidelines:**
- Description should complete: "This commit will..."
- Focus on WHY, not WHAT (the diff shows WHAT)
- Keep subject line under 72 characters
- Use imperative mood ("add" not "added")

## Step 5: Create Commit

Use HEREDOC for multi-line messages:

```bash
git commit -m "$(cat <<'EOF'
type(scope): description

Optional body with more detail about why this change was made.
EOF
)"
```

## Step 6: Verify

```bash
git log -1
git status
```

## Examples

**Feature:**
```
feat(video-player): add keyboard shortcuts for playback control

Users can now use spacebar for play/pause, arrow keys for seeking.
Improves accessibility and power user experience.
```

**Bug Fix:**
```
fix(upload): handle file size validation before upload starts

Previously, large files would fail mid-upload. Now we validate
size client-side and show a clear error message.

Fixes #123
```

**Refactor:**
```
refactor(api): migrate video routes to Effect-TS pattern

Aligns with project standards for type-safe error handling.
No functional changes.
```
