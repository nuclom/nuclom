import { eq } from 'drizzle-orm';
import { Cause, Effect, Exit, Option, Schema } from 'effect';
import { type NextRequest, NextResponse } from 'next/server';
import {
  createPublicLayer,
  generatePresignedThumbnailUrl,
  generatePresignedVideoUrl,
  mapErrorToApiResponse,
  Storage,
} from '@/lib/api-handler';
import { CachePresets, getCacheControlHeader } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { videos } from '@/lib/db/schema';
import { DatabaseError, NotFoundError, ValidationError, VideoRepository } from '@/lib/effect';
import { releaseVideoCount } from '@/lib/effect/services/billing-middleware';
import { BillingRepository } from '@/lib/effect/services/billing-repository';
import type { UpdateVideoInput } from '@/lib/effect/services/video-repository';
import type { ApiResponse } from '@/lib/types';
import { validateRequestBody } from '@/lib/validation';

// =============================================================================
// GET /api/videos/[id] - Get video details
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);

    // Use Drizzle query builder for nested relations
    const videoData = yield* Effect.tryPromise({
      try: () =>
        db.query.videos.findFirst({
          where: eq(videos.id, resolvedParams.id),
          with: {
            author: true,
            organization: true,
          },
        }),
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch video',
          operation: 'getVideo',
          cause: error,
        }),
    });

    if (!videoData) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'Video not found',
          entity: 'Video',
          id: resolvedParams.id,
        }),
      );
    }

    // Generate presigned URLs for video and thumbnail
    const storage = yield* Storage;
    const [presignedThumbnailUrl, presignedVideoUrl] = yield* Effect.all([
      generatePresignedThumbnailUrl(storage, videoData.thumbnailUrl),
      generatePresignedVideoUrl(storage, videoData.videoUrl),
    ]);

    return {
      ...videoData,
      thumbnailUrl: presignedThumbnailUrl,
      videoUrl: presignedVideoUrl,
    };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      return error._tag === 'Some'
        ? mapErrorToApiResponse(error.value)
        : mapErrorToApiResponse(new Error('Internal server error'));
    },
    onSuccess: (data) => {
      const response: ApiResponse = {
        success: true,
        data,
      };
      // Use short cache with stale-while-revalidate for video details
      // AI analysis data is included, so it benefits from caching
      return NextResponse.json(response, {
        headers: {
          'Cache-Control': getCacheControlHeader(CachePresets.shortWithSwr()),
        },
      });
    },
  });
}

// =============================================================================
// PUT /api/videos/[id] - Update video
// =============================================================================

const TranscriptSegmentSchema = Schema.Struct({
  startTime: Schema.Number,
  endTime: Schema.Number,
  text: Schema.String,
  confidence: Schema.optional(Schema.Number),
});

const ActionItemSchema = Schema.Struct({
  text: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  priority: Schema.optional(Schema.Literal('high', 'medium', 'low')),
});

const UpdateVideoBodySchema = Schema.Struct({
  title: Schema.optional(Schema.String),
  description: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  duration: Schema.optional(Schema.String),
  thumbnailUrl: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  videoUrl: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  transcript: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  transcriptSegments: Schema.optional(Schema.Union(Schema.Array(TranscriptSegmentSchema), Schema.Null)),
  processingStatus: Schema.optional(
    Schema.Literal('pending', 'transcribing', 'diarizing', 'analyzing', 'completed', 'failed'),
  ),
  processingError: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  aiSummary: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  aiTags: Schema.optional(Schema.Union(Schema.Array(Schema.String), Schema.Null)),
  aiActionItems: Schema.optional(Schema.Union(Schema.Array(ActionItemSchema), Schema.Null)),
  deletedAt: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  retentionUntil: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
});

const parseDateField = (
  value: string | null | undefined,
  field: string,
): Effect.Effect<Date | null | undefined, ValidationError> =>
  Effect.try({
    try: () => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        throw new Error('Invalid date');
      }
      return parsed;
    },
    catch: () =>
      new ValidationError({
        message: `${field} must be a valid ISO date`,
      }),
  });

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);

    const body = yield* validateRequestBody(UpdateVideoBodySchema, request);
    const deletedAt = yield* parseDateField(body.deletedAt, 'deletedAt');
    const retentionUntil = yield* parseDateField(body.retentionUntil, 'retentionUntil');
    const aiTags = body.aiTags ? [...body.aiTags] : body.aiTags;
    const aiActionItems = body.aiActionItems ? body.aiActionItems.map((item) => ({ ...item })) : body.aiActionItems;
    const transcriptSegments = body.transcriptSegments
      ? body.transcriptSegments.map((segment) => ({ ...segment }))
      : body.transcriptSegments;

    const updateData: UpdateVideoInput = {
      title: body.title,
      description: body.description,
      duration: body.duration,
      thumbnailUrl: body.thumbnailUrl,
      videoUrl: body.videoUrl,
      transcript: body.transcript,
      transcriptSegments,
      processingStatus: body.processingStatus,
      processingError: body.processingError,
      aiSummary: body.aiSummary,
      aiTags,
      aiActionItems,
      deletedAt,
      retentionUntil,
    };

    // Update video using repository
    const videoRepo = yield* VideoRepository;
    yield* videoRepo.updateVideo(resolvedParams.id, updateData);

    // Fetch updated video with relations
    const videoData = yield* Effect.tryPromise({
      try: () =>
        db.query.videos.findFirst({
          where: eq(videos.id, resolvedParams.id),
          with: {
            author: true,
            organization: true,
          },
        }),
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch updated video',
          operation: 'updateVideo',
          cause: error,
        }),
    });

    if (!videoData) return videoData;

    // Generate presigned URLs for video and thumbnail
    const storage = yield* Storage;
    const [presignedThumbnailUrl, presignedVideoUrl] = yield* Effect.all([
      generatePresignedThumbnailUrl(storage, videoData.thumbnailUrl),
      generatePresignedVideoUrl(storage, videoData.videoUrl),
    ]);

    return {
      ...videoData,
      thumbnailUrl: presignedThumbnailUrl,
      videoUrl: presignedVideoUrl,
    };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      return error._tag === 'Some'
        ? mapErrorToApiResponse(error.value)
        : mapErrorToApiResponse(new Error('Internal server error'));
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
// DELETE /api/videos/[id] - Delete video
// =============================================================================

/**
 * DELETE /api/videos/[id]
 *
 * By default, performs a soft delete with a 30-day retention period.
 * Query parameters:
 * - permanent=true: Permanently delete the video and clean up R2 storage
 * - retentionDays=N: Override the default retention period (only for soft delete)
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const url = new URL(request.url);
  const permanent = url.searchParams.get('permanent') === 'true';
  const retentionDaysParam = url.searchParams.get('retentionDays');
  const retentionDays = retentionDaysParam ? Number.parseInt(retentionDaysParam, 10) : undefined;

  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);

    const videoRepo = yield* VideoRepository;
    const video = yield* videoRepo.getVideo(resolvedParams.id);

    if (permanent) {
      // Permanently delete video and clean up R2 storage
      yield* videoRepo.deleteVideo(resolvedParams.id);

      // Release usage tracking for the organization
      const billingRepo = yield* BillingRepository;
      const subscriptionOption = yield* billingRepo.getSubscriptionOption(video.organizationId);

      if (Option.isSome(subscriptionOption)) {
        yield* releaseVideoCount(video.organizationId).pipe(Effect.catchAll(() => Effect.void));
      }

      return { message: 'Video permanently deleted' };
    }
    // Soft delete with retention period
    const deletedVideo = yield* videoRepo.softDeleteVideo(resolvedParams.id, { retentionDays });
    return {
      message: 'Video moved to trash',
      deletedAt: deletedVideo.deletedAt,
      retentionUntil: deletedVideo.retentionUntil,
    };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      return error._tag === 'Some'
        ? mapErrorToApiResponse(error.value)
        : mapErrorToApiResponse(new Error('Internal server error'));
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
