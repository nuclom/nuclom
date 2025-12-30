/**
 * Video Processor Service using Effect-TS
 *
 * Handles video upload, processing, and thumbnail generation.
 * Integrates with Storage service for file operations and
 * triggers async processing workflow for metadata extraction.
 */

import { Context, Effect, Layer, pipe } from "effect";
import { v4 as uuidv4 } from "uuid";
import { FileSizeExceededError, UnsupportedFormatError, type VideoError, VideoProcessingError } from "../errors";
import { Storage, type UploadProgress } from "./storage";

// =============================================================================
// Types
// =============================================================================

export interface VideoInfo {
  readonly duration: string;
  readonly width: number;
  readonly height: number;
  readonly format: string;
  readonly size: number;
}

export interface ProcessingResult {
  readonly videoId: string;
  readonly videoUrl: string;
  readonly thumbnailUrl: string;
  readonly duration: string;
  readonly info: VideoInfo;
  readonly fileSize: number;
}

export interface ProcessingProgress {
  readonly stage: "uploading" | "processing" | "generating_thumbnail" | "complete";
  readonly progress: number;
  readonly message: string;
}

export interface VideoProcessorService {
  /**
   * Process a video file - uploads to storage and returns immediately.
   * Actual processing (metadata, thumbnails, transcription) happens async.
   */
  readonly processVideo: (
    buffer: Buffer,
    filename: string,
    organizationId: string,
    onProgress?: (progress: ProcessingProgress) => void,
  ) => Effect.Effect<ProcessingResult, VideoError>;

  /**
   * Get estimated video metadata (before async processing completes)
   */
  readonly getVideoInfo: (buffer: Buffer, filename: string) => Effect.Effect<VideoInfo, never>;

  /**
   * Check if format is supported
   */
  readonly isSupportedVideoFormat: (filename: string) => boolean;

  /**
   * Get maximum file size
   */
  readonly getMaxFileSize: () => number;

  /**
   * Validate video file
   */
  readonly validateVideo: (
    filename: string,
    fileSize: number,
  ) => Effect.Effect<void, UnsupportedFormatError | FileSizeExceededError>;
}

// =============================================================================
// Constants
// =============================================================================

const SUPPORTED_FORMATS = ["mp4", "mov", "avi", "mkv", "webm", "flv", "wmv", "m4v", "3gp"] as const;
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

const CONTENT_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  webm: "video/webm",
  flv: "video/x-flv",
  wmv: "video/x-ms-wmv",
  m4v: "video/x-m4v",
  "3gp": "video/3gpp",
};

// =============================================================================
// Video Processor Service Tag
// =============================================================================

export class VideoProcessor extends Context.Tag("VideoProcessor")<VideoProcessor, VideoProcessorService>() {}

// =============================================================================
// Helper Functions
// =============================================================================

const getExtension = (filename: string): string => {
  return filename.toLowerCase().split(".").pop() || "";
};

const getContentType = (filename: string): string => {
  const ext = getExtension(filename);
  return CONTENT_TYPES[ext] || "video/mp4";
};

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

/**
 * Estimate video duration from file size
 * This is a rough estimate - actual duration will be extracted async
 */
const estimateDuration = (fileSize: number): number => {
  // Assume ~1MB per 10 seconds of HD video as a rough estimate
  // Actual duration will be updated after async processing
  return Math.max(10, Math.floor(fileSize / (100 * 1024)));
};

// =============================================================================
// Video Processor Implementation
// =============================================================================

const makeVideoProcessorService = Effect.gen(function* () {
  const storage = yield* Storage;

  const isSupportedVideoFormat = (filename: string): boolean => {
    const ext = getExtension(filename);
    return SUPPORTED_FORMATS.includes(ext as (typeof SUPPORTED_FORMATS)[number]);
  };

  const getMaxFileSize = (): number => MAX_FILE_SIZE;

  const validateVideo = (
    filename: string,
    fileSize: number,
  ): Effect.Effect<void, UnsupportedFormatError | FileSizeExceededError> => {
    if (!isSupportedVideoFormat(filename)) {
      return Effect.fail(
        new UnsupportedFormatError({
          message: `Unsupported video format. Supported formats: ${SUPPORTED_FORMATS.join(", ").toUpperCase()}`,
          format: getExtension(filename),
          supportedFormats: SUPPORTED_FORMATS,
        }),
      );
    }

    if (fileSize > MAX_FILE_SIZE) {
      return Effect.fail(
        new FileSizeExceededError({
          message: `File size exceeds maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
          fileSize,
          maxSize: MAX_FILE_SIZE,
        }),
      );
    }

    return Effect.void;
  };

  const getVideoInfo = (buffer: Buffer, filename: string): Effect.Effect<VideoInfo, never> =>
    Effect.sync(() => {
      const size = buffer.length;
      const estimatedDuration = estimateDuration(size);

      return {
        duration: formatDuration(estimatedDuration),
        width: 1920, // Default HD, will be updated by async processing
        height: 1080,
        format: getExtension(filename) || "mp4",
        size,
      };
    });

  const processVideo = (
    buffer: Buffer,
    filename: string,
    organizationId: string,
    onProgress?: (progress: ProcessingProgress) => void,
  ): Effect.Effect<ProcessingResult, VideoError> =>
    Effect.gen(function* () {
      const videoId = uuidv4();

      // Validate the video first
      yield* validateVideo(filename, buffer.length);

      // Stage 1: Upload original video
      onProgress?.({
        stage: "uploading",
        progress: 10,
        message: "Uploading video file...",
      });

      const videoKey = storage.generateFileKey(organizationId, `${videoId}-${filename}`, "video");
      const contentType = getContentType(filename);

      const uploadResult = yield* pipe(
        storage.uploadLargeFile(
          buffer,
          videoKey,
          { contentType, metadata: { originalFilename: filename, videoId, organizationId } },
          (uploadProgress: UploadProgress) => {
            const progressPercent = Math.floor((uploadProgress.loaded / uploadProgress.total) * 60) + 10;
            onProgress?.({
              stage: "uploading",
              progress: progressPercent,
              message: `Uploading... ${Math.floor((uploadProgress.loaded / uploadProgress.total) * 100)}%`,
            });
          },
        ),
        Effect.mapError(
          (error) =>
            new VideoProcessingError({
              message: error.message,
              stage: "uploading",
              cause: error,
            }),
        ),
      );

      // Stage 2: Get initial video info (estimated)
      onProgress?.({
        stage: "processing",
        progress: 75,
        message: "Processing video metadata...",
      });

      const videoInfo = yield* getVideoInfo(buffer, filename);

      // Stage 3: Mark as complete (async processing will continue in background)
      onProgress?.({
        stage: "complete",
        progress: 100,
        message: "Video uploaded! Processing will continue in background.",
      });

      return {
        videoId,
        videoUrl: uploadResult.url,
        thumbnailUrl: "", // Will be generated by async processing
        duration: videoInfo.duration,
        info: videoInfo,
        fileSize: buffer.length,
      };
    });

  return {
    processVideo,
    getVideoInfo,
    isSupportedVideoFormat,
    getMaxFileSize,
    validateVideo,
  } satisfies VideoProcessorService;
});

// =============================================================================
// Video Processor Layer
// =============================================================================

export const VideoProcessorLive = Layer.effect(VideoProcessor, makeVideoProcessorService);

// =============================================================================
// Video Processor Helper Functions
// =============================================================================

/**
 * Process a video file
 */
export const processVideo = (
  buffer: Buffer,
  filename: string,
  organizationId: string,
  onProgress?: (progress: ProcessingProgress) => void,
): Effect.Effect<ProcessingResult, VideoError, VideoProcessor> =>
  Effect.gen(function* () {
    const processor = yield* VideoProcessor;
    return yield* processor.processVideo(buffer, filename, organizationId, onProgress);
  });

/**
 * Validate a video file
 */
export const validateVideo = (
  filename: string,
  fileSize: number,
): Effect.Effect<void, UnsupportedFormatError | FileSizeExceededError, VideoProcessor> =>
  Effect.gen(function* () {
    const processor = yield* VideoProcessor;
    return yield* processor.validateVideo(filename, fileSize);
  });

/**
 * Get video info
 */
export const getVideoInfo = (
  buffer: Buffer,
  filename: string,
): Effect.Effect<VideoInfo, never, VideoProcessor> =>
  Effect.gen(function* () {
    const processor = yield* VideoProcessor;
    return yield* processor.getVideoInfo(buffer, filename);
  });

/**
 * Check if format is supported (pure function, no effect needed)
 */
export const isSupportedVideoFormat = (filename: string): boolean => {
  const ext = filename.toLowerCase().split(".").pop() || "";
  return SUPPORTED_FORMATS.includes(ext as (typeof SUPPORTED_FORMATS)[number]);
};

/**
 * Get maximum file size (pure function, no effect needed)
 */
export const getMaxFileSize = (): number => MAX_FILE_SIZE;
