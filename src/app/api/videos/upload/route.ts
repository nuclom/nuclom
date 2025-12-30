import { type NextRequest, NextResponse } from "next/server";
import { Effect, Exit, Cause } from "effect";
import {
  AppLive,
  VideoProcessor,
  VideoRepository,
  MissingFieldError,
  ValidationError,
  isSupportedVideoFormat,
  getMaxFileSize,
} from "@/lib/effect";
import type { ApiResponse } from "@/lib/types";
import { triggerVideoProcessing } from "@/workflows/video-processing";

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
      case "VideoProcessingError":
      case "UploadError":
      case "DatabaseError":
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

    const file = formData.get("video") as File | null;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const organizationId = formData.get("organizationId") as string;
    const authorId = formData.get("authorId") as string;
    const channelId = formData.get("channelId") as string;
    const collectionId = formData.get("collectionId") as string;

    // Validate required fields
    if (!file) {
      return yield* Effect.fail(new MissingFieldError({ field: "video", message: "Video file is required" }));
    }

    if (!title) {
      return yield* Effect.fail(new MissingFieldError({ field: "title", message: "Title is required" }));
    }

    if (!organizationId) {
      return yield* Effect.fail(
        new MissingFieldError({ field: "organizationId", message: "Organization ID is required" }),
      );
    }

    if (!authorId) {
      return yield* Effect.fail(new MissingFieldError({ field: "authorId", message: "Author ID is required" }));
    }

    // Validate file type (using pure function)
    if (!isSupportedVideoFormat(file.name)) {
      return yield* Effect.fail(
        new ValidationError({
          message: "Unsupported video format. Supported formats: MP4, MOV, AVI, MKV, WebM, FLV, WMV, M4V, 3GP",
        }),
      );
    }

    // Validate file size (using pure function)
    if (file.size > getMaxFileSize()) {
      return yield* Effect.fail(
        new ValidationError({
          message: `File size exceeds maximum limit of ${getMaxFileSize() / (1024 * 1024)}MB`,
        }),
      );
    }

    // Convert file to buffer
    const buffer = yield* Effect.tryPromise({
      try: async () => Buffer.from(await file.arrayBuffer()),
      catch: () =>
        new ValidationError({
          message: "Failed to read file",
        }),
    });

    // Process video using VideoProcessor service (uploads to R2)
    const processor = yield* VideoProcessor;
    const processingResult = yield* processor.processVideo(buffer, file.name, organizationId);

    // Save video metadata to database using VideoRepository
    // Set initial status to 'pending' - workflow will update it
    const videoRepo = yield* VideoRepository;
    const insertedVideo = yield* videoRepo.createVideo({
      title,
      description,
      duration: processingResult.duration,
      thumbnailUrl: processingResult.thumbnailUrl || undefined,
      videoUrl: processingResult.videoUrl,
      authorId,
      organizationId,
      channelId: channelId || undefined,
      collectionId: collectionId || undefined,
      processingStatus: "pending",
      fileSize: processingResult.fileSize,
    });

    // Trigger async video processing workflow
    // This runs in the background and updates the video record as it progresses
    yield* Effect.tryPromise({
      try: async () => {
        await triggerVideoProcessing({
          videoId: insertedVideo.id,
          videoUrl: processingResult.videoUrl,
          organizationId,
          title,
          description,
          fileSize: processingResult.fileSize,
        });
      },
      catch: (error) => {
        // Log but don't fail the request - video is uploaded, processing can be retried
        console.error("Failed to trigger video processing workflow:", error);
        return null;
      },
    });

    return {
      videoId: insertedVideo.id,
      videoUrl: processingResult.videoUrl,
      thumbnailUrl: processingResult.thumbnailUrl,
      duration: processingResult.duration,
      processingStatus: "pending",
    } as UploadResponse;
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
      const response: ApiResponse<UploadResponse> = {
        success: true,
        data,
      };
      return NextResponse.json(response, { status: 201 });
    },
  });
}
