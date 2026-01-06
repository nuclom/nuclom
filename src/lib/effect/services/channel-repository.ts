/**
 * Channel Repository Service using Effect-TS
 *
 * Provides type-safe database operations for channels.
 */

import { desc, eq } from 'drizzle-orm';
import { Context, Effect, Layer } from 'effect';
import { channels, videos } from '@/lib/db/schema';
import type { PaginatedResponse } from '@/lib/types';
import { DatabaseError, NotFoundError } from '../errors';
import { Database } from './database';

// =============================================================================
// Types
// =============================================================================

export interface CreateChannelInput {
  readonly name: string;
  readonly description?: string;
  readonly organizationId: string;
}

export interface UpdateChannelInput {
  readonly name?: string;
  readonly description?: string | null;
}

export interface ChannelWithVideoCount {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly organizationId: string;
  readonly memberCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly videoCount: number;
}

// =============================================================================
// Channel Repository Service Interface
// =============================================================================

export interface ChannelRepositoryService {
  /**
   * Get paginated channels for an organization
   */
  readonly getChannels: (
    organizationId: string,
    page?: number,
    limit?: number,
  ) => Effect.Effect<PaginatedResponse<ChannelWithVideoCount>, DatabaseError>;

  /**
   * Get a single channel by ID
   */
  readonly getChannel: (id: string) => Effect.Effect<typeof channels.$inferSelect, DatabaseError | NotFoundError>;

  /**
   * Create a new channel
   */
  readonly createChannel: (data: CreateChannelInput) => Effect.Effect<typeof channels.$inferSelect, DatabaseError>;

  /**
   * Update a channel
   */
  readonly updateChannel: (
    id: string,
    data: UpdateChannelInput,
  ) => Effect.Effect<typeof channels.$inferSelect, DatabaseError | NotFoundError>;

  /**
   * Delete a channel
   */
  readonly deleteChannel: (id: string) => Effect.Effect<void, DatabaseError | NotFoundError>;

  /**
   * Get videos in a channel
   */
  readonly getChannelVideos: (
    channelId: string,
    page?: number,
    limit?: number,
  ) => Effect.Effect<PaginatedResponse<typeof videos.$inferSelect>, DatabaseError>;
}

// =============================================================================
// Channel Repository Tag
// =============================================================================

export class ChannelRepository extends Context.Tag('ChannelRepository')<
  ChannelRepository,
  ChannelRepositoryService
>() {}

// =============================================================================
// Channel Repository Implementation
// =============================================================================

const makeChannelRepositoryService = Effect.gen(function* () {
  const { db } = yield* Database;

  const getChannels = (
    organizationId: string,
    page = 1,
    limit = 20,
  ): Effect.Effect<PaginatedResponse<ChannelWithVideoCount>, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const offset = (page - 1) * limit;

        const channelsData = await db
          .select()
          .from(channels)
          .where(eq(channels.organizationId, organizationId))
          .orderBy(desc(channels.createdAt))
          .offset(offset)
          .limit(limit);

        // Get video counts for each channel
        const channelsWithCounts = await Promise.all(
          channelsData.map(async (channel) => {
            const videoCount = await db.select().from(videos).where(eq(videos.channelId, channel.id));
            return {
              ...channel,
              videoCount: videoCount.length,
            };
          }),
        );

        const totalCount = await db.select().from(channels).where(eq(channels.organizationId, organizationId));

        return {
          data: channelsWithCounts,
          pagination: {
            page,
            limit,
            total: totalCount.length,
            totalPages: Math.ceil(totalCount.length / limit),
          },
        };
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch channels',
          operation: 'getChannels',
          cause: error,
        }),
    });

  const getChannel = (id: string): Effect.Effect<typeof channels.$inferSelect, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: () => db.select().from(channels).where(eq(channels.id, id)).limit(1),
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to fetch channel',
            operation: 'getChannel',
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Channel not found',
            entity: 'Channel',
            id,
          }),
        );
      }

      return result[0];
    });

  const createChannel = (data: CreateChannelInput): Effect.Effect<typeof channels.$inferSelect, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const [newChannel] = await db
          .insert(channels)
          .values({
            name: data.name,
            description: data.description,
            organizationId: data.organizationId,
          })
          .returning();
        return newChannel;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to create channel',
          operation: 'createChannel',
          cause: error,
        }),
    });

  const updateChannel = (
    id: string,
    data: UpdateChannelInput,
  ): Effect.Effect<typeof channels.$inferSelect, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .update(channels)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(channels.id, id))
            .returning();
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to update channel',
            operation: 'updateChannel',
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Channel not found',
            entity: 'Channel',
            id,
          }),
        );
      }

      return result[0];
    });

  const deleteChannel = (id: string): Effect.Effect<void, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      // First, unassign videos from this channel
      yield* Effect.tryPromise({
        try: async () => {
          await db.update(videos).set({ channelId: null }).where(eq(videos.channelId, id));
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to unassign videos from channel',
            operation: 'deleteChannel.unassignVideos',
            cause: error,
          }),
      });

      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db.delete(channels).where(eq(channels.id, id)).returning();
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to delete channel',
            operation: 'deleteChannel',
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Channel not found',
            entity: 'Channel',
            id,
          }),
        );
      }
    });

  const getChannelVideos = (
    channelId: string,
    page = 1,
    limit = 20,
  ): Effect.Effect<PaginatedResponse<typeof videos.$inferSelect>, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const offset = (page - 1) * limit;

        const videosData = await db
          .select()
          .from(videos)
          .where(eq(videos.channelId, channelId))
          .orderBy(desc(videos.createdAt))
          .offset(offset)
          .limit(limit);

        const totalCount = await db.select().from(videos).where(eq(videos.channelId, channelId));

        return {
          data: videosData,
          pagination: {
            page,
            limit,
            total: totalCount.length,
            totalPages: Math.ceil(totalCount.length / limit),
          },
        };
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch channel videos',
          operation: 'getChannelVideos',
          cause: error,
        }),
    });

  return {
    getChannels,
    getChannel,
    createChannel,
    updateChannel,
    deleteChannel,
    getChannelVideos,
  } satisfies ChannelRepositoryService;
});

// =============================================================================
// Channel Repository Layer
// =============================================================================

export const ChannelRepositoryLive = Layer.effect(ChannelRepository, makeChannelRepositoryService);

// =============================================================================
// Channel Repository Helper Functions
// =============================================================================

export const getChannels = (
  organizationId: string,
  page?: number,
  limit?: number,
): Effect.Effect<PaginatedResponse<ChannelWithVideoCount>, DatabaseError, ChannelRepository> =>
  Effect.gen(function* () {
    const repo = yield* ChannelRepository;
    return yield* repo.getChannels(organizationId, page, limit);
  });

export const getChannel = (
  id: string,
): Effect.Effect<typeof channels.$inferSelect, DatabaseError | NotFoundError, ChannelRepository> =>
  Effect.gen(function* () {
    const repo = yield* ChannelRepository;
    return yield* repo.getChannel(id);
  });

export const createChannel = (
  data: CreateChannelInput,
): Effect.Effect<typeof channels.$inferSelect, DatabaseError, ChannelRepository> =>
  Effect.gen(function* () {
    const repo = yield* ChannelRepository;
    return yield* repo.createChannel(data);
  });

export const updateChannel = (
  id: string,
  data: UpdateChannelInput,
): Effect.Effect<typeof channels.$inferSelect, DatabaseError | NotFoundError, ChannelRepository> =>
  Effect.gen(function* () {
    const repo = yield* ChannelRepository;
    return yield* repo.updateChannel(id, data);
  });

export const deleteChannel = (id: string): Effect.Effect<void, DatabaseError | NotFoundError, ChannelRepository> =>
  Effect.gen(function* () {
    const repo = yield* ChannelRepository;
    return yield* repo.deleteChannel(id);
  });

export const getChannelVideos = (
  channelId: string,
  page?: number,
  limit?: number,
): Effect.Effect<PaginatedResponse<typeof videos.$inferSelect>, DatabaseError, ChannelRepository> =>
  Effect.gen(function* () {
    const repo = yield* ChannelRepository;
    return yield* repo.getChannelVideos(channelId, page, limit);
  });
