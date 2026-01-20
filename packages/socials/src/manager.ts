import { Effect } from 'effect';
import { createTwitterProvider, type TwitterProvider } from './providers/twitter/index.ts';
import { createStorage, type LocalStorage } from './storage/store.ts';
import { type AnySocialError, ConfigurationError, NotFoundError } from './types/errors.ts';
import type { Mention, Post, ProviderCredentials, SocialProvider } from './types/provider.ts';

/**
 * Supported provider types
 */
export type ProviderType = 'twitter';

/**
 * Provider factory function type
 */
type ProviderFactory = () => SocialProvider;

/**
 * Registry of available providers
 */
const providerFactories: Record<ProviderType, ProviderFactory> = {
  twitter: createTwitterProvider,
};

/**
 * Get list of available provider names
 */
export function getAvailableProviders(): ProviderType[] {
  return Object.keys(providerFactories) as ProviderType[];
}

/**
 * Check if a provider type is valid
 */
export function isValidProvider(name: string): name is ProviderType {
  return name in providerFactories;
}

/**
 * Managed provider with storage
 */
export interface ManagedProvider {
  provider: SocialProvider;
  storage: LocalStorage;
}

/**
 * Social accounts manager
 * Coordinates providers and storage
 */
export class SocialsManager {
  private providers: Map<ProviderType, ManagedProvider> = new Map();

  /**
   * Get or create a managed provider instance
   */
  private getOrCreateProvider(type: ProviderType): ManagedProvider {
    let managed = this.providers.get(type);

    if (!managed) {
      const factory = providerFactories[type];
      const provider = factory();
      const storage = createStorage(type);
      managed = { provider, storage };
      this.providers.set(type, managed);
    }

    return managed;
  }

  /**
   * Get a provider by type
   */
  getProvider(type: ProviderType): Effect.Effect<ManagedProvider, NotFoundError> {
    return Effect.gen(this, function* () {
      if (!isValidProvider(type)) {
        return yield* Effect.fail(
          new NotFoundError({
            message: `Unknown provider: ${type}`,
            provider: type,
            resourceType: 'provider',
            resourceId: type,
          }),
        );
      }

      return this.getOrCreateProvider(type);
    });
  }

  /**
   * Initialize a provider with stored or provided credentials
   */
  initializeProvider(
    type: ProviderType,
    credentials?: ProviderCredentials,
  ): Effect.Effect<ManagedProvider, AnySocialError> {
    return Effect.gen(this, function* () {
      const managed = yield* this.getProvider(type);

      // Use provided credentials or load from storage
      let creds: ProviderCredentials | undefined = credentials;
      if (!creds) {
        const stored = yield* managed.storage.getCredentials();
        if (!stored) {
          return yield* Effect.fail(
            new ConfigurationError({
              message: `No credentials found for ${type}. Run 'nuclom-socials ${type} auth' to configure.`,
              provider: type,
            }),
          );
        }
        creds = stored;
      }

      // Initialize the provider
      yield* managed.provider.initialize(creds);

      // Save credentials if they were provided
      if (credentials) {
        yield* managed.storage.setCredentials(credentials);
      }

      return managed;
    });
  }

  /**
   * Store credentials for a provider without initializing
   */
  storeCredentials(type: ProviderType, credentials: ProviderCredentials): Effect.Effect<void, ConfigurationError> {
    return Effect.gen(this, function* () {
      const managed = this.getOrCreateProvider(type);
      yield* managed.storage.setCredentials(credentials);
    });
  }

  /**
   * Clear stored credentials for a provider
   */
  clearCredentials(type: ProviderType): Effect.Effect<void, ConfigurationError> {
    return Effect.gen(this, function* () {
      const managed = this.getOrCreateProvider(type);
      yield* managed.storage.clearCredentials();
    });
  }

  /**
   * Check if a provider has stored credentials
   */
  hasCredentials(type: ProviderType): Effect.Effect<boolean, ConfigurationError> {
    return Effect.gen(this, function* () {
      const managed = this.getOrCreateProvider(type);
      const creds = yield* managed.storage.getCredentials();
      return creds !== null;
    });
  }

  /**
   * Create a post and track it in history
   */
  createPost(
    type: ProviderType,
    text: string,
    options?: { replyToId?: string; quoteId?: string; mediaPaths?: string[] },
  ): Effect.Effect<Post, AnySocialError> {
    return Effect.gen(this, function* () {
      const managed = yield* this.initializeProvider(type);

      const post = yield* managed.provider.createPost({
        text,
        replyToId: options?.replyToId,
        quoteId: options?.quoteId,
        mediaPaths: options?.mediaPaths,
      });

      // Track in history
      yield* managed.storage.addPostToHistory(post);

      return post;
    });
  }

  /**
   * Get mentions with tracking of last seen
   */
  getMentions(
    type: ProviderType,
    options?: { limit?: number; sinceLastCheck?: boolean },
  ): Effect.Effect<Mention[], AnySocialError> {
    return Effect.gen(this, function* () {
      const managed = yield* this.initializeProvider(type);

      let sinceId: string | undefined;
      if (options?.sinceLastCheck) {
        const lastId = yield* managed.storage.getLastMentionId();
        sinceId = lastId ?? undefined;
      }

      const mentions = yield* managed.provider.getMentions({
        limit: options?.limit,
        sinceId,
      });

      // Update last mention ID
      if (mentions.length > 0) {
        yield* managed.storage.setLastMentionId(mentions[0].id);
      }

      return mentions;
    });
  }

  /**
   * Get post history from local storage
   */
  getPostHistory(
    type: ProviderType,
    limit?: number,
  ): Effect.Effect<Array<{ id: string; text: string; createdAt: string; url: string }>, AnySocialError> {
    return Effect.gen(this, function* () {
      const managed = yield* this.getProvider(type);
      return yield* managed.storage.getPostHistory(limit);
    });
  }
}

/**
 * Create a new socials manager instance
 */
export function createSocialsManager(): SocialsManager {
  return new SocialsManager();
}

// Re-export provider types for convenience
export type { TwitterProvider };
