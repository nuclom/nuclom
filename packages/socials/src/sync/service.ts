import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Effect } from 'effect';
import type { SocialsManager } from '../manager.ts';
import { type AnySocialError, ConfigurationError } from '../types/errors.ts';
import type { Post, Profile } from '../types/provider.ts';
import { DEFAULT_SYNC_CONFIG, type SyncConfig, type SyncedProfile, type SyncedTweet, type SyncState } from './types.ts';

/**
 * Convert a Post to SyncedTweet format
 */
function toSyncedTweet(post: Post): SyncedTweet {
  return {
    id: post.id,
    text: post.text,
    createdAt: post.createdAt.toISOString(),
    url: post.url,
    metrics: {
      likes: post.likesCount,
      retweets: post.repostsCount,
      replies: post.repliesCount,
    },
    inReplyToId: post.inReplyToId,
    quotedId: post.quotedPostId,
  };
}

/**
 * Convert a Profile to SyncedProfile format
 */
function toSyncedProfile(profile: Profile): SyncedProfile {
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    metrics: {
      followers: profile.followersCount,
      following: profile.followingCount,
      tweets: profile.postsCount,
    },
    url: profile.url,
    lastSynced: new Date().toISOString(),
  };
}

/**
 * Find the git root directory
 */
function findGitRoot(startDir: string): string | null {
  let dir = startDir;
  while (dir !== '/') {
    if (existsSync(join(dir, '.git'))) {
      return dir;
    }
    dir = dirname(dir);
  }
  return null;
}

/**
 * Sync service for storing social media data in git
 */
export class SyncService {
  private config: SyncConfig;
  private gitRoot: string | null;

  constructor(config: Partial<SyncConfig> = {}) {
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
    this.gitRoot = findGitRoot(process.cwd());
  }

  /**
   * Get the output directory for a provider
   */
  private getProviderDir(provider: string): Effect.Effect<string, ConfigurationError> {
    return Effect.gen(this, function* () {
      if (!this.gitRoot) {
        return yield* Effect.fail(
          new ConfigurationError({
            message: 'Not in a git repository. Sync requires a git repository to store data.',
            provider,
          }),
        );
      }

      const dir = join(this.gitRoot, this.config.outputDir, provider);

      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      return dir;
    });
  }

  /**
   * Load existing sync state for a provider
   */
  loadState(provider: string): Effect.Effect<SyncState | null, ConfigurationError> {
    return Effect.gen(this, function* () {
      const dir = yield* this.getProviderDir(provider);
      const statePath = join(dir, 'state.json');

      if (!existsSync(statePath)) {
        return null;
      }

      const content = yield* Effect.tryPromise({
        try: () => Bun.file(statePath).text(),
        catch: (e) =>
          new ConfigurationError({
            message: `Failed to read sync state: ${statePath}`,
            provider,
            cause: e,
          }),
      });

      try {
        return JSON.parse(content) as SyncState;
      } catch (e) {
        return yield* Effect.fail(
          new ConfigurationError({
            message: `Failed to parse sync state: ${statePath}`,
            provider,
            cause: e,
          }),
        );
      }
    });
  }

  /**
   * Save sync state for a provider
   */
  saveState(provider: string, state: SyncState): Effect.Effect<string, ConfigurationError> {
    return Effect.gen(this, function* () {
      const dir = yield* this.getProviderDir(provider);
      const statePath = join(dir, 'state.json');

      yield* Effect.tryPromise({
        try: () => Bun.write(statePath, JSON.stringify(state, null, 2)),
        catch: (e) =>
          new ConfigurationError({
            message: `Failed to write sync state: ${statePath}`,
            provider,
            cause: e,
          }),
      });

      return statePath;
    });
  }

  /**
   * Sync tweets from a provider to git
   */
  syncTweets(
    manager: SocialsManager,
    provider: 'twitter',
    options: { limit?: number } = {},
  ): Effect.Effect<{ path: string; tweetsCount: number; isNew: boolean }, AnySocialError> {
    return Effect.gen(this, function* () {
      const { provider: socialProvider } = yield* manager.initializeProvider(provider);

      // Fetch profile and tweets
      const profile = yield* socialProvider.getProfile();
      const tweets = yield* socialProvider.getPosts({ limit: options.limit ?? 100 });

      // Load existing state to check for changes
      const existingState = yield* this.loadState(provider);

      // Create new state
      const newState: SyncState = {
        provider,
        lastSyncedAt: new Date().toISOString(),
        profile: toSyncedProfile(profile),
        tweets: tweets.map(toSyncedTweet),
      };

      // Save state
      const path = yield* this.saveState(provider, newState);

      return {
        path,
        tweetsCount: tweets.length,
        isNew: existingState === null,
      };
    });
  }

  /**
   * Export tweets to a simple markdown format for easy reading
   */
  exportToMarkdown(
    manager: SocialsManager,
    provider: 'twitter',
    options: { limit?: number } = {},
  ): Effect.Effect<string, AnySocialError> {
    return Effect.gen(this, function* () {
      const { provider: socialProvider } = yield* manager.initializeProvider(provider);

      const profile = yield* socialProvider.getProfile();
      const tweets = yield* socialProvider.getPosts({ limit: options.limit ?? 100 });

      const dir = yield* this.getProviderDir(provider);
      const mdPath = join(dir, 'tweets.md');

      const lines: string[] = [
        `# @${profile.username} Twitter Archive`,
        '',
        `Last synced: ${new Date().toISOString()}`,
        '',
        `**${profile.displayName}** (@${profile.username})`,
        profile.bio ? `> ${profile.bio}` : '',
        '',
        `Followers: ${profile.followersCount.toLocaleString()} | Following: ${profile.followingCount.toLocaleString()} | Tweets: ${profile.postsCount.toLocaleString()}`,
        '',
        '---',
        '',
        '## Tweets',
        '',
      ];

      for (const tweet of tweets) {
        lines.push(`### ${tweet.createdAt.toISOString().split('T')[0]}`);
        lines.push('');
        lines.push(tweet.text);
        lines.push('');
        lines.push(`♥ ${tweet.likesCount} | ⟲ ${tweet.repostsCount} | 💬 ${tweet.repliesCount} | [Link](${tweet.url})`);
        lines.push('');
        lines.push('---');
        lines.push('');
      }

      yield* Effect.tryPromise({
        try: () => Bun.write(mdPath, lines.join('\n')),
        catch: (e) =>
          new ConfigurationError({
            message: `Failed to write markdown: ${mdPath}`,
            provider,
            cause: e,
          }),
      });

      return mdPath;
    });
  }
}

/**
 * Create a sync service instance
 */
export function createSyncService(config?: Partial<SyncConfig>): SyncService {
  return new SyncService(config);
}
