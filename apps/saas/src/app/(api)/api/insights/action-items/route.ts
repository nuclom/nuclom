import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { Cause, Effect, Exit, Schema } from 'effect';
import { type NextRequest, NextResponse } from 'next/server';
import {
  Auth,
  createFullLayer,
  generatePresignedThumbnailUrl,
  mapErrorToApiResponse,
  Storage,
} from '@/lib/api-handler';
import { db } from '@/lib/db';
import { aiActionItems, videos } from '@/lib/db/schema';
import { DatabaseError, UnauthorizedError } from '@/lib/effect';
import type { ApiResponse } from '@/lib/types';
import { validateQueryParams, validateRequestBody } from '@/lib/validation';

// =============================================================================
// Query Schema
// =============================================================================

const getQuerySchema = Schema.Struct({
  organizationId: Schema.String,
  period: Schema.optionalWith(Schema.Literal('7d', '30d', '90d', 'all'), { default: () => '30d' as const }),
  status: Schema.optional(Schema.Literal('pending', 'in_progress', 'completed', 'cancelled')),
  priority: Schema.optional(Schema.Literal('high', 'medium', 'low')),
  assigneeUserId: Schema.optional(Schema.String),
  videoId: Schema.optional(Schema.String),
  page: Schema.optionalWith(Schema.NumberFromString.pipe(Schema.int(), Schema.positive()), { default: () => 1 }),
  limit: Schema.optionalWith(Schema.NumberFromString.pipe(Schema.int(), Schema.between(1, 100)), {
    default: () => 20,
  }),
});

const createActionItemSchema = Schema.Struct({
  organizationId: Schema.String,
  videoId: Schema.String,
  title: Schema.String.pipe(Schema.maxLength(500)),
  description: Schema.optional(Schema.String.pipe(Schema.maxLength(2000))),
  assignee: Schema.optional(Schema.String),
  assigneeUserId: Schema.optional(Schema.String),
  priority: Schema.optionalWith(Schema.Literal('high', 'medium', 'low'), { default: () => 'medium' as const }),
  dueDate: Schema.optional(Schema.String), // ISO date string
  timestampStart: Schema.optional(Schema.Number),
  timestampEnd: Schema.optional(Schema.Number),
  confidence: Schema.optional(Schema.Number.pipe(Schema.between(0, 100))),
  extractedFrom: Schema.optional(Schema.String),
});

// =============================================================================
// GET /api/insights/action-items - Get organization-wide action items
// =============================================================================

export async function GET(request: NextRequest) {
  const FullLayer = createFullLayer();

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Validate query params
    const params = yield* validateQueryParams(getQuerySchema, request.url);
    const { organizationId, period, status, priority, assigneeUserId, videoId, page, limit } = params;

    // Verify user belongs to organization
    const isMember = yield* Effect.tryPromise({
      try: () =>
        db.query.members.findFirst({
          where: (members, { and, eq }) => and(eq(members.userId, user.id), eq(members.organizationId, organizationId)),
        }),
      catch: () =>
        new DatabaseError({
          message: 'Failed to verify membership',
          operation: 'checkMembership',
        }),
    });

    if (!isMember) {
      return yield* Effect.fail(
        new UnauthorizedError({
          message: 'You are not a member of this organization',
        }),
      );
    }

    // Calculate date ranges
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0); // All time
    }

    // Build where conditions
    const conditions = [eq(aiActionItems.organizationId, organizationId), gte(aiActionItems.createdAt, startDate)];

    if (status) {
      conditions.push(eq(aiActionItems.status, status));
    }
    if (priority) {
      conditions.push(eq(aiActionItems.priority, priority));
    }
    if (assigneeUserId) {
      conditions.push(eq(aiActionItems.assigneeUserId, assigneeUserId));
    }
    if (videoId) {
      conditions.push(eq(aiActionItems.videoId, videoId));
    }

    const offset = (page - 1) * limit;

    // Get action items with video info
    const actionItemsResult = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            actionItem: aiActionItems,
            video: {
              id: videos.id,
              title: videos.title,
              thumbnailUrl: videos.thumbnailUrl,
            },
          })
          .from(aiActionItems)
          .leftJoin(videos, eq(aiActionItems.videoId, videos.id))
          .where(and(...conditions))
          .orderBy(
            // Sort by priority (high first) then by creation date
            sql`CASE
              WHEN ${aiActionItems.priority} = 'high' THEN 1
              WHEN ${aiActionItems.priority} = 'medium' THEN 2
              ELSE 3
            END`,
            desc(aiActionItems.createdAt),
          )
          .limit(limit)
          .offset(offset),
      catch: () =>
        new DatabaseError({
          message: 'Failed to fetch action items',
          operation: 'getActionItems',
        }),
    });

    // Get total count for pagination
    const countResult = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ count: sql<number>`count(*)` })
          .from(aiActionItems)
          .where(and(...conditions)),
      catch: () =>
        new DatabaseError({
          message: 'Failed to count action items',
          operation: 'countActionItems',
        }),
    });
    const totalCount = Number(countResult[0]?.count) || 0;

    // Get stats by status
    const statsResult = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            status: aiActionItems.status,
            count: sql<number>`count(*)`,
          })
          .from(aiActionItems)
          .where(and(eq(aiActionItems.organizationId, organizationId), gte(aiActionItems.createdAt, startDate)))
          .groupBy(aiActionItems.status),
      catch: () =>
        new DatabaseError({
          message: 'Failed to fetch action items stats',
          operation: 'getActionItemsStats',
        }),
    });

    const statsByStatus = Object.fromEntries(statsResult.map((s) => [s.status, Number(s.count)]));

    // Generate presigned URLs for video thumbnails
    const storage = yield* Storage;
    const actionItemsWithPresignedUrls = yield* Effect.all(
      actionItemsResult.map((row) =>
        Effect.gen(function* () {
          const presignedThumbnailUrl = row.video?.thumbnailUrl
            ? yield* generatePresignedThumbnailUrl(storage, row.video.thumbnailUrl)
            : null;
          return {
            ...row.actionItem,
            video: row.video
              ? {
                  ...row.video,
                  thumbnailUrl: presignedThumbnailUrl,
                }
              : null,
          };
        }),
      ),
      { concurrency: 10 },
    );

    return {
      actionItems: actionItemsWithPresignedUrls,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: page * limit < totalCount,
      },
      stats: {
        pending: statsByStatus.pending || 0,
        inProgress: statsByStatus.in_progress || 0,
        completed: statsByStatus.completed || 0,
        cancelled: statsByStatus.cancelled || 0,
        total: Object.values(statsByStatus).reduce((a, b) => a + b, 0),
      },
      period,
    };
  });

  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === 'Some') {
        return mapErrorToApiResponse(error.value);
      }
      return mapErrorToApiResponse(new Error('Internal server error'));
    },
    onSuccess: (data) => {
      const response: ApiResponse = {
        success: true,
        data,
      };
      return NextResponse.json(response);
    },
  });
}

// =============================================================================
// POST /api/insights/action-items - Create a new action item
// =============================================================================

export async function POST(request: NextRequest) {
  const FullLayer = createFullLayer();

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Validate request body
    const data = yield* validateRequestBody(createActionItemSchema, request);

    // Verify user belongs to organization
    const isMember = yield* Effect.tryPromise({
      try: () =>
        db.query.members.findFirst({
          where: (members, { and, eq }) =>
            and(eq(members.userId, user.id), eq(members.organizationId, data.organizationId)),
        }),
      catch: () =>
        new DatabaseError({
          message: 'Failed to verify membership',
          operation: 'checkMembership',
        }),
    });

    if (!isMember) {
      return yield* Effect.fail(
        new UnauthorizedError({
          message: 'You are not a member of this organization',
        }),
      );
    }

    // Create action item
    const actionItem = yield* Effect.tryPromise({
      try: () =>
        db
          .insert(aiActionItems)
          .values({
            organizationId: data.organizationId,
            videoId: data.videoId,
            title: data.title,
            description: data.description ?? null,
            assignee: data.assignee ?? null,
            assigneeUserId: data.assigneeUserId ?? null,
            priority: data.priority,
            dueDate: data.dueDate ? new Date(data.dueDate) : null,
            timestampStart: data.timestampStart ?? null,
            timestampEnd: data.timestampEnd ?? null,
            confidence: data.confidence ?? null,
            extractedFrom: data.extractedFrom ?? null,
          })
          .returning(),
      catch: () =>
        new DatabaseError({
          message: 'Failed to create action item',
          operation: 'createActionItem',
        }),
    });

    return actionItem[0];
  });

  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === 'Some') {
        return mapErrorToApiResponse(error.value);
      }
      return mapErrorToApiResponse(new Error('Internal server error'));
    },
    onSuccess: (data) => {
      const response: ApiResponse = {
        success: true,
        data,
      };
      return NextResponse.json(response, { status: 201 });
    },
  });
}
