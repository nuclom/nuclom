import { Context, type Effect, Layer } from 'effect';
import { createSocialsManager, type ProviderType, type SocialsManager } from '../manager.ts';
import type { StoredPost } from '../storage/store.ts';
import { createSyncService } from '../sync/index.ts';
import type { AnySocialError } from '../types/errors.ts';
import type { Mention, Post, ProviderCredentials, SocialProvider } from '../types/provider.ts';

/**
 * SocialsManager service interface for dependency injection
 */
export interface SocialsManagerService {
  readonly initializeProvider: (
    type: ProviderType,
    credentials?: ProviderCredentials,
  ) => Effect.Effect<{ provider: SocialProvider }, AnySocialError>;

  readonly hasCredentials: (type: ProviderType) => Effect.Effect<boolean, AnySocialError>;

  readonly clearCredentials: (type: ProviderType) => Effect.Effect<void, AnySocialError>;

  readonly createPost: (
    type: ProviderType,
    text: string,
    options?: { replyToId?: string; quoteId?: string; mediaPaths?: string[] },
  ) => Effect.Effect<Post, AnySocialError>;

  readonly getMentions: (
    type: ProviderType,
    options?: { limit?: number; sinceLastCheck?: boolean },
  ) => Effect.Effect<Mention[], AnySocialError>;

  readonly getPostHistory: (type: ProviderType, limit?: number) => Effect.Effect<StoredPost[], AnySocialError>;
}

/**
 * SocialsManager service tag
 */
export class SocialsManagerTag extends Context.Tag('SocialsManager')<SocialsManagerTag, SocialsManagerService>() {}

/**
 * Create SocialsManager service from instance
 */
function makeSocialsManagerService(manager: SocialsManager): SocialsManagerService {
  return {
    initializeProvider: (type, credentials) => manager.initializeProvider(type, credentials),
    hasCredentials: (type) => manager.hasCredentials(type),
    clearCredentials: (type) => manager.clearCredentials(type),
    createPost: (type, text, options) => manager.createPost(type, text, options),
    getMentions: (type, options) => manager.getMentions(type, options),
    getPostHistory: (type, limit) => manager.getPostHistory(type, limit),
  };
}

/**
 * Live layer for SocialsManager service
 */
export const SocialsManagerLive = Layer.sync(SocialsManagerTag, () => {
  const manager = createSocialsManager();
  return makeSocialsManagerService(manager);
});

/**
 * SyncService interface for dependency injection
 */
export interface SyncServiceInterface {
  readonly syncTweets: (
    type: 'twitter',
    options?: { limit?: number },
  ) => Effect.Effect<{ path: string; tweetsCount: number; isNew: boolean }, AnySocialError>;

  readonly exportToMarkdown: (type: 'twitter', options?: { limit?: number }) => Effect.Effect<string, AnySocialError>;
}

/**
 * SyncService tag
 */
export class SyncServiceTag extends Context.Tag('SyncService')<SyncServiceTag, SyncServiceInterface>() {}

/**
 * Live layer for SyncService
 */
export const SyncServiceLive = Layer.sync(SyncServiceTag, () => {
  const manager = createSocialsManager();
  const syncService = createSyncService();

  return {
    syncTweets: (type, options) => syncService.syncTweets(manager, type, options),
    exportToMarkdown: (type, options) => syncService.exportToMarkdown(manager, type, options),
  };
});

/**
 * Combined live layer with all services
 */
export const ServicesLive = Layer.mergeAll(SocialsManagerLive, SyncServiceLive);
