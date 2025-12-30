/**
 * Replicate Service using Effect-TS
 *
 * Provides type-safe Replicate API operations for video processing.
 * Uses Replicate's cloud-based AI models for transcription and video analysis.
 */

import { Config, Context, Effect, Layer, Option, pipe } from "effect";
import Replicate from "replicate";
import { AIServiceError } from "../errors";

// =============================================================================
// Types
// =============================================================================

export interface VideoMetadata {
  readonly duration: number; // in seconds
  readonly width: number;
  readonly height: number;
  readonly codec: string;
  readonly fps: number;
  readonly bitrate: number;
  readonly fileSize: number;
}

export interface TranscriptionResult {
  readonly text: string;
  readonly segments?: ReadonlyArray<{
    readonly start: number;
    readonly end: number;
    readonly text: string;
  }>;
  readonly language?: string;
}

export interface ThumbnailResult {
  readonly url: string;
  readonly timestamp: number;
}

// =============================================================================
// Replicate Service Interface
// =============================================================================

export interface ReplicateService {
  /**
   * Check if Replicate is configured
   */
  readonly isConfigured: boolean;

  /**
   * Transcribe audio/video using Whisper
   */
  readonly transcribe: (videoUrl: string) => Effect.Effect<TranscriptionResult, AIServiceError>;

  /**
   * Generate thumbnail from video at specific timestamp
   */
  readonly generateThumbnail: (videoUrl: string, timestamp: number) => Effect.Effect<ThumbnailResult, AIServiceError>;

  /**
   * Generate multiple thumbnails at different timestamps
   */
  readonly generateThumbnails: (
    videoUrl: string,
    timestamps: ReadonlyArray<number>,
  ) => Effect.Effect<ReadonlyArray<ThumbnailResult>, AIServiceError>;

  /**
   * Extract video metadata using video analysis
   */
  readonly extractMetadata: (videoUrl: string, fileSize: number) => Effect.Effect<VideoMetadata, AIServiceError>;

  /**
   * Run a custom Replicate model
   */
  readonly run: <T>(model: string, input: Record<string, unknown>) => Effect.Effect<T, AIServiceError>;
}

// =============================================================================
// Replicate Service Tag
// =============================================================================

export class ReplicateAPI extends Context.Tag("ReplicateAPI")<ReplicateAPI, ReplicateService>() {}

// =============================================================================
// Replicate Configuration
// =============================================================================

const ReplicateConfigEffect = Config.string("REPLICATE_API_TOKEN").pipe(Config.option);

// =============================================================================
// Model Identifiers
// =============================================================================

const WHISPER_MODEL = "openai/whisper:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef62317f8ff4334";
const VIDEO_TO_GIF_MODEL = "fofr/video-to-gif:79bdd53be0a7a5f7c2f4813aba9c2a33e29e5dcf82d01f988d4e5c1c2a17c10e";

// =============================================================================
// Replicate Service Implementation
// =============================================================================

const makeReplicateService = Effect.gen(function* () {
  const apiToken = yield* ReplicateConfigEffect;

  const isConfigured = Option.isSome(apiToken);

  // Create Replicate client if configured
  const client = isConfigured
    ? new Replicate({
        auth: Option.getOrThrow(apiToken),
      })
    : null;

  const ensureConfigured = (): Effect.Effect<Replicate, AIServiceError> => {
    if (!isConfigured || !client) {
      return Effect.fail(
        new AIServiceError({
          message: "Replicate API not configured. Please set REPLICATE_API_TOKEN.",
          operation: "ensureConfigured",
        }),
      );
    }
    return Effect.succeed(client);
  };

  const run = <T>(model: string, input: Record<string, unknown>): Effect.Effect<T, AIServiceError> =>
    pipe(
      ensureConfigured(),
      Effect.flatMap((replicate) =>
        Effect.tryPromise({
          try: async () => {
            const output = await replicate.run(model as `${string}/${string}`, { input });
            return output as T;
          },
          catch: (error) =>
            new AIServiceError({
              message: `Replicate model run failed: ${error instanceof Error ? error.message : "Unknown error"}`,
              operation: "run",
              cause: error,
            }),
        }),
      ),
    );

  const transcribe = (videoUrl: string): Effect.Effect<TranscriptionResult, AIServiceError> =>
    pipe(
      ensureConfigured(),
      Effect.flatMap((replicate) =>
        Effect.tryPromise({
          try: async () => {
            const output = (await replicate.run(WHISPER_MODEL as `${string}/${string}`, {
              input: {
                audio: videoUrl,
                model: "large-v3",
                translate: false,
                temperature: 0,
                transcription: "plain text",
                suppress_tokens: "-1",
                logprob_threshold: -1,
                no_speech_threshold: 0.6,
                condition_on_previous_text: true,
                compression_ratio_threshold: 2.4,
              },
            })) as {
              transcription?: string;
              segments?: Array<{ start: number; end: number; text: string }>;
              detected_language?: string;
            };

            return {
              text: output.transcription || "",
              segments: output.segments?.map((seg) => ({
                start: seg.start,
                end: seg.end,
                text: seg.text,
              })),
              language: output.detected_language,
            } satisfies TranscriptionResult;
          },
          catch: (error) =>
            new AIServiceError({
              message: `Transcription failed: ${error instanceof Error ? error.message : "Unknown error"}`,
              operation: "transcribe",
              cause: error,
            }),
        }),
      ),
    );

  const generateThumbnail = (videoUrl: string, timestamp: number): Effect.Effect<ThumbnailResult, AIServiceError> =>
    pipe(
      ensureConfigured(),
      Effect.flatMap((replicate) =>
        Effect.tryPromise({
          try: async () => {
            // Use video-to-gif model to extract a frame
            // We'll generate a very short GIF (essentially a single frame)
            const output = await replicate.run(VIDEO_TO_GIF_MODEL as `${string}/${string}`, {
              input: {
                video: videoUrl,
                start_time: Math.max(0, timestamp),
                duration: 0.1, // Very short to get essentially a frame
                fps: 1,
                width: 1280,
              },
            });

            // The output is typically a URL to the generated content
            const url =
              typeof output === "string" ? output : Array.isArray(output) && output.length > 0 ? String(output[0]) : "";

            return {
              url,
              timestamp,
            } satisfies ThumbnailResult;
          },
          catch: (error) =>
            new AIServiceError({
              message: `Thumbnail generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
              operation: "generateThumbnail",
              cause: error,
            }),
        }),
      ),
    );

  const generateThumbnails = (
    videoUrl: string,
    timestamps: ReadonlyArray<number>,
  ): Effect.Effect<ReadonlyArray<ThumbnailResult>, AIServiceError> =>
    Effect.all(
      timestamps.map((timestamp) => generateThumbnail(videoUrl, timestamp)),
      { concurrency: 3 },
    );

  const extractMetadata = (videoUrl: string, fileSize: number): Effect.Effect<VideoMetadata, AIServiceError> =>
    Effect.tryPromise({
      try: async () => {
        // For now, we'll use a heuristic-based approach since Replicate
        // doesn't have a dedicated metadata extraction model.
        // In production, you would want to use FFprobe or similar.

        // Default metadata based on common video formats
        // This will be enhanced when we add actual metadata extraction
        const estimatedDuration = Math.max(10, Math.floor(fileSize / (1024 * 1024)) * 60);

        return {
          duration: estimatedDuration,
          width: 1920,
          height: 1080,
          codec: "h264",
          fps: 30,
          bitrate: Math.floor((fileSize * 8) / estimatedDuration),
          fileSize,
        } satisfies VideoMetadata;
      },
      catch: (error) =>
        new AIServiceError({
          message: `Metadata extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          operation: "extractMetadata",
          cause: error,
        }),
    });

  return {
    isConfigured,
    transcribe,
    generateThumbnail,
    generateThumbnails,
    extractMetadata,
    run,
  } satisfies ReplicateService;
});

// =============================================================================
// Replicate Layer
// =============================================================================

export const ReplicateLive = Layer.effect(ReplicateAPI, makeReplicateService);

// =============================================================================
// Replicate Helper Functions
// =============================================================================

/**
 * Transcribe audio/video using Whisper
 */
export const transcribe = (videoUrl: string): Effect.Effect<TranscriptionResult, AIServiceError, ReplicateAPI> =>
  Effect.gen(function* () {
    const replicate = yield* ReplicateAPI;
    return yield* replicate.transcribe(videoUrl);
  });

/**
 * Generate thumbnail from video
 */
export const generateThumbnail = (
  videoUrl: string,
  timestamp: number,
): Effect.Effect<ThumbnailResult, AIServiceError, ReplicateAPI> =>
  Effect.gen(function* () {
    const replicate = yield* ReplicateAPI;
    return yield* replicate.generateThumbnail(videoUrl, timestamp);
  });

/**
 * Generate multiple thumbnails
 */
export const generateThumbnails = (
  videoUrl: string,
  timestamps: ReadonlyArray<number>,
): Effect.Effect<ReadonlyArray<ThumbnailResult>, AIServiceError, ReplicateAPI> =>
  Effect.gen(function* () {
    const replicate = yield* ReplicateAPI;
    return yield* replicate.generateThumbnails(videoUrl, timestamps);
  });

/**
 * Extract video metadata
 */
export const extractMetadata = (
  videoUrl: string,
  fileSize: number,
): Effect.Effect<VideoMetadata, AIServiceError, ReplicateAPI> =>
  Effect.gen(function* () {
    const replicate = yield* ReplicateAPI;
    return yield* replicate.extractMetadata(videoUrl, fileSize);
  });
