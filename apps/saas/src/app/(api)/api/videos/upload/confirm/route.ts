/**
 * Upload Confirmation API
 *
 * Called after a file has been uploaded directly to R2 via presigned URL.
 * Creates the video record in the database and triggers processing.
 */

import { createPublicLayer, mapErrorToApiResponse } from '@nuclom/lib/api-handler';
import { auth } from '@nuclom/lib/auth';
import { Storage, ValidationError, VideoRepository } from '@nuclom/lib/effect';
import { syncNewVideoToContent } from '@nuclom/lib/effect/services';
import { trackVideoUpload } from '@nuclom/lib/effect/services/billing-middleware';
import { BillingRepository } from '@nuclom/lib/effect/services/billing-repository';
import { createLogger } from '@nuclom/lib/logger';
import type { ApiResponse } from '@nuclom/lib/types';
import { sanitizeDescription, sanitizeTitle, validate } from '@nuclom/lib/validation';
import { Effect, Option, Schema } from 'effect';

const log = createLogger('video-upload');

import { connection, type NextRequest, NextResponse } from 'next/server';
import { processVideoWorkflow } from '@/workflows/video-processing/workflow';

// =============================================================================
// Types
// =============================================================================

const ConfirmUploadRequestSchema = Schema.Struct({
  uploadId: Schema.String,
  fileKey: Schema.String,
  filename: Schema.String,
  fileSize: Schema.Number,
  title: Schema.String,
  description: Schema.optional(Schema.String),
  organizationId: Schema.String,
  authorId: Schema.String,
  skipAIProcessing: Schema.optional(Schema.Boolean),
});

const BulkConfirmUploadRequestSchema = Schema.Struct({
  uploads: Schema.Array(
    Schema.Struct({
      uploadId: Schema.String,
      fileKey: Schema.String,
      filename: Schema.String,
      fileSize: Schema.Number,
      title: Schema.String,
      description: Schema.optional(Schema.String),
    }),
  ),
  organizationId: Schema.String,
  authorId: Schema.String,
  skipAIProcessing: Schema.optional(Schema.Boolean),
});

const ConfirmUploadBodySchema = Schema.Union(ConfirmUploadRequestSchema, BulkConfirmUploadRequestSchema);
type ConfirmUploadRequest = Schema.Schema.Type<typeof ConfirmUploadRequestSchema>;
type BulkConfirmUploadRequest = Schema.Schema.Type<typeof BulkConfirmUploadRequestSchema>;

interface ConfirmUploadResponse {
  videoId: string;
  videoUrl: string;
  thumbnailUrl: string;
  processingStatus: string;
}

interface BulkConfirmUploadResponse {
  videos: Array<{
    uploadId: string;
    videoId: string;
    videoUrl: string;
    processingStatus: string;
  }>;
  succeeded: number;
  failed: number;
}

// Estimated duration for videos (will be updated during processing)
const PLACEHOLDER_DURATION = '0:00';

const isBulkConfirmUploadRequest = (
  value: ConfirmUploadRequest | BulkConfirmUploadRequest,
): value is BulkConfirmUploadRequest => 'uploads' in value;

// =============================================================================
// POST /api/videos/upload/confirm - Confirm upload and create video record
// =============================================================================

export async function POST(request: NextRequest) {
  await connection(); // Required: prevents static generation during builds

  // Verify authentication
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Parse request body
  let body: ConfirmUploadRequest | BulkConfirmUploadRequest;
  try {
    const rawBody = await request.json();
    body = await Effect.runPromise(validate(ConfirmUploadBodySchema, rawBody));
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  // Determine if this is a bulk or single confirmation request
  if (isBulkConfirmUploadRequest(body)) {
    return handleBulkConfirmation(body);
  }

  return handleSingleConfirmation(body);
}

async function handleSingleConfirmation(body: ConfirmUploadRequest) {
  const { fileKey, fileSize, title, description, organizationId, authorId, skipAIProcessing } = body;

  const effect = Effect.gen(function* () {
    const storage = yield* Storage;
    const videoRepo = yield* VideoRepository;

    // Check if storage is configured
    if (!storage.isConfigured) {
      return yield* Effect.fail(
        new ValidationError({
          message: 'Storage is not configured',
        }),
      );
    }

    // Generate presigned URL for immediate playback response
    const presignedVideoUrl = yield* storage.generatePresignedDownloadUrl(fileKey, 3600);

    // Sanitize user input
    const sanitizedTitle = sanitizeTitle(title);
    const sanitizedDescription = description ? sanitizeDescription(description) : undefined;

    // Create video record FIRST - if this fails, we don't track usage
    // This prevents billing mismatches when video creation fails
    const video = yield* videoRepo.createVideo({
      title: sanitizedTitle,
      description: sanitizedDescription,
      duration: PLACEHOLDER_DURATION,
      videoUrl: fileKey, // Store the key, not the URL
      thumbnailUrl: undefined, // Will be generated during processing
      authorId,
      organizationId,
      processingStatus: skipAIProcessing ? 'completed' : 'pending',
    });

    // Track usage AFTER video creation succeeds
    // This ensures we only bill for videos that were actually created
    // First check if organization has an active subscription to avoid NoSubscriptionError
    const billingRepo = yield* BillingRepository;
    const subscriptionOption = yield* billingRepo.getSubscriptionOption(organizationId);

    if (Option.isSome(subscriptionOption)) {
      yield* trackVideoUpload(organizationId, fileSize).pipe(
        Effect.catchAll((error) => {
          log.error('Failed to track video upload usage', error instanceof Error ? error : undefined, {
            organizationId,
            fileSize,
          });
          return Effect.succeed(undefined);
        }),
      );
    }

    // Sync video to content_items for unified knowledge base
    // This is non-blocking - failures are logged but don't fail the upload
    yield* syncNewVideoToContent(video.id, organizationId);

    return {
      videoId: video.id,
      videoUrl: presignedVideoUrl, // Return presigned URL for immediate use
      thumbnailUrl: '',
      processingStatus: video.processingStatus,
      skipAIProcessing: skipAIProcessing ?? false,
      videoTitle: sanitizedTitle,
      fileKey, // Include for workflow processing
    };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);

  if (exit._tag === 'Failure') {
    return mapErrorToApiResponse(exit.cause);
  }

  const data = exit.value;

  // Trigger AI processing using durable workflow
  if (!data.skipAIProcessing && data.videoUrl) {
    processVideoWorkflow({
      videoId: data.videoId,
      videoUrl: data.videoUrl,
      videoTitle: data.videoTitle,
      organizationId: body.organizationId,
    }).catch((err) => {
      log.error('Failed to start video processing workflow', err instanceof Error ? err : undefined, {
        videoId: data.videoId,
      });
    });
  }

  const response: ApiResponse<ConfirmUploadResponse> = {
    success: true,
    data: {
      videoId: data.videoId,
      videoUrl: data.videoUrl,
      thumbnailUrl: data.thumbnailUrl,
      processingStatus: data.processingStatus,
    },
  };

  return NextResponse.json(response, { status: 201 });
}

async function handleBulkConfirmation(body: BulkConfirmUploadRequest) {
  const { uploads, organizationId, authorId, skipAIProcessing } = body;

  const effect = Effect.gen(function* () {
    const storage = yield* Storage;
    const videoRepo = yield* VideoRepository;
    const billingRepo = yield* BillingRepository;

    // Check if storage is configured
    if (!storage.isConfigured) {
      return yield* Effect.fail(
        new ValidationError({
          message: 'Storage is not configured',
        }),
      );
    }

    // Check subscription once for all uploads (more efficient)
    const subscriptionOption = yield* billingRepo.getSubscriptionOption(organizationId);

    const results: BulkConfirmUploadResponse['videos'] = [];
    let succeeded = 0;
    let failed = 0;

    for (const upload of uploads) {
      try {
        // Generate presigned URL for response
        const presignedVideoUrl = yield* storage.generatePresignedDownloadUrl(upload.fileKey, 3600);
        const sanitizedTitle = sanitizeTitle(upload.title);
        const sanitizedDescription = upload.description ? sanitizeDescription(upload.description) : undefined;

        // Create video record FIRST - if this fails, we don't track usage
        const video = yield* videoRepo.createVideo({
          title: sanitizedTitle,
          description: sanitizedDescription,
          duration: PLACEHOLDER_DURATION,
          videoUrl: upload.fileKey, // Store the key for later presigned URL generation
          thumbnailUrl: undefined,
          authorId,
          organizationId,
          processingStatus: skipAIProcessing ? 'completed' : 'pending',
        });

        // Track usage AFTER video creation succeeds
        // Only track if organization has an active subscription
        if (Option.isSome(subscriptionOption)) {
          yield* trackVideoUpload(organizationId, upload.fileSize).pipe(
            Effect.catchAll((error) => {
              log.error('Failed to track video upload usage', error instanceof Error ? error : undefined, {
                organizationId,
                fileSize: upload.fileSize,
              });
              return Effect.succeed(undefined);
            }),
          );
        }

        // Sync video to content_items for unified knowledge base
        yield* syncNewVideoToContent(video.id, organizationId);

        results.push({
          uploadId: upload.uploadId,
          videoId: video.id,
          videoUrl: presignedVideoUrl, // Return presigned URL for immediate use
          processingStatus: video.processingStatus,
        });

        // Trigger processing for each video
        if (!skipAIProcessing) {
          processVideoWorkflow({
            videoId: video.id,
            videoUrl: presignedVideoUrl, // Pass presigned URL, not file key
            videoTitle: sanitizedTitle,
            organizationId,
          }).catch((err) => {
            log.error('Failed to start video processing workflow', err instanceof Error ? err : undefined, {
              videoId: video.id,
            });
          });
        }

        succeeded++;
      } catch (err) {
        log.error('Failed to confirm video upload', err instanceof Error ? err : undefined, {
          uploadId: upload.uploadId,
        });
        failed++;
      }
    }

    return { videos: results, succeeded, failed };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);

  if (exit._tag === 'Failure') {
    return mapErrorToApiResponse(exit.cause);
  }

  const response: ApiResponse<BulkConfirmUploadResponse> = {
    success: true,
    data: exit.value,
  };

  return NextResponse.json(response, { status: 201 });
}
