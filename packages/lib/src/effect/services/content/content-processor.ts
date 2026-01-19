/**
 * Content Processor Service
 *
 * Orchestrates content ingestion and processing from various sources.
 * - Manages content source adapters (Slack, Notion, GitHub, etc.)
 * - Syncs content from external sources
 * - Processes content items (summarization, embedding, relationship extraction)
 */

import { Context, Effect, HashMap, Layer, Option, Ref } from 'effect';
import {
  ContentAdapterNotFoundError,
  ContentProcessingError,
  ContentSourceAuthError,
  type ContentSourceNotFoundError,
  ContentSourceSyncError,
} from '../../errors';
import { AI } from '../ai';
import { Embedding } from '../embedding';
import { ContentRepository, type ContentRepositoryService } from './content-repository';
import type {
  AdapterFetchOptions,
  ContentItem,
  ContentSource,
  ContentSourceAdapter,
  ContentSourceType,
  CreateContentItemInput,
  RawContentItem,
  SyncProgress,
} from './types';

// =============================================================================
// Service Interface
// =============================================================================

export interface ContentProcessorService {
  /**
   * Register a content source adapter
   */
  registerAdapter(adapter: ContentSourceAdapter): Effect.Effect<void>;

  /**
   * Get a registered adapter by source type
   */
  getAdapter(sourceType: ContentSourceType): Effect.Effect<ContentSourceAdapter, ContentAdapterNotFoundError>;

  /**
   * List all registered adapters
   */
  listAdapters(): Effect.Effect<ContentSourceType[]>;

  /**
   * Sync content from a source
   */
  syncSource(
    sourceId: string,
    options?: AdapterFetchOptions,
  ): Effect.Effect<
    SyncProgress,
    ContentSourceNotFoundError | ContentAdapterNotFoundError | ContentSourceSyncError | ContentSourceAuthError
  >;

  /**
   * Process a content item (generate embeddings, summary, etc.)
   */
  processItem(itemId: string): Effect.Effect<ContentItem, ContentProcessingError | ContentSourceNotFoundError>;

  /**
   * Process multiple items in batch
   */
  processItemsBatch(
    itemIds: string[],
    options?: { concurrency?: number },
  ): Effect.Effect<
    { processed: number; failed: number; errors: Array<{ itemId: string; error: string }> },
    ContentProcessingError
  >;

  /**
   * Get sync progress for a source
   */
  getSyncProgress(sourceId: string): Effect.Effect<SyncProgress | null>;
}

// =============================================================================
// Service Tag
// =============================================================================

export class ContentProcessor extends Context.Tag('ContentProcessor')<ContentProcessor, ContentProcessorService>() {}

// =============================================================================
// Service Implementation
// =============================================================================

interface ContentProcessorDeps {
  readonly contentRepository: ContentRepositoryService;
  readonly embedding: Context.Tag.Service<Embedding>;
  readonly ai: Context.Tag.Service<AI>;
}

/**
 * Internal helper to process a content item - extracted for reuse in batch processing
 */
const processItemEffect = (
  deps: ContentProcessorDeps,
  itemId: string,
): Effect.Effect<ContentItem, ContentProcessingError | ContentSourceNotFoundError> => {
  const { contentRepository, embedding, ai } = deps;

  const processContent = (item: ContentItem) =>
    Effect.gen(function* () {
      // Update status to processing
      yield* contentRepository.updateItem(itemId, {
        processingStatus: 'processing',
        processingError: null,
      });

      let summary: string | undefined;

      // Generate summary if we have content
      if (item.content && item.content.length > 100) {
        const summaryResult = yield* ai.generateVideoSummary(item.content).pipe(Effect.option);
        if (Option.isSome(summaryResult)) {
          summary = summaryResult.value;
        }
      }

      // Prepare search text
      const searchText = [item.title, item.content, item.authorName, ...(item.tags as string[])]
        .filter(Boolean)
        .join(' ')
        .slice(0, 10000); // Limit to 10k chars for indexing

      // Generate embedding for semantic search (optional, ignore errors)
      yield* embedding.generateEmbedding(searchText || item.title || 'Untitled content').pipe(Effect.option);

      // Update item with processed data
      const updated = yield* contentRepository.updateItem(itemId, {
        processingStatus: 'completed',
        processingError: null,
        processedAt: new Date(),
        summary,
        searchText,
      });

      return updated;
    });

  return Effect.gen(function* () {
    // Get the item - map DatabaseError to ContentProcessingError
    const itemResult = yield* contentRepository.getItemOption(itemId).pipe(
      Effect.mapError(
        (err) =>
          new ContentProcessingError({
            message: err.message,
            itemId,
            stage: 'extracting',
            cause: err,
          }),
      ),
    );

    if (Option.isNone(itemResult)) {
      return yield* Effect.fail(
        new ContentProcessingError({
          message: `Content item not found: ${itemId}`,
          itemId,
          stage: 'extracting',
        }),
      );
    }

    const item = itemResult.value;

    // Process the item with proper error handling
    const result = yield* processContent(item).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          // Mark as failed (ignore errors from status update)
          yield* contentRepository
            .updateItem(itemId, {
              processingStatus: 'failed',
              processingError: error instanceof Error ? error.message : String(error),
            })
            .pipe(Effect.ignore);

          return yield* Effect.fail(
            new ContentProcessingError({
              message: error instanceof Error ? error.message : 'Processing failed',
              itemId,
              cause: error,
            }),
          );
        }),
      ),
    );

    return result;
  });
};

const makeContentProcessor = (
  deps: ContentProcessorDeps,
  adaptersRef: Ref.Ref<HashMap.HashMap<ContentSourceType, ContentSourceAdapter>>,
  syncProgressRef: Ref.Ref<HashMap.HashMap<string, SyncProgress>>,
): ContentProcessorService => ({
  registerAdapter: (adapter) => Ref.update(adaptersRef, (map) => HashMap.set(map, adapter.sourceType, adapter)),

  getAdapter: (sourceType) =>
    Effect.gen(function* () {
      const adapters = yield* Ref.get(adaptersRef);
      const adapter = HashMap.get(adapters, sourceType);

      if (Option.isNone(adapter)) {
        return yield* Effect.fail(
          new ContentAdapterNotFoundError({
            message: `No adapter registered for source type: ${sourceType}`,
            sourceType,
          }),
        );
      }

      return adapter.value;
    }),

  listAdapters: () =>
    Effect.gen(function* () {
      const adapters = yield* Ref.get(adaptersRef);
      return Array.from(HashMap.keys(adapters));
    }),

  syncSource: (sourceId, options) =>
    Effect.gen(function* () {
      const { contentRepository } = deps;

      // Get the source - map DatabaseError to ContentSourceSyncError
      const source = yield* contentRepository.getSource(sourceId).pipe(
        Effect.mapError((err) => {
          if ('_tag' in err && err._tag === 'ContentSourceNotFoundError') {
            return err;
          }
          return new ContentSourceSyncError({
            message: err.message,
            sourceId,
            sourceType: 'video', // Default, will be overwritten if source is found
            cause: err,
          });
        }),
      );

      // Get the adapter for this source type
      const adapters = yield* Ref.get(adaptersRef);
      const adapterOption = HashMap.get(adapters, source.type);

      if (Option.isNone(adapterOption)) {
        return yield* Effect.fail(
          new ContentAdapterNotFoundError({
            message: `No adapter registered for source type: ${source.type}`,
            sourceType: source.type,
          }),
        );
      }

      const adapter = adapterOption.value;

      // Initialize sync progress
      const initialProgress: SyncProgress = {
        sourceId,
        status: 'running',
        itemsProcessed: 0,
        errors: [],
        startedAt: new Date(),
      };

      yield* Ref.update(syncProgressRef, (map) => HashMap.set(map, sourceId, initialProgress));

      // Helper to map database errors to sync errors
      const mapDbError = <A>(effect: Effect.Effect<A, unknown>) =>
        effect.pipe(
          Effect.mapError((err) =>
            err instanceof ContentSourceSyncError
              ? err
              : new ContentSourceSyncError({
                  message: err instanceof Error ? err.message : 'Database error',
                  sourceId,
                  sourceType: source.type,
                  cause: err,
                }),
          ),
        );

      // Update source status
      yield* mapDbError(
        contentRepository.updateSource(sourceId, {
          syncStatus: 'syncing',
          errorMessage: null,
        }),
      );

      // Validate credentials first
      const isValid = yield* adapter.validateCredentials(source);
      if (!isValid) {
        return yield* Effect.fail(
          new ContentSourceAuthError({
            message: 'Invalid credentials for content source',
            sourceId,
            sourceType: source.type,
          }),
        );
      }

      // Fetch content from the source
      let cursor: string | undefined;
      let hasMore = true;
      let totalProcessed = 0;
      const errors: Array<{ message: string; itemId?: string }> = [];

      while (hasMore) {
        const result = yield* adapter.fetchContent(source, {
          ...options,
          cursor,
        });

        // Process each item
        for (const rawItem of result.items) {
          const itemResult = yield* processRawItem(deps, source, rawItem).pipe(Effect.either);
          if (itemResult._tag === 'Left') {
            errors.push({
              message: itemResult.left.message,
              itemId: rawItem.externalId,
            });
          } else {
            totalProcessed++;
          }
        }

        // Update progress
        yield* Ref.update(syncProgressRef, (map) =>
          HashMap.set(map, sourceId, {
            ...initialProgress,
            itemsProcessed: totalProcessed,
            errors,
          }),
        );

        cursor = result.nextCursor;
        hasMore = result.hasMore;
      }

      // Mark sync as complete
      const finalProgress: SyncProgress = {
        sourceId,
        status: errors.length > 0 ? 'failed' : 'completed',
        itemsProcessed: totalProcessed,
        errors,
        startedAt: initialProgress.startedAt,
        completedAt: new Date(),
      };

      yield* Ref.update(syncProgressRef, (map) => HashMap.set(map, sourceId, finalProgress));

      yield* mapDbError(
        contentRepository.updateSource(sourceId, {
          syncStatus: 'idle',
          errorMessage: errors.length > 0 ? `Sync completed with ${errors.length} errors` : null,
        }),
      );

      return finalProgress;
    }),

  processItem: (itemId) => processItemEffect(deps, itemId),

  processItemsBatch: (itemIds, options = {}) =>
    Effect.gen(function* () {
      const concurrency = options.concurrency ?? 5;
      let processed = 0;
      let failed = 0;
      const errors: Array<{ itemId: string; error: string }> = [];

      // Process items with controlled concurrency using the internal processItemEffect
      yield* Effect.forEach(
        itemIds,
        (itemId) =>
          Effect.gen(function* () {
            const result = yield* processItemEffect(deps, itemId).pipe(Effect.either);

            if (result._tag === 'Left') {
              failed++;
              errors.push({
                itemId,
                error: result.left.message,
              });
            } else {
              processed++;
            }
          }),
        { concurrency },
      );

      return { processed, failed, errors };
    }),

  getSyncProgress: (sourceId) =>
    Effect.gen(function* () {
      const progressMap = yield* Ref.get(syncProgressRef);
      const progress = HashMap.get(progressMap, sourceId);
      return Option.isSome(progress) ? progress.value : null;
    }),
});

/**
 * Process a raw content item from an adapter into a stored content item
 */
const processRawItem = (
  deps: ContentProcessorDeps,
  source: ContentSource,
  raw: RawContentItem,
): Effect.Effect<ContentItem, ContentSourceSyncError> =>
  Effect.gen(function* () {
    const { contentRepository } = deps;

    // Create the content item input
    const input: CreateContentItemInput = {
      organizationId: source.organizationId,
      sourceId: source.id,
      type: raw.type,
      externalId: raw.externalId,
      title: raw.title,
      content: raw.content,
      contentHtml: raw.contentHtml,
      authorExternal: raw.authorExternal,
      authorName: raw.authorName,
      createdAtSource: raw.createdAtSource,
      updatedAtSource: raw.updatedAtSource,
      metadata: raw.metadata,
      tags: raw.tags,
    };

    // Upsert the item (create or update if already exists)
    const item = yield* contentRepository.upsertItem(input).pipe(
      Effect.mapError(
        (err) =>
          new ContentSourceSyncError({
            message: `Failed to upsert content item: ${err.message}`,
            sourceId: source.id,
            sourceType: source.type,
            cause: err,
          }),
      ),
    );

    // Create participants if provided
    if (raw.participants && raw.participants.length > 0) {
      yield* contentRepository
        .createParticipantsBatch(
          raw.participants.map((p) => ({
            contentItemId: item.id,
            externalId: p.externalId,
            name: p.name,
            email: p.email,
            role: p.role,
          })),
        )
        .pipe(
          Effect.catchAll(() => Effect.succeed([])), // Ignore participant errors
        );
    }

    return item;
  });

// =============================================================================
// Layer
// =============================================================================

export const ContentProcessorLive = Layer.effect(
  ContentProcessor,
  Effect.gen(function* () {
    const contentRepository = yield* ContentRepository;
    const embedding = yield* Embedding;
    const ai = yield* AI;

    const adaptersRef = yield* Ref.make(HashMap.empty<ContentSourceType, ContentSourceAdapter>());
    const syncProgressRef = yield* Ref.make(HashMap.empty<string, SyncProgress>());

    return makeContentProcessor({ contentRepository, embedding, ai }, adaptersRef, syncProgressRef);
  }),
);

// =============================================================================
// Convenience Functions
// =============================================================================

export const registerContentAdapter = (adapter: ContentSourceAdapter) =>
  Effect.gen(function* () {
    const processor = yield* ContentProcessor;
    return yield* processor.registerAdapter(adapter);
  });

export const syncContentSource = (sourceId: string, options?: AdapterFetchOptions) =>
  Effect.gen(function* () {
    const processor = yield* ContentProcessor;
    return yield* processor.syncSource(sourceId, options);
  });

export const processContentItem = (itemId: string) =>
  Effect.gen(function* () {
    const processor = yield* ContentProcessor;
    return yield* processor.processItem(itemId);
  });

export const processContentItemsBatch = (itemIds: string[], options?: { concurrency?: number }) =>
  Effect.gen(function* () {
    const processor = yield* ContentProcessor;
    return yield* processor.processItemsBatch(itemIds, options);
  });

export const getContentSyncProgress = (sourceId: string) =>
  Effect.gen(function* () {
    const processor = yield* ContentProcessor;
    return yield* processor.getSyncProgress(sourceId);
  });
