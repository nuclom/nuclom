import {
  Auth,
  generatePresignedThumbnailUrl,
  handleEffectExit,
  handleEffectExitWithStatus,
  runApiEffect,
  Storage,
} from '@nuclom/lib/api-handler';
import { ActionItemRepository, OrganizationRepository } from '@nuclom/lib/effect';
import { validateQueryParams, validateRequestBody } from '@nuclom/lib/validation';
import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';

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
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Validate query params
    const params = yield* validateQueryParams(getQuerySchema, request.url);
    const { organizationId, period, status, priority, assigneeUserId, videoId, page, limit } = params;

    // Verify user belongs to organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, organizationId);

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

    // Get action items and stats using the repository
    const actionItemRepo = yield* ActionItemRepository;

    const [{ items: actionItemsResult, totalCount }, stats] = yield* Effect.all(
      [
        actionItemRepo.getActionItems({
          organizationId,
          startDate,
          status,
          priority,
          assigneeUserId,
          videoId,
          page,
          limit,
        }),
        actionItemRepo.getActionItemStats(organizationId, startDate),
      ],
      { concurrency: 2 },
    );

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
      stats,
      period,
    };
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}

// =============================================================================
// POST /api/insights/action-items - Create a new action item
// =============================================================================

export async function POST(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Validate request body
    const data = yield* validateRequestBody(createActionItemSchema, request);

    // Verify user belongs to organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, data.organizationId);

    // Create action item
    const actionItemRepo = yield* ActionItemRepository;
    const actionItem = yield* actionItemRepo.createActionItem({
      organizationId: data.organizationId,
      videoId: data.videoId,
      title: data.title,
      description: data.description,
      assignee: data.assignee,
      assigneeUserId: data.assigneeUserId,
      priority: data.priority,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      timestampStart: data.timestampStart,
      timestampEnd: data.timestampEnd,
      confidence: data.confidence,
      extractedFrom: data.extractedFrom,
    });

    return actionItem;
  });

  const exit = await runApiEffect(effect);
  return handleEffectExitWithStatus(exit, 201);
}
