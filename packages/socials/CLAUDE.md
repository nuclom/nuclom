# @nuclom/socials

CLI tool for managing Nuclom's social media accounts. Built with Bun and Effect-TS.

## Quick Reference

```bash
# Run CLI from monorepo root
pnpm socials <command>

# Twitter commands
pnpm socials twitter auth --interactive  # Configure credentials
pnpm socials twitter status              # Check auth status
pnpm socials twitter profile             # View profile
pnpm socials twitter tweet "text"        # Post tweet
pnpm socials twitter delete <id>         # Delete tweet
pnpm socials twitter mentions            # View mentions
pnpm socials twitter timeline            # View your tweets
pnpm socials twitter reply <id> "text"   # Reply to tweet
pnpm socials twitter like <id>           # Like tweet
pnpm socials twitter retweet <id>        # Retweet
pnpm socials twitter sync                # Sync tweets to git
pnpm socials twitter history             # View local history
```

## Authentication

Credentials are stored in `~/.nuclom/socials/twitter.json`. Configure with:

```bash
pnpm socials twitter auth --interactive
```

Or provide credentials directly:
```bash
pnpm socials twitter auth \
  --api-key "..." --api-secret "..." \
  --access-token "..." --access-secret "..."
```

## Syncing Tweets to Git

The `sync` command fetches tweets and stores them in the repository:

```bash
# Sync to .nuclom/socials/twitter/state.json
pnpm socials twitter sync

# Also export readable markdown
pnpm socials twitter sync --markdown

# Custom limit
pnpm socials twitter sync --limit 200
```

## JSON Output

Most commands support `--json` for machine-readable output:

```bash
pnpm socials twitter profile --json
pnpm socials twitter tweet "Hello" --json
pnpm socials twitter mentions --json
```

## Package Structure

```
src/
├── cli.ts              # CLI entry point
├── manager.ts          # Provider orchestration
├── commands/
│   └── twitter.ts      # Twitter CLI commands
├── providers/
│   └── twitter/        # Twitter API implementation
├── storage/            # Local credential storage
├── sync/               # Git sync functionality
└── types/              # TypeScript types and errors
```

## Programmatic Usage

```typescript
import { createSocialsManager } from '@nuclom/socials';
import { Effect } from 'effect';

const manager = createSocialsManager();

// Post a tweet
const tweet = await Effect.runPromise(
  manager.createPost('twitter', 'Hello!')
);
```
