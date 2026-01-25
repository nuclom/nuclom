import {
  Auth,
  generatePresignedThumbnailUrl,
  generatePresignedVideoUrl,
  handleEffectExitWithOptions,
  runApiEffect,
  Storage,
} from '@nuclom/lib/api-handler';
import { ForbiddenError, ValidationError } from '@nuclom/lib/effect/errors';
import { revalidateVideo } from '@nuclom/lib/effect/server';
import { releaseVideoCount } from '@nuclom/lib/effect/services/billing-middleware';
import { BillingRepository } from '@nuclom/lib/effect/services/billing-repository';
import { VideoRepository } from '@nuclom/lib/effect/services/video-repository';
import type { UpdateVideoInput } from '@nuclom/lib/effect/services/video-repository.types';
import { validateRequestBody } from '@nuclom/lib/validation';
import { Effect, Option, Schema } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// GET /api/videos/[id] - Get video details
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);

    // Fetch video using repository (includes author and organization)
    const videoRepo = yield* VideoRepository;
    const videoData = yield* videoRepo.getVideo(resolvedParams.id);

    // Try to get user ID from session (may be null for unauthenticated requests)
    const authService = yield* Auth;
    const userId = yield* authService.getSession(request.headers).pipe(
      Effect.map((session) => session.user.id),
      Effect.catchAll(() => Effect.succeed(null)),
    );

    // Check access based on visibility
    const accessCheck = yield* videoRepo.canAccessVideo(resolvedParams.id, userId);

    if (!accessCheck.canAccess) {
      return yield* Effect.fail(
        new ForbiddenError({
          message: 'You do not have access to this video',
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
      accessLevel: accessCheck.accessLevel,
    };
  });

  const exit = await runApiEffect(effect);
  return handleEffectExitWithOptions(exit, {
    successHeaders: {
      // Dynamic cache based on visibility - set by middleware or computed at response time
      'Cache-Control': 'private, no-cache',
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
  visibility: Schema.optional(Schema.Literal('private', 'organization', 'public')),
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
    // Authenticate user - only authors can update videos
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const resolvedParams = yield* Effect.promise(() => params);

    // Check if user has permission to update (must be author)
    const videoRepo = yield* VideoRepository;
    const accessCheck = yield* videoRepo.canAccessVideo(resolvedParams.id, user.id);

    if (!accessCheck.canAccess || accessCheck.accessLevel !== 'download') {
      return yield* Effect.fail(
        new ForbiddenError({
          message: 'Only the video author can update the video',
        }),
      );
    }

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
      visibility: body.visibility,
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
    yield* videoRepo.updateVideo(resolvedParams.id, updateData);

    // Invalidate cache for this video
    revalidateVideo(resolvedParams.id);

    // Fetch updated video with relations using repository
    const videoData = yield* videoRepo.getVideo(resolvedParams.id);

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

  const exit = await runApiEffect(effect);
  return handleEffectExitWithOptions(exit, { successStatus: 200 });
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
    // Authenticate user - only authors can delete videos
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const resolvedParams = yield* Effect.promise(() => params);

    const videoRepo = yield* VideoRepository;

    // Check if user has permission to delete (must be author)
    const accessCheck = yield* videoRepo.canAccessVideo(resolvedParams.id, user.id);

    if (!accessCheck.canAccess || accessCheck.accessLevel !== 'download') {
      return yield* Effect.fail(
        new ForbiddenError({
          message: 'Only the video author can delete the video',
        }),
      );
    }

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

  const exit = await runApiEffect(effect);
  return handleEffectExitWithOptions(exit, { successStatus: 200 });
}
