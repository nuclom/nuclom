/**
 * Video Content Adapter
 *
 * Adapter that exposes existing Nuclom videos as content items.
 * This is the "internal" adapter for the video source type.
 *
 * Unlike external adapters (Slack, Notion, etc.), this adapter reads from
 * the existing videos table and normalizes them to the content abstraction.
 */

import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { Effect, Option } from 'effect';
import { videos } from '../../../db/schema';
import { ContentSourceSyncError } from '../../errors';
import { Database, type DrizzleDB } from '../database';
import { ContentRepository } from './content-repository';
import type { ContentSourceAdapter, RawContentItem } from './types';

// =============================================================================
// Video to Content Item Mapping
// =============================================================================

/**
 * Parse duration string (HH:MM:SS or MM:SS format) to seconds
 */
function parseDuration(duration: string): number {
  const parts = duration.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

/**
 * Convert a video record to a RawContentItem
 */
function videoToRawContentItem(video: {
  id: string;
  title: string;
  transcript: string | null;
  duration: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  aiTags: string[] | null;
  authorId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): RawContentItem {
  return {
    externalId: video.id,
    type: 'video',
    title: video.title,
    content: video.transcript ?? undefined,
    createdAtSource: video.createdAt,
    updatedAtSource: video.updatedAt,
    metadata: {
      duration: parseDuration(video.duration),
      videoUrl: video.videoUrl ?? undefined,
      thumbnailUrl: video.thumbnailUrl ?? undefined,
      videoId: video.id,
    },
    tags: video.aiTags ?? undefined,
    participants: video.authorId
      ? [
          {
            externalId: video.authorId,
            name: 'Author',
            role: 'author' as const,
          },
        ]
      : undefined,
  };
}

// =============================================================================
// Adapter Implementation
// =============================================================================

/**
 * Create a VideoContentAdapter instance with an injected database connection.
 *
 * This adapter queries the videos table directly and normalizes videos
 * to the content item format.
 */
export const createVideoContentAdapter = (db: DrizzleDB): ContentSourceAdapter => ({
  sourceType: 'video',

  validateCredentials: (_source) =>
    // Video sources don't need external credentials - they're internal
    Effect.succeed(true),

  fetchContent: (source, options) =>
    Effect.tryPromise({
      try: async () => {
        // Build query conditions
        const conditions = [eq(videos.organizationId, source.organizationId)];

        if (options?.since) {
          conditions.push(gte(videos.createdAt, options.since));
        }
        if (options?.until) {
          conditions.push(lte(videos.createdAt, options.until));
        }

        // Parse cursor for pagination
        let offset = 0;
        if (options?.cursor) {
          offset = Number.parseInt(options.cursor, 10) || 0;
        }

        const limit = options?.limit ?? 50;

        // Fetch videos
        const fetchedVideos = await db.query.videos.findMany({
          where: and(...conditions),
          orderBy: desc(videos.createdAt),
          limit: limit + 1,
          offset,
        });

        const hasMore = fetchedVideos.length > limit;
        const items = hasMore ? fetchedVideos.slice(0, limit) : fetchedVideos;

        return {
          items: items.map(videoToRawContentItem),
          nextCursor: hasMore ? String(offset + limit) : undefined,
          hasMore,
        };
      },
      catch: (error) =>
        new ContentSourceSyncError({
          message: `Failed to fetch videos: ${error instanceof Error ? error.message : 'Unknown error'}`,
          sourceId: source.id,
          sourceType: 'video',
          cause: error,
        }),
    }),

  fetchItem: (source, externalId) =>
    Effect.tryPromise({
      try: async () => {
        const video = await db.query.videos.findFirst({
          where: and(eq(videos.id, externalId), eq(videos.organizationId, source.organizationId)),
        });

        return video ? videoToRawContentItem(video) : null;
      },
      catch: (error) =>
        new ContentSourceSyncError({
          message: `Failed to fetch video: ${error instanceof Error ? error.message : 'Unknown error'}`,
          sourceId: source.id,
          sourceType: 'video',
          cause: error,
        }),
    }),

  // Video sources don't need OAuth refresh
  refreshAuth: undefined,
});

// =============================================================================
// Effect-based convenience functions
// =============================================================================

/**
 * Sync a single video to the content system
 */
export const syncVideoToContent = (videoId: string, contentSourceId: string) =>
  Effect.gen(function* () {
    const { db } = yield* Database;
    const repo = yield* ContentRepository;

    // Get the video
    const video = yield* Effect.tryPromise({
      try: () =>
        db.query.videos.findFirst({
          where: eq(videos.id, videoId),
        }),
      catch: (error) =>
        new ContentSourceSyncError({
          message: `Failed to fetch video: ${error instanceof Error ? error.message : 'Unknown error'}`,
          sourceId: contentSourceId,
          sourceType: 'video',
          cause: error,
        }),
    });

    if (!video) {
      return Option.none<string>();
    }

    // Convert to content item
    const rawItem = videoToRawContentItem(video);

    // Upsert the content item
    const contentItem = yield* repo.upsertItem({
      organizationId: video.organizationId,
      sourceId: contentSourceId,
      type: rawItem.type,
      externalId: rawItem.externalId,
      title: rawItem.title,
      content: rawItem.content,
      createdAtSource: rawItem.createdAtSource,
      updatedAtSource: rawItem.updatedAtSource,
      metadata: rawItem.metadata,
      tags: rawItem.tags,
    });

    return Option.some(contentItem.id);
  });

/**
 * Create a video content source for an organization if one doesn't exist
 */
export const ensureVideoContentSource = (organizationId: string) =>
  Effect.gen(function* () {
    const repo = yield* ContentRepository;

    // Check if a video source already exists for this org
    const existingSources = yield* repo.getSources({
      organizationId,
      type: 'video',
    });

    if (existingSources.length > 0) {
      return existingSources[0];
    }

    // Create a new video content source
    const source = yield* repo.createSource({
      organizationId,
      type: 'video',
      name: 'Videos',
      config: {
        syncInterval: 0, // Videos are synced on-demand
      },
    });

    return source;
  });

// =============================================================================
// Convenience Functions for Upload Integration
// =============================================================================

/**
 * Sync a newly created video to content_items in one step.
 * This combines ensureVideoContentSource + syncVideoToContent.
 *
 * Call this after creating a video in the upload routes.
 */
export const syncNewVideoToContent = (videoId: string, organizationId: string) =>
  Effect.gen(function* () {
    // Ensure video source exists for this org
    const source = yield* ensureVideoContentSource(organizationId);

    // Sync the video to content_items
    const contentItemId = yield* syncVideoToContent(videoId, source.id);

    return contentItemId;
  }).pipe(
    // Don't fail the upload if content sync fails - just log
    Effect.catchAll((error) => {
      console.error('[Content Sync] Failed to sync video to content_items:', error);
      return Effect.succeed(Option.none<string>());
    }),
  );

/**
 * Update a content_item with processed video data (transcript, summary, tags).
 * Call this after video processing completes in the workflow.
 */
export const updateVideoContentItem = (
  videoId: string,
  organizationId: string,
  data: {
    transcript?: string;
    summary?: string;
    tags?: string[];
  },
) =>
  Effect.gen(function* () {
    const repo = yield* ContentRepository;

    // Find the content source for this org
    const sources = yield* repo.getSources({
      organizationId,
      type: 'video',
    });

    if (sources.length === 0) {
      // No content source exists, video wasn't synced
      return Option.none<string>();
    }

    const source = sources[0];

    // Find the content item by external_id (which is the video ID)
    const existingItemOption = yield* repo.getItemByExternalId(source.id, videoId);

    if (Option.isNone(existingItemOption)) {
      return Option.none<string>();
    }

    const existingItem = existingItemOption.value;

    // Update the content item with processed data
    const updatedItem = yield* repo.updateItem(existingItem.id, {
      content: data.transcript,
      summary: data.summary,
      tags: data.tags,
      processingStatus: 'completed',
      processedAt: new Date(),
    });

    return Option.some(updatedItem.id);
  }).pipe(
    // Don't fail the workflow if content update fails - just log
    Effect.catchAll((error) => {
      console.error('[Content Update] Failed to update video content_item:', error);
      return Effect.succeed(Option.none<string>());
    }),
  );

// =============================================================================
// Registration Helper
// =============================================================================

/**
 * Register the video adapter with the content processor
 */
export const registerVideoAdapter = () =>
  Effect.gen(function* () {
    const { db } = yield* Database;
    const { ContentProcessor } = yield* Effect.promise(() => import('./content-processor'));
    const processor = yield* ContentProcessor;
    const adapter = createVideoContentAdapter(db);
    yield* processor.registerAdapter(adapter);
  });
