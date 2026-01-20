import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { Effect } from 'effect';
import { ConfigurationError } from '../types/errors.ts';
import type { Post, ProviderCredentials } from '../types/provider.ts';

/**
 * Storage directory for the CLI
 */
const STORAGE_DIR = join(homedir(), '.nuclom', 'socials');

/**
 * Ensure the storage directory exists
 */
function ensureStorageDir(): void {
  if (!existsSync(STORAGE_DIR)) {
    mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

/**
 * Get the path to a storage file
 */
function getStoragePath(filename: string): string {
  ensureStorageDir();
  return join(STORAGE_DIR, filename);
}

/**
 * Provider state stored locally
 */
export interface ProviderState {
  credentials: ProviderCredentials | null;
  lastMentionId: string | null;
  lastPostId: string | null;
  postHistory: StoredPost[];
  updatedAt: string;
}

/**
 * Minimal post data stored locally for tracking
 */
export interface StoredPost {
  id: string;
  text: string;
  createdAt: string;
  url: string;
}

/**
 * Convert a Post to StoredPost
 */
export function toStoredPost(post: Post): StoredPost {
  return {
    id: post.id,
    text: post.text,
    createdAt: post.createdAt.toISOString(),
    url: post.url,
  };
}

/**
 * Default provider state
 */
function defaultProviderState(): ProviderState {
  return {
    credentials: null,
    lastMentionId: null,
    lastPostId: null,
    postHistory: [],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Local file storage for provider state
 */
export class LocalStorage {
  private readonly providerName: string;
  private readonly filePath: string;

  constructor(providerName: string) {
    this.providerName = providerName;
    this.filePath = getStoragePath(`${providerName}.json`);
  }

  /**
   * Load the provider state from disk
   */
  load(): Effect.Effect<ProviderState, ConfigurationError> {
    return Effect.gen(this, function* () {
      if (!existsSync(this.filePath)) {
        return defaultProviderState();
      }

      const content = yield* Effect.tryPromise({
        try: () => Bun.file(this.filePath).text(),
        catch: (e) =>
          new ConfigurationError({
            message: `Failed to read storage file: ${this.filePath}`,
            provider: this.providerName,
            cause: e,
          }),
      });

      try {
        return JSON.parse(content) as ProviderState;
      } catch (e) {
        return yield* Effect.fail(
          new ConfigurationError({
            message: `Failed to parse storage file: ${this.filePath}`,
            provider: this.providerName,
            cause: e,
          }),
        );
      }
    });
  }

  /**
   * Save the provider state to disk
   */
  save(state: ProviderState): Effect.Effect<void, ConfigurationError> {
    return Effect.gen(this, function* () {
      ensureStorageDir();

      const dir = dirname(this.filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      state.updatedAt = new Date().toISOString();

      yield* Effect.tryPromise({
        try: () => Bun.write(this.filePath, JSON.stringify(state, null, 2)),
        catch: (e) =>
          new ConfigurationError({
            message: `Failed to write storage file: ${this.filePath}`,
            provider: this.providerName,
            cause: e,
          }),
      });
    });
  }

  /**
   * Update credentials
   */
  setCredentials(credentials: ProviderCredentials): Effect.Effect<void, ConfigurationError> {
    return Effect.gen(this, function* () {
      const state = yield* this.load();
      state.credentials = credentials;
      yield* this.save(state);
    });
  }

  /**
   * Get stored credentials
   */
  getCredentials(): Effect.Effect<ProviderCredentials | null, ConfigurationError> {
    return Effect.gen(this, function* () {
      const state = yield* this.load();
      return state.credentials;
    });
  }

  /**
   * Clear stored credentials
   */
  clearCredentials(): Effect.Effect<void, ConfigurationError> {
    return Effect.gen(this, function* () {
      const state = yield* this.load();
      state.credentials = null;
      yield* this.save(state);
    });
  }

  /**
   * Update the last mention ID for tracking
   */
  setLastMentionId(mentionId: string): Effect.Effect<void, ConfigurationError> {
    return Effect.gen(this, function* () {
      const state = yield* this.load();
      state.lastMentionId = mentionId;
      yield* this.save(state);
    });
  }

  /**
   * Get the last mention ID
   */
  getLastMentionId(): Effect.Effect<string | null, ConfigurationError> {
    return Effect.gen(this, function* () {
      const state = yield* this.load();
      return state.lastMentionId;
    });
  }

  /**
   * Add a post to history
   */
  addPostToHistory(post: Post): Effect.Effect<void, ConfigurationError> {
    return Effect.gen(this, function* () {
      const state = yield* this.load();

      // Keep only last 100 posts
      const history = [toStoredPost(post), ...state.postHistory].slice(0, 100);
      state.postHistory = history;
      state.lastPostId = post.id;

      yield* this.save(state);
    });
  }

  /**
   * Get post history
   */
  getPostHistory(limit = 20): Effect.Effect<StoredPost[], ConfigurationError> {
    return Effect.gen(this, function* () {
      const state = yield* this.load();
      return state.postHistory.slice(0, limit);
    });
  }

  /**
   * Clear all stored data for this provider
   */
  clear(): Effect.Effect<void, ConfigurationError> {
    return this.save(defaultProviderState());
  }
}

/**
 * Create a storage instance for a provider
 */
export function createStorage(providerName: string): LocalStorage {
  return new LocalStorage(providerName);
}

/**
 * Get the storage directory path
 */
export function getStorageDirectory(): string {
  return STORAGE_DIR;
}
