/**
 * Transcription Service using Effect-TS
 *
 * Provides type-safe transcription operations using Replicate's Whisper model.
 * Handles audio extraction and transcription with timestamp segments.
 *
 * This service uses Replicate for transcription to maintain consistency with
 * the rest of the AI infrastructure, which uses managed services (Vercel AI SDK
 * for text generation, Replicate for audio/video processing).
 */

import { Context, Effect, Layer } from 'effect';
import Replicate from 'replicate';
import type { TranscriptSegment } from '../../db/schema';
import { env } from '../../env/server';
import { AudioExtractionError, TranscriptionError } from '../errors';

// Re-export for convenience
export { AudioExtractionError, TranscriptionError };

// =============================================================================
// Types
// =============================================================================

export interface TranscriptionResult {
  readonly transcript: string;
  readonly segments: ReadonlyArray<TranscriptSegment>;
  readonly duration: number;
  readonly language?: string;
}

export interface TranscriptionOptions {
  /** Custom vocabulary terms to bias transcription toward */
  readonly vocabularyTerms?: string[];
  /** Participant names to improve name recognition */
  readonly participantNames?: string[];
}

export interface TranscriptionServiceInterface {
  /**
   * Transcribe audio from a video URL
   * Fetches the video, extracts audio, and transcribes it
   */
  readonly transcribeFromUrl: (
    videoUrl: string,
    options?: TranscriptionOptions,
  ) => Effect.Effect<TranscriptionResult, TranscriptionError>;

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

export class Transcription extends Context.Tag('Transcription')<Transcription, TranscriptionServiceInterface>() {}

// =============================================================================
// Replicate Model
// =============================================================================

const WHISPER_MODEL = 'openai/whisper:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e';

// =============================================================================
// Transcription Service Implementation
// =============================================================================

const makeTranscriptionService = Effect.gen(function* () {
  const apiToken = env.REPLICATE_API_TOKEN;
  const isConfigured = !!apiToken;

  // Create Replicate client only if configured
  const replicate = isConfigured ? new Replicate({ auth: apiToken }) : null;

  const isAvailable = (): boolean => isConfigured;

  const transcribeAudio = (
    _audioBuffer: Buffer,
    _filename = 'audio.mp3',
  ): Effect.Effect<TranscriptionResult, TranscriptionError> =>
    Effect.fail(
      new TranscriptionError({
        message:
          'Direct buffer transcription not supported with Replicate. Use transcribeFromUrl with a publicly accessible URL.',
        operation: 'transcribeAudio',
      }),
    );

  const transcribeFromUrl = (
    videoUrl: string,
    options?: TranscriptionOptions,
  ): Effect.Effect<TranscriptionResult, TranscriptionError> =>
    Effect.gen(function* () {
      if (!replicate) {
        return yield* Effect.fail(
          new TranscriptionError({
            message: 'Replicate API token not configured. Please set REPLICATE_API_TOKEN environment variable.',
            operation: 'transcribeFromUrl',
          }),
        );
      }

      // Build initial_prompt from vocabulary terms and participant names
      // This biases Whisper toward recognizing these terms
      const promptTerms: string[] = [];
      if (options?.vocabularyTerms && options.vocabularyTerms.length > 0) {
        promptTerms.push(...options.vocabularyTerms);
      }
      if (options?.participantNames && options.participantNames.length > 0) {
        promptTerms.push(...options.participantNames);
      }
      const initialPrompt = promptTerms.length > 0 ? promptTerms.join(', ') : undefined;

      const output = yield* Effect.tryPromise({
        try: async () => {
          return (await replicate.run(WHISPER_MODEL as `${string}/${string}`, {
            input: {
              audio: videoUrl,
              model: 'large-v3',
              translate: false,
              temperature: 0,
              transcription: 'plain text',
              suppress_tokens: '-1',
              logprob_threshold: -1,
              no_speech_threshold: 0.6,
              condition_on_previous_text: true,
              compression_ratio_threshold: 2.4,
              // Vocabulary injection: initial_prompt biases the model toward these terms
              ...(initialPrompt && { initial_prompt: initialPrompt }),
            },
          })) as {
            transcription?: string;
            segments?: Array<{ start: number; end: number; text: string }>;
            detected_language?: string;
          };
        },
        catch: (error) => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return new TranscriptionError({
            message: `Failed to transcribe video: ${errorMessage}`,
            operation: 'transcribeFromUrl',
            cause: error,
          });
        },
      });

      // Parse segments from response
      const segments: TranscriptSegment[] = (output.segments || []).map((seg) => ({
        startTime: seg.start,
        endTime: seg.end,
        text: seg.text.trim(),
      }));

      // Calculate duration from segments if available
      const duration = segments.length > 0 ? Math.max(...segments.map((s) => s.endTime)) : 0;

      return {
        transcript: output.transcription || '',
        segments,
        duration,
        language: output.detected_language,
      };
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
  options?: TranscriptionOptions,
): Effect.Effect<TranscriptionResult, TranscriptionError, Transcription> =>
  Effect.gen(function* () {
    const service = yield* Transcription;
    return yield* service.transcribeFromUrl(videoUrl, options);
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
