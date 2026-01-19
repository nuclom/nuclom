import { createPublicLayer, mapErrorToApiResponse } from '@nuclom/lib/api-handler';
import { MissingFieldError, ValidationError, VideoProcessor, VideoRepository } from '@nuclom/lib/effect';
import { trackVideoUpload } from '@nuclom/lib/effect/services/billing-middleware';
import { BillingRepository } from '@nuclom/lib/effect/services/billing-repository';
import { syncNewVideoToContent } from '@nuclom/lib/effect/services';
import type { ApiResponse } from '@nuclom/lib/types';
import {
  sanitizeDescription,
  sanitizeTitle,
  VideoUploadSchema,
  validateFormData,
  validateVideoFile,
} from '@nuclom/lib/validation';
import { Cause, Effect, Option } from 'effect';
import { type NextRequest, NextResponse } from 'next/server';
import { processVideoWorkflow } from '@/workflows/video-processing';

// =============================================================================
// Types
// =============================================================================

interface UploadResponse {
  videoId: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: string;
  processingStatus: string;
}

// =============================================================================
// POST /api/videos/upload - Upload a video file
// =============================================================================

export async function POST(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Check content type
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('multipart/form-data')) {
      return yield* Effect.fail(
        new ValidationError({
          message: 'Content-Type must be multipart/form-data',
        }),
      );
    }

    // Parse form data
    const formData = yield* Effect.tryPromise({
      try: () => request.formData(),
      catch: (error) =>
        new ValidationError({
          message: `Failed to parse form data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }),
    });

    // Validate form fields with Effect Schema
    const validatedData = yield* validateFormData(VideoUploadSchema, formData);

    // Get the video file
    const file = formData.get('video') as File | null;
    if (!file) {
      return yield* Effect.fail(new MissingFieldError({ field: 'video', message: 'Video file is required' }));
    }

    // Sanitize user-provided content to prevent XSS
    const sanitizedTitle = sanitizeTitle(validatedData.title);
    const sanitizedDescription = validatedData.description ? sanitizeDescription(validatedData.description) : undefined;

    const skipAIProcessing = validatedData.skipAIProcessing === 'true';

    // Read file into buffer for validation
    const arrayBuffer = yield* Effect.tryPromise({
      try: () => file.arrayBuffer(),
      catch: () =>
        new ValidationError({
          message: 'Failed to read file',
        }),
    });

    // Validate video file with magic bytes detection
    // This prevents uploading malicious files disguised as videos
    yield* validateVideoFile({
      buffer: arrayBuffer,
      name: file.name,
      size: file.size,
    });

    // Convert to buffer for processing
    const buffer = Buffer.from(arrayBuffer);

    // Process video using VideoProcessor service (uploads to R2)
    const processor = yield* VideoProcessor;
    const processingResult = yield* processor.processVideo(buffer, file.name, validatedData.organizationId);

    // Check plan limits and track usage before proceeding
    // This checks both storage and video count limits
    const billingRepo = yield* BillingRepository;
    const subscriptionOption = yield* billingRepo.getSubscriptionOption(validatedData.organizationId);

    // If organization has a subscription, check and track usage
    if (Option.isSome(subscriptionOption)) {
      yield* trackVideoUpload(validatedData.organizationId, file.size);
    }

    // Save video metadata to database using VideoRepository
    // Set initial status to 'pending' - workflow will update it
    const videoRepo = yield* VideoRepository;
    const insertedVideo = yield* videoRepo.createVideo({
      title: sanitizedTitle,
      description: sanitizedDescription,
      duration: processingResult.duration,
      thumbnailUrl: processingResult.thumbnailUrl || undefined,
      videoUrl: processingResult.videoUrl,
      authorId: validatedData.authorId,
      organizationId: validatedData.organizationId,
      processingStatus: skipAIProcessing ? 'completed' : 'pending',
    });

    // Sync video to content_items for unified knowledge base
    // This is non-blocking - failures are logged but don't fail the upload
    yield* syncNewVideoToContent(insertedVideo.id, validatedData.organizationId);

    return {
      videoId: insertedVideo.id,
      videoUrl: processingResult.videoUrl,
      thumbnailUrl: processingResult.thumbnailUrl,
      duration: processingResult.duration,
      processingStatus: insertedVideo.processingStatus,
      skipAIProcessing,
      videoTitle: sanitizedTitle,
      fileSize: file.size,
    };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);

  if (exit._tag === 'Failure') {
    const error = Cause.failureOption(exit.cause);
    if (error._tag === 'Some') {
      return mapErrorToApiResponse(error.value);
    }
    return mapErrorToApiResponse(new Error('Internal server error'));
  }

  if (exit._tag === 'Success') {
    const data = exit.value;
    // Trigger AI processing using durable workflow
    if (!data.skipAIProcessing && data.videoUrl) {
      // Start the workflow - it runs durably in the background
      // No need for fire-and-forget, the workflow handles retries and persistence
      processVideoWorkflow({
        videoId: data.videoId,
        videoUrl: data.videoUrl,
        videoTitle: data.videoTitle,
      }).catch((err) => {
        // Log but don't fail - workflow will retry on its own
        console.error('[Video Processing Workflow Error]', err);
      });
    }

    const response: ApiResponse<UploadResponse> = {
      success: true,
      data: {
        videoId: data.videoId,
        videoUrl: data.videoUrl,
        thumbnailUrl: data.thumbnailUrl,
        duration: data.duration,
        processingStatus: data.processingStatus,
      },
    };
    return NextResponse.json(response, { status: 201 });
  }

  return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
}
