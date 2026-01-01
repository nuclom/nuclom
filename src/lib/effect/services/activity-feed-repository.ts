/**
 * Activity Feed Repository Service using Effect-TS
 *
 * Provides type-safe database operations for organization activity feeds.
 */

import { and, desc, eq, type SQL, sql } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import type { ActivityFeed, ActivityType, User } from "@/lib/db/schema";
import { activityFeed, users } from "@/lib/db/schema";
import { DatabaseError } from "../errors";
import { Database } from "./database";

// =============================================================================
// Types
// =============================================================================

export interface ActivityWithActor extends ActivityFeed {
  actor: Pick<User, "id" | "name" | "email" | "image"> | null;
}

export interface CreateActivityInput {
  readonly organizationId: string;
  readonly actorId?: string;
  readonly activityType: ActivityType;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface ActivityFeedFilters {
  readonly activityTypes?: ActivityType[];
  readonly actorId?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly startDate?: Date;
  readonly endDate?: Date;
}

// =============================================================================
// Activity Feed Repository Interface
// =============================================================================

export interface ActivityFeedRepositoryService {
  /**
   * Get activity feed for an organization
   */
  readonly getActivityFeed: (
    organizationId: string,
    page?: number,
    limit?: number,
    filters?: ActivityFeedFilters,
  ) => Effect.Effect<{ data: ActivityWithActor[]; total: number }, DatabaseError>;

  /**
   * Create a new activity entry
   */
  readonly createActivity: (data: CreateActivityInput) => Effect.Effect<ActivityFeed, DatabaseError>;

  /**
   * Create activity for video upload
   */
  readonly logVideoUploaded: (
    organizationId: string,
    actorId: string,
    videoId: string,
    videoTitle: string,
  ) => Effect.Effect<ActivityFeed, DatabaseError>;

  /**
   * Create activity for video processing complete
   */
  readonly logVideoProcessed: (
    organizationId: string,
    actorId: string | null,
    videoId: string,
    videoTitle: string,
  ) => Effect.Effect<ActivityFeed, DatabaseError>;

  /**
   * Create activity for video sharing
   */
  readonly logVideoShared: (
    organizationId: string,
    actorId: string,
    videoId: string,
    videoTitle: string,
    sharedWith?: string,
  ) => Effect.Effect<ActivityFeed, DatabaseError>;

  /**
   * Create activity for comment added
   */
  readonly logCommentAdded: (
    organizationId: string,
    actorId: string,
    videoId: string,
    commentId: string,
    videoTitle: string,
  ) => Effect.Effect<ActivityFeed, DatabaseError>;

  /**
   * Create activity for comment reply
   */
  readonly logCommentReply: (
    organizationId: string,
    actorId: string,
    videoId: string,
    commentId: string,
    parentCommentId: string,
    videoTitle: string,
  ) => Effect.Effect<ActivityFeed, DatabaseError>;

  /**
   * Create activity for reaction added
   */
  readonly logReactionAdded: (
    organizationId: string,
    actorId: string,
    commentId: string,
    reactionType: string,
    videoId: string,
  ) => Effect.Effect<ActivityFeed, DatabaseError>;

  /**
   * Create activity for member joined
   */
  readonly logMemberJoined: (
    organizationId: string,
    memberId: string,
    memberName: string,
    memberEmail: string,
  ) => Effect.Effect<ActivityFeed, DatabaseError>;

  /**
   * Create activity for member left
   */
  readonly logMemberLeft: (
    organizationId: string,
    memberId: string,
    memberName: string,
  ) => Effect.Effect<ActivityFeed, DatabaseError>;

  /**
   * Create activity for integration connected
   */
  readonly logIntegrationConnected: (
    organizationId: string,
    actorId: string,
    provider: string,
  ) => Effect.Effect<ActivityFeed, DatabaseError>;

  /**
   * Create activity for integration disconnected
   */
  readonly logIntegrationDisconnected: (
    organizationId: string,
    actorId: string,
    provider: string,
  ) => Effect.Effect<ActivityFeed, DatabaseError>;

  /**
   * Create activity for video imported
   */
  readonly logVideoImported: (
    organizationId: string,
    actorId: string,
    videoId: string,
    videoTitle: string,
    source: string,
  ) => Effect.Effect<ActivityFeed, DatabaseError>;

  /**
   * Get recent activities count by type
   */
  readonly getActivityStats: (
    organizationId: string,
    days?: number,
  ) => Effect.Effect<{ type: ActivityType; count: number }[], DatabaseError>;
}

// =============================================================================
// Activity Feed Repository Tag
// =============================================================================

export class ActivityFeedRepository extends Context.Tag("ActivityFeedRepository")<
  ActivityFeedRepository,
  ActivityFeedRepositoryService
>() {}

// =============================================================================
// Activity Feed Repository Implementation
// =============================================================================

const makeActivityFeedRepositoryService = Effect.gen(function* () {
  const { db } = yield* Database;

  const getActivityFeed = (
    organizationId: string,
    page = 1,
    limit = 20,
    filters?: ActivityFeedFilters,
  ): Effect.Effect<{ data: ActivityWithActor[]; total: number }, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const offset = (page - 1) * limit;

        // Build where conditions
        const conditions: SQL[] = [eq(activityFeed.organizationId, organizationId)];

        if (filters?.activityTypes && filters.activityTypes.length > 0) {
          conditions.push(
            sql`${activityFeed.activityType} IN (${sql.join(
              filters.activityTypes.map((t) => sql`${t}`),
              sql`, `,
            )})`,
          );
        }

        if (filters?.actorId) {
          conditions.push(eq(activityFeed.actorId, filters.actorId));
        }

        if (filters?.resourceType) {
          conditions.push(eq(activityFeed.resourceType, filters.resourceType));
        }

        if (filters?.resourceId) {
          conditions.push(eq(activityFeed.resourceId, filters.resourceId));
        }

        if (filters?.startDate) {
          conditions.push(sql`${activityFeed.createdAt} >= ${filters.startDate}`);
        }

        if (filters?.endDate) {
          conditions.push(sql`${activityFeed.createdAt} <= ${filters.endDate}`);
        }

        const whereClause = and(...conditions);

        const [activities, totalResult] = await Promise.all([
          db
            .select({
              id: activityFeed.id,
              organizationId: activityFeed.organizationId,
              actorId: activityFeed.actorId,
              activityType: activityFeed.activityType,
              resourceType: activityFeed.resourceType,
              resourceId: activityFeed.resourceId,
              metadata: activityFeed.metadata,
              createdAt: activityFeed.createdAt,
              actor: {
                id: users.id,
                name: users.name,
                email: users.email,
                image: users.image,
              },
            })
            .from(activityFeed)
            .leftJoin(users, eq(activityFeed.actorId, users.id))
            .where(whereClause)
            .orderBy(desc(activityFeed.createdAt))
            .limit(limit)
            .offset(offset),
          db.select({ count: sql<number>`count(*)::int` }).from(activityFeed).where(whereClause),
        ]);

        return {
          data: activities as ActivityWithActor[],
          total: totalResult[0]?.count ?? 0,
        };
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch activity feed",
          operation: "getActivityFeed",
          cause: error,
        }),
    });

  const createActivity = (data: CreateActivityInput): Effect.Effect<ActivityFeed, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const [activity] = await db.insert(activityFeed).values(data).returning();
        return activity;
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to create activity",
          operation: "createActivity",
          cause: error,
        }),
    });

  const logVideoUploaded = (
    organizationId: string,
    actorId: string,
    videoId: string,
    videoTitle: string,
  ): Effect.Effect<ActivityFeed, DatabaseError> =>
    createActivity({
      organizationId,
      actorId,
      activityType: "video_uploaded",
      resourceType: "video",
      resourceId: videoId,
      metadata: { videoTitle },
    });

  const logVideoProcessed = (
    organizationId: string,
    actorId: string | null,
    videoId: string,
    videoTitle: string,
  ): Effect.Effect<ActivityFeed, DatabaseError> =>
    createActivity({
      organizationId,
      actorId: actorId ?? undefined,
      activityType: "video_processed",
      resourceType: "video",
      resourceId: videoId,
      metadata: { videoTitle },
    });

  const logVideoShared = (
    organizationId: string,
    actorId: string,
    videoId: string,
    videoTitle: string,
    sharedWith?: string,
  ): Effect.Effect<ActivityFeed, DatabaseError> =>
    createActivity({
      organizationId,
      actorId,
      activityType: "video_shared",
      resourceType: "video",
      resourceId: videoId,
      metadata: { videoTitle, sharedWith },
    });

  const logCommentAdded = (
    organizationId: string,
    actorId: string,
    videoId: string,
    commentId: string,
    videoTitle: string,
  ): Effect.Effect<ActivityFeed, DatabaseError> =>
    createActivity({
      organizationId,
      actorId,
      activityType: "comment_added",
      resourceType: "comment",
      resourceId: commentId,
      metadata: { videoId, videoTitle },
    });

  const logCommentReply = (
    organizationId: string,
    actorId: string,
    videoId: string,
    commentId: string,
    parentCommentId: string,
    videoTitle: string,
  ): Effect.Effect<ActivityFeed, DatabaseError> =>
    createActivity({
      organizationId,
      actorId,
      activityType: "comment_reply",
      resourceType: "comment",
      resourceId: commentId,
      metadata: { videoId, videoTitle, parentCommentId },
    });

  const logReactionAdded = (
    organizationId: string,
    actorId: string,
    commentId: string,
    reactionType: string,
    videoId: string,
  ): Effect.Effect<ActivityFeed, DatabaseError> =>
    createActivity({
      organizationId,
      actorId,
      activityType: "reaction_added",
      resourceType: "comment",
      resourceId: commentId,
      metadata: { reactionType, videoId },
    });

  const logMemberJoined = (
    organizationId: string,
    memberId: string,
    memberName: string,
    memberEmail: string,
  ): Effect.Effect<ActivityFeed, DatabaseError> =>
    createActivity({
      organizationId,
      actorId: memberId,
      activityType: "member_joined",
      resourceType: "member",
      resourceId: memberId,
      metadata: { memberName, memberEmail },
    });

  const logMemberLeft = (
    organizationId: string,
    memberId: string,
    memberName: string,
  ): Effect.Effect<ActivityFeed, DatabaseError> =>
    createActivity({
      organizationId,
      actorId: memberId,
      activityType: "member_left",
      resourceType: "member",
      resourceId: memberId,
      metadata: { memberName },
    });

  const logIntegrationConnected = (
    organizationId: string,
    actorId: string,
    provider: string,
  ): Effect.Effect<ActivityFeed, DatabaseError> =>
    createActivity({
      organizationId,
      actorId,
      activityType: "integration_connected",
      resourceType: "integration",
      metadata: { provider },
    });

  const logIntegrationDisconnected = (
    organizationId: string,
    actorId: string,
    provider: string,
  ): Effect.Effect<ActivityFeed, DatabaseError> =>
    createActivity({
      organizationId,
      actorId,
      activityType: "integration_disconnected",
      resourceType: "integration",
      metadata: { provider },
    });

  const logVideoImported = (
    organizationId: string,
    actorId: string,
    videoId: string,
    videoTitle: string,
    source: string,
  ): Effect.Effect<ActivityFeed, DatabaseError> =>
    createActivity({
      organizationId,
      actorId,
      activityType: "video_imported",
      resourceType: "video",
      resourceId: videoId,
      metadata: { videoTitle, source },
    });

  const getActivityStats = (
    organizationId: string,
    days = 30,
  ): Effect.Effect<{ type: ActivityType; count: number }[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const result = await db
          .select({
            type: activityFeed.activityType,
            count: sql<number>`count(*)::int`,
          })
          .from(activityFeed)
          .where(and(eq(activityFeed.organizationId, organizationId), sql`${activityFeed.createdAt} >= ${startDate}`))
          .groupBy(activityFeed.activityType);

        return result as { type: ActivityType; count: number }[];
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to get activity stats",
          operation: "getActivityStats",
          cause: error,
        }),
    });

  return {
    getActivityFeed,
    createActivity,
    logVideoUploaded,
    logVideoProcessed,
    logVideoShared,
    logCommentAdded,
    logCommentReply,
    logReactionAdded,
    logMemberJoined,
    logMemberLeft,
    logIntegrationConnected,
    logIntegrationDisconnected,
    logVideoImported,
    getActivityStats,
  } satisfies ActivityFeedRepositoryService;
});

// =============================================================================
// Activity Feed Repository Layer
// =============================================================================

export const ActivityFeedRepositoryLive = Layer.effect(ActivityFeedRepository, makeActivityFeedRepositoryService);

// =============================================================================
// Activity Feed Repository Helper Functions
// =============================================================================

export const getActivityFeed = (
  organizationId: string,
  page?: number,
  limit?: number,
  filters?: ActivityFeedFilters,
): Effect.Effect<{ data: ActivityWithActor[]; total: number }, DatabaseError, ActivityFeedRepository> =>
  Effect.gen(function* () {
    const repo = yield* ActivityFeedRepository;
    return yield* repo.getActivityFeed(organizationId, page, limit, filters);
  });

export const createActivity = (
  data: CreateActivityInput,
): Effect.Effect<ActivityFeed, DatabaseError, ActivityFeedRepository> =>
  Effect.gen(function* () {
    const repo = yield* ActivityFeedRepository;
    return yield* repo.createActivity(data);
  });

export const logVideoUploaded = (
  organizationId: string,
  actorId: string,
  videoId: string,
  videoTitle: string,
): Effect.Effect<ActivityFeed, DatabaseError, ActivityFeedRepository> =>
  Effect.gen(function* () {
    const repo = yield* ActivityFeedRepository;
    return yield* repo.logVideoUploaded(organizationId, actorId, videoId, videoTitle);
  });

export const logVideoProcessed = (
  organizationId: string,
  actorId: string | null,
  videoId: string,
  videoTitle: string,
): Effect.Effect<ActivityFeed, DatabaseError, ActivityFeedRepository> =>
  Effect.gen(function* () {
    const repo = yield* ActivityFeedRepository;
    return yield* repo.logVideoProcessed(organizationId, actorId, videoId, videoTitle);
  });

export const logVideoShared = (
  organizationId: string,
  actorId: string,
  videoId: string,
  videoTitle: string,
  sharedWith?: string,
): Effect.Effect<ActivityFeed, DatabaseError, ActivityFeedRepository> =>
  Effect.gen(function* () {
    const repo = yield* ActivityFeedRepository;
    return yield* repo.logVideoShared(organizationId, actorId, videoId, videoTitle, sharedWith);
  });

export const logCommentAdded = (
  organizationId: string,
  actorId: string,
  videoId: string,
  commentId: string,
  videoTitle: string,
): Effect.Effect<ActivityFeed, DatabaseError, ActivityFeedRepository> =>
  Effect.gen(function* () {
    const repo = yield* ActivityFeedRepository;
    return yield* repo.logCommentAdded(organizationId, actorId, videoId, commentId, videoTitle);
  });

export const logMemberJoined = (
  organizationId: string,
  memberId: string,
  memberName: string,
  memberEmail: string,
): Effect.Effect<ActivityFeed, DatabaseError, ActivityFeedRepository> =>
  Effect.gen(function* () {
    const repo = yield* ActivityFeedRepository;
    return yield* repo.logMemberJoined(organizationId, memberId, memberName, memberEmail);
  });

export const logIntegrationConnected = (
  organizationId: string,
  actorId: string,
  provider: string,
): Effect.Effect<ActivityFeed, DatabaseError, ActivityFeedRepository> =>
  Effect.gen(function* () {
    const repo = yield* ActivityFeedRepository;
    return yield* repo.logIntegrationConnected(organizationId, actorId, provider);
  });

export const getActivityStats = (
  organizationId: string,
  days?: number,
): Effect.Effect<{ type: ActivityType; count: number }[], DatabaseError, ActivityFeedRepository> =>
  Effect.gen(function* () {
    const repo = yield* ActivityFeedRepository;
    return yield* repo.getActivityStats(organizationId, days);
  });
