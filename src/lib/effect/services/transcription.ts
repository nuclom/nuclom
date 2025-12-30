/**
 * Transcription Service using Effect-TS
 *
 * Provides type-safe transcription operations using OpenAI Whisper API.
 * Handles audio extraction and transcription with timestamp segments.
 */

import { Effect, Context, Layer, pipe } from "effect";
import OpenAI from "openai";
import type { TranscriptSegment } from "@/lib/db/schema";

// =============================================================================
// Error Types
// =============================================================================

import { Data } from "effect";

export class TranscriptionError extends Data.TaggedError("TranscriptionError")<{
  readonly message: string;
  readonly operation?: string;
  readonly cause?: unknown;
}> {}

export class AudioExtractionError extends Data.TaggedError("AudioExtractionError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

// =============================================================================
// Types
// =============================================================================

export interface TranscriptionResult {
  readonly transcript: string;
  readonly segments: ReadonlyArray<TranscriptSegment>;
  readonly duration: number;
  readonly language?: string;
}

export interface TranscriptionServiceInterface {
  /**
   * Transcribe audio from a video URL
   * Fetches the video, extracts audio, and transcribes it
   */
  readonly transcribeFromUrl: (videoUrl: string) => Effect.Effect<TranscriptionResult, TranscriptionError>;

  /**
   * Transcribe audio from a buffer (already extracted audio)
   */
  readonly transcribeAudio: (
    audioBuffer: Buffer,
    filename?: string,
  ) => Effect.Effect<TranscriptionResult, TranscriptionError>;

  /**
   * Check if transcription service is available
   */
  readonly isAvailable: () => boolean;
}

// =============================================================================
// Transcription Service Tag
// =============================================================================

export class Transcription extends Context.Tag("Transcription")<Transcription, TranscriptionServiceInterface>() {}

// =============================================================================
// Transcription Service Implementation
// =============================================================================

const makeTranscriptionService = Effect.gen(function* () {
  const apiKey = process.env.OPENAI_API_KEY;
  const isConfigured = !!apiKey;

  // Create OpenAI client only if configured
  const openai = isConfigured ? new OpenAI({ apiKey }) : null;

  const isAvailable = (): boolean => isConfigured;

  const transcribeAudio = (
    audioBuffer: Buffer,
    filename = "audio.mp3",
  ): Effect.Effect<TranscriptionResult, TranscriptionError> =>
    Effect.gen(function* () {
      if (!openai) {
        return yield* Effect.fail(
          new TranscriptionError({
            message: "OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.",
            operation: "transcribeAudio",
          }),
        );
      }

      // Convert buffer to File for OpenAI API (use Uint8Array for broader compatibility)
      const file = new File([new Uint8Array(audioBuffer)], filename, {
        type: filename.endsWith(".mp3") ? "audio/mpeg" : "audio/wav",
      });

      const response = yield* Effect.tryPromise({
        try: async () => {
          return await openai.audio.transcriptions.create({
            file,
            model: "whisper-1",
            response_format: "verbose_json",
            timestamp_granularities: ["segment"],
          });
        },
        catch: (error) =>
          new TranscriptionError({
            message: "Failed to transcribe audio",
            operation: "transcribeAudio",
            cause: error,
          }),
      });

      // Parse segments from response
      const segments: TranscriptSegment[] = (response.segments || []).map((seg) => ({
        startTime: seg.start,
        endTime: seg.end,
        text: seg.text.trim(),
        confidence: seg.avg_logprob ? Math.exp(seg.avg_logprob) : undefined,
      }));

      return {
        transcript: response.text,
        segments,
        duration: response.duration || 0,
        language: response.language,
      };
    });

  const transcribeFromUrl = (videoUrl: string): Effect.Effect<TranscriptionResult, TranscriptionError> =>
    Effect.gen(function* () {
      if (!openai) {
        return yield* Effect.fail(
          new TranscriptionError({
            message: "OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.",
            operation: "transcribeFromUrl",
          }),
        );
      }

      // Fetch video/audio from URL
      const response = yield* Effect.tryPromise({
        try: async () => {
          const res = await fetch(videoUrl);
          if (!res.ok) {
            throw new Error(`Failed to fetch video: ${res.status} ${res.statusText}`);
          }
          return res;
        },
        catch: (error) =>
          new TranscriptionError({
            message: `Failed to fetch video from URL: ${videoUrl}`,
            operation: "transcribeFromUrl",
            cause: error,
          }),
      });

      // Get the file buffer
      const buffer = yield* Effect.tryPromise({
        try: async () => Buffer.from(await response.arrayBuffer()),
        catch: (error) =>
          new TranscriptionError({
            message: "Failed to read video buffer",
            operation: "transcribeFromUrl",
            cause: error,
          }),
      });

      // Determine filename from URL or content-type
      const contentType = response.headers.get("content-type") || "";
      let filename = "audio.mp3";
      if (contentType.includes("video/mp4") || videoUrl.endsWith(".mp4")) {
        filename = "video.mp4";
      } else if (contentType.includes("video/webm") || videoUrl.endsWith(".webm")) {
        filename = "video.webm";
      } else if (contentType.includes("audio/mpeg") || videoUrl.endsWith(".mp3")) {
        filename = "audio.mp3";
      } else if (contentType.includes("audio/wav") || videoUrl.endsWith(".wav")) {
        filename = "audio.wav";
      }

      // Whisper can handle video files directly (it extracts audio internally)
      return yield* transcribeAudio(buffer, filename);
    });

  return {
    transcribeFromUrl,
    transcribeAudio,
    isAvailable,
  } satisfies TranscriptionServiceInterface;
});

// =============================================================================
// Transcription Layer
// =============================================================================

export const TranscriptionLive = Layer.effect(Transcription, makeTranscriptionService);

// =============================================================================
// Transcription Helper Functions
// =============================================================================

/**
 * Transcribe audio from a video URL
 */
export const transcribeFromUrl = (
  videoUrl: string,
): Effect.Effect<TranscriptionResult, TranscriptionError, Transcription> =>
  Effect.gen(function* () {
    const service = yield* Transcription;
    return yield* service.transcribeFromUrl(videoUrl);
  });

/**
 * Transcribe audio from a buffer
 */
export const transcribeAudio = (
  audioBuffer: Buffer,
  filename?: string,
): Effect.Effect<TranscriptionResult, TranscriptionError, Transcription> =>
  Effect.gen(function* () {
    const service = yield* Transcription;
    return yield* service.transcribeAudio(audioBuffer, filename);
  });

/**
 * Check if transcription service is available
 */
export const isTranscriptionAvailable = (): Effect.Effect<boolean, never, Transcription> =>
  Effect.gen(function* () {
    const service = yield* Transcription;
    return service.isAvailable();
  });
