/**
 * Speaker Diarization Service using AssemblyAI
 *
 * Provides type-safe speaker diarization operations using AssemblyAI's API.
 * Identifies who is speaking when in audio/video content and provides
 * per-speaker transcription segments.
 *
 * This service uses AssemblyAI for its high-quality speaker diarization
 * with combined transcription capabilities.
 */

import { Context, Data, Effect, Layer } from 'effect';
import { env } from '@/lib/env/server';

// =============================================================================
// Error Types
// =============================================================================

export class DiarizationError extends Data.TaggedError('DiarizationError')<{
  readonly message: string;
  readonly operation?: string;
  readonly cause?: unknown;
}> {}

export class DiarizationNotConfiguredError extends Data.TaggedError('DiarizationNotConfiguredError')<{
  readonly message: string;
}> {}

// =============================================================================
// Types
// =============================================================================

/**
 * A segment of speech from a specific speaker
 */
export interface DiarizedSegment {
  /** The speaker identifier (e.g., "A", "B", "C") */
  readonly speaker: string;
  /** Start time in milliseconds */
  readonly start: number;
  /** End time in milliseconds */
  readonly end: number;
  /** The transcribed text for this segment */
  readonly text: string;
  /** Confidence score (0-1) */
  readonly confidence: number;
}

/**
 * Summary of a speaker's participation in the audio
 */
export interface SpeakerSummary {
  /** The speaker identifier */
  readonly speaker: string;
  /** Total speaking time in milliseconds */
  readonly totalSpeakingTime: number;
  /** Number of segments */
  readonly segmentCount: number;
  /** Percentage of total speaking time (0-100) */
  readonly speakingPercentage: number;
}

/**
 * Result of speaker diarization
 */
export interface DiarizationResult {
  /** Full transcript text */
  readonly transcript: string;
  /** Segments with speaker information */
  readonly segments: ReadonlyArray<DiarizedSegment>;
  /** Per-speaker summary statistics */
  readonly speakers: ReadonlyArray<SpeakerSummary>;
  /** Total audio duration in milliseconds */
  readonly duration: number;
  /** Detected language */
  readonly language?: string;
  /** Number of speakers detected */
  readonly speakerCount: number;
}

/**
 * Options for diarization
 */
export interface DiarizationOptions {
  /** Expected number of speakers (helps improve accuracy) */
  readonly speakersExpected?: number;
  /** Whether to include punctuation in transcript */
  readonly punctuate?: boolean;
  /** Whether to format numbers, dates, etc. */
  readonly formatText?: boolean;
}

export interface SpeakerDiarizationServiceInterface {
  /**
   * Transcribe and diarize audio from a URL
   * Fetches the audio, transcribes it with speaker labels
   */
  readonly diarizeFromUrl: (
    audioUrl: string,
    options?: DiarizationOptions,
  ) => Effect.Effect<DiarizationResult, DiarizationError | DiarizationNotConfiguredError>;

  /**
   * Check if diarization service is available
   */
  readonly isAvailable: () => boolean;
}

// =============================================================================
// Speaker Diarization Service Tag
// =============================================================================

export class SpeakerDiarization extends Context.Tag('SpeakerDiarization')<
  SpeakerDiarization,
  SpeakerDiarizationServiceInterface
>() {}

// =============================================================================
// AssemblyAI Types
// =============================================================================

interface AssemblyAITranscriptRequest {
  audio_url: string;
  speaker_labels: boolean;
  speakers_expected?: number;
  punctuate?: boolean;
  format_text?: boolean;
}

interface AssemblyAIUtterance {
  speaker: string;
  start: number;
  end: number;
  text: string;
  confidence: number;
}

interface AssemblyAITranscriptResponse {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  text?: string;
  utterances?: AssemblyAIUtterance[];
  audio_duration?: number;
  language_code?: string;
  error?: string;
}

// =============================================================================
// Speaker Diarization Service Implementation
// =============================================================================

const ASSEMBLYAI_API_URL = 'https://api.assemblyai.com/v2';
const POLLING_INTERVAL_MS = 3000;
const MAX_POLLING_ATTEMPTS = 200; // ~10 minutes max

const makeService = Effect.gen(function* () {
  const apiKey = env.ASSEMBLYAI_API_KEY;
  const isConfigured = !!apiKey;

  const isAvailable = (): boolean => isConfigured;

  const diarizeFromUrl = (
    audioUrl: string,
    options?: DiarizationOptions,
  ): Effect.Effect<DiarizationResult, DiarizationError | DiarizationNotConfiguredError> =>
    Effect.gen(function* () {
      if (!apiKey) {
        return yield* Effect.fail(
          new DiarizationNotConfiguredError({
            message: 'AssemblyAI API key not configured. Please set ASSEMBLYAI_API_KEY environment variable.',
          }),
        );
      }

      // Step 1: Submit transcription request
      const transcriptId = yield* submitTranscription(apiKey, audioUrl, options);

      // Step 2: Poll for completion
      const result = yield* pollForCompletion(apiKey, transcriptId);

      // Step 3: Process and return results
      return processResult(result);
    });

  return {
    diarizeFromUrl,
    isAvailable,
  } satisfies SpeakerDiarizationServiceInterface;
});

/**
 * Submit a transcription request to AssemblyAI
 */
const submitTranscription = (
  apiKey: string,
  audioUrl: string,
  options?: DiarizationOptions,
): Effect.Effect<string, DiarizationError> =>
  Effect.tryPromise({
    try: async () => {
      const requestBody: AssemblyAITranscriptRequest = {
        audio_url: audioUrl,
        speaker_labels: true,
        speakers_expected: options?.speakersExpected,
        punctuate: options?.punctuate ?? true,
        format_text: options?.formatText ?? true,
      };

      const response = await fetch(`${ASSEMBLYAI_API_URL}/transcript`, {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AssemblyAI API error: ${response.status} - ${errorText}`);
      }

      const data = (await response.json()) as { id: string };
      return data.id;
    },
    catch: (error) =>
      new DiarizationError({
        message: 'Failed to submit transcription request',
        operation: 'submitTranscription',
        cause: error,
      }),
  });

/**
 * Poll AssemblyAI for transcription completion
 */
const pollForCompletion = (
  apiKey: string,
  transcriptId: string,
): Effect.Effect<AssemblyAITranscriptResponse, DiarizationError> =>
  Effect.gen(function* () {
    for (let attempt = 0; attempt < MAX_POLLING_ATTEMPTS; attempt++) {
      const status = yield* checkTranscriptStatus(apiKey, transcriptId);

      if (status.status === 'completed') {
        return status;
      }

      if (status.status === 'error') {
        return yield* Effect.fail(
          new DiarizationError({
            message: status.error || 'Transcription failed',
            operation: 'pollForCompletion',
          }),
        );
      }

      // Wait before next poll
      yield* Effect.sleep(POLLING_INTERVAL_MS);
    }

    return yield* Effect.fail(
      new DiarizationError({
        message: 'Transcription timed out after maximum polling attempts',
        operation: 'pollForCompletion',
      }),
    );
  });

/**
 * Check the status of a transcript
 */
const checkTranscriptStatus = (
  apiKey: string,
  transcriptId: string,
): Effect.Effect<AssemblyAITranscriptResponse, DiarizationError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(`${ASSEMBLYAI_API_URL}/transcript/${transcriptId}`, {
        headers: {
          Authorization: apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AssemblyAI API error: ${response.status} - ${errorText}`);
      }

      return (await response.json()) as AssemblyAITranscriptResponse;
    },
    catch: (error) =>
      new DiarizationError({
        message: 'Failed to check transcript status',
        operation: 'checkTranscriptStatus',
        cause: error,
      }),
  });

/**
 * Process AssemblyAI response into our result format
 */
const processResult = (response: AssemblyAITranscriptResponse): DiarizationResult => {
  const utterances = response.utterances || [];
  const durationMs = (response.audio_duration || 0) * 1000;

  // Convert utterances to our segment format
  const segments: DiarizedSegment[] = utterances.map((u) => ({
    speaker: u.speaker,
    start: u.start,
    end: u.end,
    text: u.text,
    confidence: u.confidence,
  }));

  // Calculate per-speaker statistics
  const speakerStats = new Map<string, { time: number; count: number }>();

  for (const segment of segments) {
    const duration = segment.end - segment.start;
    const existing = speakerStats.get(segment.speaker) || { time: 0, count: 0 };
    speakerStats.set(segment.speaker, {
      time: existing.time + duration,
      count: existing.count + 1,
    });
  }

  // Calculate total speaking time
  const totalSpeakingTime = Array.from(speakerStats.values()).reduce((sum, s) => sum + s.time, 0);

  // Build speaker summaries
  const speakers: SpeakerSummary[] = Array.from(speakerStats.entries()).map(([speaker, stats]) => ({
    speaker,
    totalSpeakingTime: stats.time,
    segmentCount: stats.count,
    speakingPercentage: totalSpeakingTime > 0 ? Math.round((stats.time / totalSpeakingTime) * 100) : 0,
  }));

  // Sort speakers by speaking time (descending)
  speakers.sort((a, b) => b.totalSpeakingTime - a.totalSpeakingTime);

  return {
    transcript: response.text || '',
    segments,
    speakers,
    duration: durationMs,
    language: response.language_code,
    speakerCount: speakers.length,
  };
};

// =============================================================================
// Speaker Diarization Layer
// =============================================================================

export const SpeakerDiarizationLive = Layer.effect(SpeakerDiarization, makeService);

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Diarize audio from a URL
 */
export const diarizeFromUrl = (
  audioUrl: string,
  options?: DiarizationOptions,
): Effect.Effect<DiarizationResult, DiarizationError | DiarizationNotConfiguredError, SpeakerDiarization> =>
  Effect.gen(function* () {
    const service = yield* SpeakerDiarization;
    return yield* service.diarizeFromUrl(audioUrl, options);
  });

/**
 * Check if diarization service is available
 */
export const isDiarizationAvailable = (): Effect.Effect<boolean, never, SpeakerDiarization> =>
  Effect.gen(function* () {
    const service = yield* SpeakerDiarization;
    return service.isAvailable();
  });

/**
 * Calculate a "balance score" for speaker participation
 * Higher scores indicate more balanced participation
 * @param speakers - Array of speaker summaries
 * @returns Score from 0-100 (100 = perfectly balanced)
 */
export const calculateBalanceScore = (speakers: ReadonlyArray<SpeakerSummary>): number => {
  if (speakers.length === 0) return 100;
  if (speakers.length === 1) return 100;

  // Calculate ideal percentage per speaker
  const idealPercentage = 100 / speakers.length;

  // Calculate deviation from ideal
  const totalDeviation = speakers.reduce((sum, s) => {
    return sum + Math.abs(s.speakingPercentage - idealPercentage);
  }, 0);

  // Maximum possible deviation (all time to one speaker)
  const maxDeviation = 2 * (100 - idealPercentage);

  // Convert to 0-100 score (inverted so higher = better balance)
  const score = Math.max(0, Math.round(100 - (totalDeviation / maxDeviation) * 100));

  return score;
};
