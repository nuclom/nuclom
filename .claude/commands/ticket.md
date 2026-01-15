---
name: ticket
description: Work on a GitHub issue or ticket end-to-end. Reads the issue, creates a branch, implements the fix, and prepares for PR.
---

# Ticket Workflow

Work on a GitHub issue from start to finish.

## Usage

```
/ticket <issue-number-or-url>
```

## Step 1: Read the Issue

Fetch issue details:

```bash
# Get issue details
gh issue view <number> --json title,body,labels,assignees,milestone

# Or if URL provided, extract number first
```

Parse and understand:
- **Title**: What's the high-level goal?
- **Description**: What are the requirements?
- **Labels**: Is this a bug, feature, or enhancement?
- **Acceptance Criteria**: What defines "done"?

## Step 2: Create Branch

Create a properly named branch:

```bash
# Format: <type>/<issue-number>-<brief-description>
# Examples:
# - fix/123-video-upload-timeout
# - feat/456-add-clip-export
# - refactor/789-simplify-auth-flow

git checkout -b <branch-name>
```

## Step 3: Explore Codebase

Before coding, understand the context:

1. **Find related code**: Search for similar patterns
2. **Identify files to change**: Map out the scope
3. **Check tests**: Find existing test patterns
4. **Review docs**: Check for architecture decisions

## Step 4: Implement

Follow TDD workflow:

1. **Write failing test** (if applicable)
2. **Implement fix/feature**
3. **Make test pass**
4. **Refactor if needed**

Make incremental commits:
```bash
git add <files>
git commit -m "type(scope): description"
```

## Step 5: Quality Check

Before marking complete:

```bash
# Type check
pnpm tsc

# Lint
pnpm lint

# Run tests
pnpm test

# Run related e2e tests (if applicable)
pnpm test:e2e --grep "<related-pattern>"
```

## Step 6: Update Issue

Add progress comment:

```bash
gh issue comment <number> --body "Implementation complete in branch \`<branch-name>\`. Changes include:
- <change 1>
- <change 2>

Ready for PR."
```

## Step 7: Prepare PR

Create pull request:

```bash
gh pr create --title "<type>(scope): <description>" --body "$(cat <<'EOF'
## Summary
<1-2 sentence description>

Fixes #<issue-number>

## Changes
- <change 1>
- <change 2>

## Test Plan
- [ ] Unit tests pass
- [ ] E2E tests pass (if applicable)
- [ ] Manual testing completed

## Screenshots
<if UI changes>
EOF
)"
```

## Handling Blockers

If you encounter issues:

1. **Missing information**: Comment on issue asking for clarification
2. **Unrelated bugs found**: Create new issue, don't scope-creep
3. **Architecture questions**: Check docs/ or ask for guidance

## Checklist

Before marking ticket complete:

- [ ] All acceptance criteria met
- [ ] Tests added/updated
- [ ] Type check passes
- [ ] Lint passes
- [ ] Documentation updated (if needed)
- [ ] PR created and linked to issue
