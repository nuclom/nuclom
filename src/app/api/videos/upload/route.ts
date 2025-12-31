import { Cause, Effect, Exit, Layer, Option } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { AppLive, MissingFieldError, ValidationError, VideoProcessor, VideoRepository } from "@/lib/effect";
import { trackVideoUpload } from "@/lib/effect/services/billing-middleware";
import { BillingRepository } from "@/lib/effect/services/billing-repository";
import { TranscriptionLive } from "@/lib/effect/services/transcription";
import { VideoAIProcessor, VideoAIProcessorLive } from "@/lib/effect/services/video-ai-processor";
import type { ApiResponse } from "@/lib/types";
import {
  sanitizeDescription,
  sanitizeTitle,
  validateFormData,
  validateVideoFile,
  videoUploadSchema,
} from "@/lib/validation";

// Handle file upload size limit
export const maxDuration = 300; // 5 minutes
export const dynamic = "force-dynamic";

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
// Error Response Handler
// =============================================================================

const mapErrorToResponse = (error: unknown): NextResponse => {
  if (error && typeof error === "object" && "_tag" in error) {
    const taggedError = error as { _tag: string; message: string };

    switch (taggedError._tag) {
      case "MissingFieldError":
      case "ValidationError":
      case "UnsupportedFormatError":
      case "FileSizeExceededError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 400 });
      case "StorageNotConfiguredError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 503 });
      case "PlanLimitExceededError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 402 });
      case "NoSubscriptionError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 402 });
      case "VideoProcessingError":
      case "UploadError":
      case "DatabaseError":
      case "UsageTrackingError":
        console.error(`[${taggedError._tag}]`, taggedError);
        return NextResponse.json({ success: false, error: "Failed to upload video" }, { status: 500 });
      default:
        console.error(`[${taggedError._tag}]`, taggedError);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
  }
  console.error("[Error]", error);
  return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
};

// Build the layer with all required dependencies for AI processing
const VideoAIProcessorWithDeps = VideoAIProcessorLive.pipe(Layer.provide(Layer.mergeAll(AppLive, TranscriptionLive)));

const FullProcessingLayer = Layer.mergeAll(AppLive, TranscriptionLive, VideoAIProcessorWithDeps);

// =============================================================================
// POST /api/videos/upload - Upload a video file
// =============================================================================

export async function POST(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Check content type
    const contentType = request.headers.get("content-type");
    if (!contentType?.includes("multipart/form-data")) {
      return yield* Effect.fail(
        new ValidationError({
          message: "Content-Type must be multipart/form-data",
        }),
      );
    }

    // Parse form data
    const formData = yield* Effect.tryPromise({
      try: () => request.formData(),
      catch: () =>
        new ValidationError({
          message: "Invalid form data",
        }),
    });

    // Validate form fields with Zod schema
    const validatedData = yield* validateFormData(videoUploadSchema, formData);

    // Get the video file
    const file = formData.get("video") as File | null;
    if (!file) {
      return yield* Effect.fail(new MissingFieldError({ field: "video", message: "Video file is required" }));
    }

    // Sanitize user-provided content to prevent XSS
    const sanitizedTitle = sanitizeTitle(validatedData.title);
    const sanitizedDescription = validatedData.description ? sanitizeDescription(validatedData.description) : undefined;

    const skipAIProcessing = validatedData.skipAIProcessing === "true";

    // Read file into buffer for validation
    const arrayBuffer = yield* Effect.tryPromise({
      try: () => file.arrayBuffer(),
      catch: () =>
        new ValidationError({
          message: "Failed to read file",
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
      channelId: validatedData.channelId || undefined,
      collectionId: validatedData.collectionId || undefined,
      processingStatus: skipAIProcessing ? "completed" : "pending",
    });

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

  const runnable = Effect.provide(effect, AppLive);
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === "Some") {
        return mapErrorToResponse(error.value);
      }
      return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    },
    onSuccess: (data) => {
      // Trigger AI processing in the background (fire and forget)
      if (!data.skipAIProcessing && data.videoUrl) {
        // Run AI processing asynchronously - don't await
        const aiEffect = Effect.gen(function* () {
          const aiProcessor = yield* VideoAIProcessor;
          yield* aiProcessor.processVideo(data.videoId, data.videoUrl!, data.videoTitle);
        });

        const aiRunnable = Effect.provide(aiEffect, FullProcessingLayer);

        // Fire and forget - run in background
        Effect.runPromise(aiRunnable).catch((err) => {
          console.error("[AI Processing Error]", err);
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
    },
  });
}
