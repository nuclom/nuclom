/**
 * Upload Confirmation API
 *
 * Called after a file has been uploaded directly to R2 via presigned URL.
 * Creates the video record in the database and triggers processing.
 */

import { Effect, Schema } from 'effect';
import { connection, type NextRequest, NextResponse } from 'next/server';
import { createPublicLayer, mapErrorToApiResponse } from '@/lib/api-handler';
import { auth } from '@/lib/auth';
import { Storage, ValidationError, VideoRepository } from '@/lib/effect';
import type { ApiResponse } from '@/lib/types';
import { sanitizeDescription, sanitizeTitle, validate } from '@/lib/validation';
import { processVideoWorkflow } from '@/workflows/video-processing';

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
  channelId: Schema.optional(Schema.String),
  collectionId: Schema.optional(Schema.String),
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
  channelId: Schema.optional(Schema.String),
  collectionId: Schema.optional(Schema.String),
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
  const { fileKey, title, description, organizationId, authorId, channelId, collectionId, skipAIProcessing } = body;

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

    // Store the file key as the videoUrl (used for generating presigned URLs later)
    // We store the key directly since it's more flexible than the internal R2 URL
    const video = yield* videoRepo.createVideo({
      title: sanitizedTitle,
      description: sanitizedDescription,
      duration: PLACEHOLDER_DURATION,
      videoUrl: fileKey, // Store the key, not the URL
      thumbnailUrl: undefined, // Will be generated during processing
      authorId,
      organizationId,
      channelId: channelId || undefined,
      collectionId: collectionId || undefined,
      processingStatus: skipAIProcessing ? 'completed' : 'pending',
    });

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
      console.error('[Video Processing Workflow Error]', err);
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
  const { uploads, organizationId, authorId, channelId, collectionId, skipAIProcessing } = body;

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

    const results: BulkConfirmUploadResponse['videos'] = [];
    let succeeded = 0;
    let failed = 0;

    for (const upload of uploads) {
      try {
        // Generate presigned URL for response
        const presignedVideoUrl = yield* storage.generatePresignedDownloadUrl(upload.fileKey, 3600);
        const sanitizedTitle = sanitizeTitle(upload.title);
        const sanitizedDescription = upload.description ? sanitizeDescription(upload.description) : undefined;

        // Store the file key, not the URL
        const video = yield* videoRepo.createVideo({
          title: sanitizedTitle,
          description: sanitizedDescription,
          duration: PLACEHOLDER_DURATION,
          videoUrl: upload.fileKey, // Store the key for later presigned URL generation
          thumbnailUrl: undefined,
          authorId,
          organizationId,
          channelId: channelId || undefined,
          collectionId: collectionId || undefined,
          processingStatus: skipAIProcessing ? 'completed' : 'pending',
        });

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
            videoUrl: upload.fileKey, // Pass the file key to workflow
            videoTitle: sanitizedTitle,
            organizationId,
          }).catch((err) => {
            console.error(`[Video Processing Workflow Error for ${video.id}]`, err);
          });
        }

        succeeded++;
      } catch (err) {
        console.error(`[Bulk Confirm Error for ${upload.uploadId}]`, err);
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
