/**
 * User Presence Service using Effect-TS
 *
 * Provides real-time presence tracking for collaboration features:
 * - Track who is viewing a video
 * - Show cursor positions and typing indicators
 * - Manage user status (online, away, busy)
 */

import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { Context, Effect, Layer } from 'effect';
import { userPresence, users } from '@/lib/db/schema';
import { DatabaseError } from '../errors';
import { Database } from './database';

// =============================================================================
// Types
// =============================================================================

export interface PresenceUpdate {
  readonly videoId?: string;
  readonly status?: 'online' | 'away' | 'busy';
  readonly currentTime?: number;
  readonly metadata?: {
    cursorPosition?: number;
    isTyping?: boolean;
  };
}

export interface UserPresenceInfo {
  readonly userId: string;
  readonly userName: string;
  readonly userImage: string | null;
  readonly status: string;
  readonly videoId: string | null;
  readonly currentTime: number | null;
  readonly lastSeen: Date;
  readonly metadata: { cursorPosition?: number; isTyping?: boolean } | null;
}

export interface PresenceServiceInterface {
  /**
   * Update user presence
   */
  readonly updatePresence: (
    userId: string,
    organizationId: string,
    update: PresenceUpdate,
  ) => Effect.Effect<void, DatabaseError>;

  /**
   * Get all users present on a video
   */
  readonly getVideoPresence: (videoId: string) => Effect.Effect<UserPresenceInfo[], DatabaseError>;

  /**
   * Get all online users in an organization
   */
  readonly getOrganizationPresence: (organizationId: string) => Effect.Effect<UserPresenceInfo[], DatabaseError>;

  /**
   * Remove stale presence records (cleanup)
   */
  readonly cleanupStalePresence: (maxAgeMinutes?: number) => Effect.Effect<number, DatabaseError>;

  /**
   * Set user as offline
   */
  readonly setOffline: (userId: string) => Effect.Effect<void, DatabaseError>;

  /**
   * Get users typing on a video
   */
  readonly getTypingUsers: (videoId: string) => Effect.Effect<UserPresenceInfo[], DatabaseError>;

  /**
   * Heartbeat to keep presence alive
   */
  readonly heartbeat: (userId: string, organizationId: string) => Effect.Effect<void, DatabaseError>;
}

// =============================================================================
// Presence Service Tag
// =============================================================================

export class Presence extends Context.Tag('Presence')<Presence, PresenceServiceInterface>() {}

// =============================================================================
// Presence Service Implementation
// =============================================================================

const makePresenceService = Effect.gen(function* () {
  const { db } = yield* Database;

  // Consider users online if seen in last 2 minutes
  const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

  const updatePresence = (
    userId: string,
    organizationId: string,
    update: PresenceUpdate,
  ): Effect.Effect<void, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const now = new Date();

        // Check if user already has a presence record
        const existing = await db
          .select({ id: userPresence.id })
          .from(userPresence)
          .where(eq(userPresence.userId, userId))
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(userPresence)
            .set({
              videoId: update.videoId ?? null,
              status: update.status ?? 'online',
              currentTime: update.currentTime ?? null,
              metadata: update.metadata ?? null,
              lastSeen: now,
              organizationId,
            })
            .where(eq(userPresence.userId, userId));
        } else {
          await db.insert(userPresence).values({
            userId,
            organizationId,
            videoId: update.videoId ?? null,
            status: update.status ?? 'online',
            currentTime: update.currentTime ?? null,
            metadata: update.metadata ?? null,
            lastSeen: now,
          });
        }
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to update presence',
          operation: 'updatePresence',
          cause: error,
        }),
    });

  const getVideoPresence = (videoId: string): Effect.Effect<UserPresenceInfo[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const threshold = new Date(Date.now() - ONLINE_THRESHOLD_MS);

        const presenceData = await db
          .select({
            userId: userPresence.userId,
            userName: users.name,
            userImage: users.image,
            status: userPresence.status,
            videoId: userPresence.videoId,
            currentTime: userPresence.currentTime,
            lastSeen: userPresence.lastSeen,
            metadata: userPresence.metadata,
          })
          .from(userPresence)
          .innerJoin(users, eq(userPresence.userId, users.id))
          .where(and(eq(userPresence.videoId, videoId), gt(userPresence.lastSeen, threshold)))
          .orderBy(desc(userPresence.lastSeen));

        return presenceData.map((p) => ({
          userId: p.userId,
          userName: p.userName,
          userImage: p.userImage,
          status: p.status,
          videoId: p.videoId,
          currentTime: p.currentTime,
          lastSeen: p.lastSeen,
          metadata: p.metadata,
        }));
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get video presence',
          operation: 'getVideoPresence',
          cause: error,
        }),
    });

  const getOrganizationPresence = (organizationId: string): Effect.Effect<UserPresenceInfo[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const threshold = new Date(Date.now() - ONLINE_THRESHOLD_MS);

        const presenceData = await db
          .select({
            userId: userPresence.userId,
            userName: users.name,
            userImage: users.image,
            status: userPresence.status,
            videoId: userPresence.videoId,
            currentTime: userPresence.currentTime,
            lastSeen: userPresence.lastSeen,
            metadata: userPresence.metadata,
          })
          .from(userPresence)
          .innerJoin(users, eq(userPresence.userId, users.id))
          .where(and(eq(userPresence.organizationId, organizationId), gt(userPresence.lastSeen, threshold)))
          .orderBy(desc(userPresence.lastSeen));

        return presenceData.map((p) => ({
          userId: p.userId,
          userName: p.userName,
          userImage: p.userImage,
          status: p.status,
          videoId: p.videoId,
          currentTime: p.currentTime,
          lastSeen: p.lastSeen,
          metadata: p.metadata,
        }));
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get organization presence',
          operation: 'getOrganizationPresence',
          cause: error,
        }),
    });

  const cleanupStalePresence = (maxAgeMinutes = 30): Effect.Effect<number, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const threshold = new Date(Date.now() - maxAgeMinutes * 60 * 1000);

        const result = await db
          .delete(userPresence)
          .where(sql`${userPresence.lastSeen} < ${threshold}`)
          .returning({ id: userPresence.id });

        return result.length;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to cleanup stale presence',
          operation: 'cleanupStalePresence',
          cause: error,
        }),
    });

  const setOffline = (userId: string): Effect.Effect<void, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        await db.delete(userPresence).where(eq(userPresence.userId, userId));
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to set user offline',
          operation: 'setOffline',
          cause: error,
        }),
    });

  const getTypingUsers = (videoId: string): Effect.Effect<UserPresenceInfo[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const threshold = new Date(Date.now() - ONLINE_THRESHOLD_MS);

        const presenceData = await db
          .select({
            userId: userPresence.userId,
            userName: users.name,
            userImage: users.image,
            status: userPresence.status,
            videoId: userPresence.videoId,
            currentTime: userPresence.currentTime,
            lastSeen: userPresence.lastSeen,
            metadata: userPresence.metadata,
          })
          .from(userPresence)
          .innerJoin(users, eq(userPresence.userId, users.id))
          .where(
            and(
              eq(userPresence.videoId, videoId),
              gt(userPresence.lastSeen, threshold),
              sql`(${userPresence.metadata}->>'isTyping')::boolean = true`,
            ),
          );

        return presenceData.map((p) => ({
          userId: p.userId,
          userName: p.userName,
          userImage: p.userImage,
          status: p.status,
          videoId: p.videoId,
          currentTime: p.currentTime,
          lastSeen: p.lastSeen,
          metadata: p.metadata,
        }));
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get typing users',
          operation: 'getTypingUsers',
          cause: error,
        }),
    });

  const heartbeat = (userId: string, _organizationId: string): Effect.Effect<void, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        await db.update(userPresence).set({ lastSeen: new Date() }).where(eq(userPresence.userId, userId));
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to update heartbeat',
          operation: 'heartbeat',
          cause: error,
        }),
    });

  return {
    updatePresence,
    getVideoPresence,
    getOrganizationPresence,
    cleanupStalePresence,
    setOffline,
    getTypingUsers,
    heartbeat,
  } satisfies PresenceServiceInterface;
});

// =============================================================================
// Presence Layer
// =============================================================================

export const PresenceLive = Layer.effect(Presence, makePresenceService);

// =============================================================================
// Helper Functions
// =============================================================================

export const updatePresence = (
  userId: string,
  organizationId: string,
  update: PresenceUpdate,
): Effect.Effect<void, DatabaseError, Presence> =>
  Effect.gen(function* () {
    const service = yield* Presence;
    return yield* service.updatePresence(userId, organizationId, update);
  });

export const getVideoPresence = (videoId: string): Effect.Effect<UserPresenceInfo[], DatabaseError, Presence> =>
  Effect.gen(function* () {
    const service = yield* Presence;
    return yield* service.getVideoPresence(videoId);
  });

export const getOrganizationPresence = (
  organizationId: string,
): Effect.Effect<UserPresenceInfo[], DatabaseError, Presence> =>
  Effect.gen(function* () {
    const service = yield* Presence;
    return yield* service.getOrganizationPresence(organizationId);
  });
