/**
 * Video Processor Service using Effect-TS
 *
 * Handles video upload, processing, and thumbnail generation.
 * Integrates with Storage service for file operations.
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
  readonly videoUrl: string;
  readonly thumbnailUrl: string;
  readonly duration: string;
  readonly info: VideoInfo;
}

export interface ProcessingProgress {
  readonly stage: "uploading" | "processing" | "generating_thumbnail" | "complete";
  readonly progress: number;
  readonly message: string;
}

export interface VideoProcessorService {
  /**
   * Process a video file
   */
  readonly processVideo: (
    buffer: Buffer,
    filename: string,
    organizationId: string,
    onProgress?: (progress: ProcessingProgress) => void,
  ) => Effect.Effect<ProcessingResult, VideoError>;

  /**
   * Get video metadata
   */
  readonly getVideoInfo: (buffer: Buffer) => Effect.Effect<VideoInfo, never>;

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

const SUPPORTED_FORMATS = ["mp4", "mov", "avi", "mkv", "webm", "flv", "wmv"] as const;
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

const CONTENT_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  webm: "video/webm",
  flv: "video/x-flv",
  wmv: "video/x-ms-wmv",
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
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

// Placeholder thumbnail - in production, use ffmpeg
const createPlaceholderThumbnail = (): Buffer => {
  const base64Jpeg =
    "/9j/4AAQSkZJRgABAQEAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=";
  return Buffer.from(base64Jpeg, "base64");
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

  const getVideoInfo = (buffer: Buffer): Effect.Effect<VideoInfo, never> =>
    Effect.sync(() => {
      // Mock implementation - in production use ffmpeg or similar
      const size = buffer.length;
      const estimatedDuration = Math.max(10, Math.floor(size / (1024 * 1024)) * 60);

      return {
        duration: formatDuration(estimatedDuration),
        width: 1920,
        height: 1080,
        format: "mp4",
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
            const progressPercent = Math.floor((uploadProgress.loaded / uploadProgress.total) * 30) + 10;
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

      // Stage 2: Get video info
      onProgress?.({
        stage: "processing",
        progress: 50,
        message: "Processing video metadata...",
      });

      const videoInfo = yield* getVideoInfo(buffer);

      // Stage 3: Generate thumbnail
      onProgress?.({
        stage: "generating_thumbnail",
        progress: 70,
        message: "Generating thumbnail...",
      });

      const thumbnailBuffer = createPlaceholderThumbnail();
      const thumbnailKey = storage.generateFileKey(organizationId, `${videoId}-thumbnail.jpg`, "thumbnail");

      const thumbnailResult = yield* pipe(
        storage.uploadFile(thumbnailBuffer, thumbnailKey, {
          contentType: "image/jpeg",
          metadata: { videoId, organizationId, type: "thumbnail" },
        }),
        Effect.mapError(
          (error) =>
            new VideoProcessingError({
              message: error.message,
              stage: "generating_thumbnail",
              cause: error,
            }),
        ),
      );

      onProgress?.({
        stage: "complete",
        progress: 100,
        message: "Video processing complete!",
      });

      return {
        videoUrl: uploadResult.url,
        thumbnailUrl: thumbnailResult.url,
        duration: videoInfo.duration,
        info: videoInfo,
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
export const getVideoInfo = (buffer: Buffer): Effect.Effect<VideoInfo, never, VideoProcessor> =>
  Effect.gen(function* () {
    const processor = yield* VideoProcessor;
    return yield* processor.getVideoInfo(buffer);
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
