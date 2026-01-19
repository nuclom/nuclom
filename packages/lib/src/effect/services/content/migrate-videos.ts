/**
 * Video Migration Script
 *
 * This script migrates existing videos to the content abstraction layer.
 * It creates a video content source for each organization and syncs all videos.
 *
 * Usage:
 * ```typescript
 * import { migrateAllVideos, migrateOrganizationVideos } from './migrate-videos';
 *
 * // Migrate all organizations
 * await Effect.runPromise(Effect.provide(migrateAllVideos(), AppLive));
 *
 * // Or migrate a specific organization
 * await Effect.runPromise(Effect.provide(migrateOrganizationVideos('org-123'), AppLive));
 * ```
 */

import { eq, sql } from 'drizzle-orm';
import { Effect } from 'effect';
import { videos } from '../../../db/schema';
import { Database } from '../database';
import { ContentRepository } from './content-repository';
import { createVideoContentAdapter } from './video-content-adapter';

/**
 * Migration result for reporting
 */
export interface MigrationResult {
  organizationId: string;
  sourceId: string;
  videosProcessed: number;
  videosFailed: number;
  errors: Array<{ videoId: string; error: string }>;
}

/**
 * Migrate all videos for a specific organization to the content system
 */
export const migrateOrganizationVideos = (organizationId: string) =>
  Effect.gen(function* () {
    const database = yield* Database;
    const db = database.db;
    const repo = yield* ContentRepository;

    // Create or get the video content source for this organization
    const existingSources = yield* repo.getSources({
      organizationId,
      type: 'video',
    });

    const source =
      existingSources.length > 0
        ? existingSources[0]
        : yield* repo.createSource({
            organizationId,
            type: 'video',
            name: 'Videos',
            config: {
              syncInterval: 0, // Videos are synced on-demand
            },
          });

    // Get all videos for this organization
    const orgVideos = yield* Effect.tryPromise({
      try: () =>
        db.query.videos.findMany({
          where: eq(videos.organizationId, organizationId),
        }),
      catch: (error) => new Error(`Failed to fetch videos: ${error}`),
    });

    const result: MigrationResult = {
      organizationId,
      sourceId: source.id,
      videosProcessed: 0,
      videosFailed: 0,
      errors: [],
    };

    const adapter = createVideoContentAdapter(db);

    // Process each video
    for (const video of orgVideos) {
      try {
        const rawItem = yield* adapter.fetchItem(source, video.id);

        if (rawItem) {
          yield* repo.upsertItem({
            organizationId,
            sourceId: source.id,
            type: rawItem.type,
            externalId: rawItem.externalId,
            title: rawItem.title,
            content: rawItem.content,
            createdAtSource: rawItem.createdAtSource,
            updatedAtSource: rawItem.updatedAtSource,
            metadata: rawItem.metadata,
            tags: rawItem.tags,
          });

          result.videosProcessed++;
        }
      } catch (error) {
        result.videosFailed++;
        result.errors.push({
          videoId: video.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Update the source sync status
    yield* repo.updateSource(source.id, {
      syncStatus: result.videosFailed > 0 ? 'error' : 'idle',
      errorMessage: result.videosFailed > 0 ? `Migration completed with ${result.videosFailed} errors` : null,
    });

    return result;
  });

/**
 * Migrate all videos across all organizations
 */
export const migrateAllVideos = () =>
  Effect.gen(function* () {
    const database = yield* Database;
    const db = database.db;

    // Get all organization IDs that have videos
    const orgsWithVideos = yield* Effect.tryPromise({
      try: () => db.select({ organizationId: videos.organizationId }).from(videos).groupBy(videos.organizationId),
      catch: (error) => new Error(`Failed to fetch organizations: ${error}`),
    });

    const results: MigrationResult[] = [];

    for (const { organizationId } of orgsWithVideos) {
      const result = yield* migrateOrganizationVideos(organizationId);
      results.push(result);
    }

    return {
      totalOrganizations: results.length,
      totalVideosProcessed: results.reduce((sum, r) => sum + r.videosProcessed, 0),
      totalVideosFailed: results.reduce((sum, r) => sum + r.videosFailed, 0),
      results,
    };
  });

/**
 * Get migration status for an organization
 */
export const getMigrationStatus = (organizationId: string) =>
  Effect.gen(function* () {
    const database = yield* Database;
    const db = database.db;
    const repo = yield* ContentRepository;

    // Count videos in the videos table
    const [{ videoCount }] = yield* Effect.tryPromise({
      try: () =>
        db.select({ videoCount: sql<number>`count(*)` }).from(videos).where(eq(videos.organizationId, organizationId)),
      catch: (error) => new Error(`Failed to count videos: ${error}`),
    });

    // Get the video content source
    const sources = yield* repo.getSources({
      organizationId,
      type: 'video',
    });

    if (sources.length === 0) {
      return {
        organizationId,
        totalVideos: Number(videoCount),
        migratedVideos: 0,
        pendingVideos: Number(videoCount),
        migrationComplete: false,
        hasSource: false,
      };
    }

    const source = sources[0];

    // Count content items for this source
    const items = yield* repo.getItems(
      {
        organizationId,
        sourceId: source.id,
      },
      { limit: 0 },
    );

    return {
      organizationId,
      sourceId: source.id,
      totalVideos: Number(videoCount),
      migratedVideos: items.total,
      pendingVideos: Number(videoCount) - items.total,
      migrationComplete: items.total >= Number(videoCount),
      hasSource: true,
      syncStatus: source.syncStatus,
    };
  });

/**
 * Clean up duplicate content items (if any exist from failed migrations)
 */
export const cleanupDuplicates = (organizationId: string) =>
  Effect.gen(function* () {
    const database = yield* Database;
    const db = database.db;

    // This would use raw SQL to remove duplicates, keeping the most recent
    // For now, we rely on the unique constraint to prevent duplicates
    yield* Effect.tryPromise({
      try: () =>
        db.execute(sql`
          DELETE FROM content_items a
          USING content_items b
          WHERE a.id < b.id
            AND a.source_id = b.source_id
            AND a.external_id = b.external_id
            AND a.organization_id = ${organizationId}
        `),
      catch: (error) => new Error(`Failed to cleanup duplicates: ${error}`),
    });

    return { success: true };
  });
