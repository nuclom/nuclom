/**
 * WebVTT Subtitle Generation
 *
 * Provides utilities to generate WebVTT subtitle files from transcript segments.
 * WebVTT (Web Video Text Tracks) is the standard format for HTML5 video captions.
 */

import { Context, Data, Effect, Layer, Schema } from "effect";
import type { TranscriptSegment } from "./db/schema";

// =============================================================================
// Error Types
// =============================================================================

export class SubtitleError extends Data.TaggedError("SubtitleError")<{
  readonly message: string;
  readonly operation?: string;
  readonly cause?: unknown;
}> {}

export class TranslationError extends Data.TaggedError("TranslationError")<{
  readonly message: string;
  readonly targetLanguage: string;
  readonly cause?: unknown;
}> {}

// =============================================================================
// Types & Schemas
// =============================================================================

export const TranscriptSegmentSchema = Schema.Struct({
  startTime: Schema.Number,
  endTime: Schema.Number,
  text: Schema.String,
  confidence: Schema.optional(Schema.Number),
});

export const SubtitleLanguageSchema = Schema.Struct({
  code: Schema.String,
  name: Schema.String,
  isOriginal: Schema.Boolean,
});

export type SubtitleLanguage = Schema.Schema.Type<typeof SubtitleLanguageSchema>;

export const TranslatedSegment = Schema.Struct({
  ...TranscriptSegmentSchema.fields,
  language: Schema.String,
  originalText: Schema.optional(Schema.String),
});

export type TranslatedSegmentType = Schema.Schema.Type<typeof TranslatedSegment>;

// =============================================================================
// WebVTT Time Formatting
// =============================================================================

/**
 * Format time in seconds to WebVTT timestamp format (HH:MM:SS.mmm)
 */
export function formatVTTTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00:00.000";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);

  const hh = hours.toString().padStart(2, "0");
  const mm = minutes.toString().padStart(2, "0");
  const ss = secs.toString().padStart(2, "0");
  const ms = milliseconds.toString().padStart(3, "0");

  return `${hh}:${mm}:${ss}.${ms}`;
}

/**
 * Parse WebVTT timestamp to seconds
 */
export function parseVTTTime(timestamp: string): number {
  const parts = timestamp.split(":");

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    const [secs, ms] = seconds.split(".");
    return (
      Number.parseInt(hours, 10) * 3600 +
      Number.parseInt(minutes, 10) * 60 +
      Number.parseInt(secs, 10) +
      (ms ? Number.parseInt(ms, 10) / 1000 : 0)
    );
  }

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    const [secs, ms] = seconds.split(".");
    return Number.parseInt(minutes, 10) * 60 + Number.parseInt(secs, 10) + (ms ? Number.parseInt(ms, 10) / 1000 : 0);
  }

  return 0;
}

// =============================================================================
// WebVTT Generation
// =============================================================================

export interface WebVTTOptions {
  /** Include cue settings (positioning, alignment) */
  includeSettings?: boolean;
  /** Max characters per line before wrapping */
  maxLineLength?: number;
  /** Language code for the subtitles */
  language?: string;
  /** Add line breaks for long segments */
  wrapLines?: boolean;
}

/**
 * Generate WebVTT subtitle content from transcript segments
 */
export function generateWebVTT(segments: readonly TranscriptSegment[], options: WebVTTOptions = {}): string {
  const { maxLineLength = 42, wrapLines = true } = options;

  let vtt = "WEBVTT\n";

  // Add metadata header if language is specified
  if (options.language) {
    vtt += `Kind: captions\nLanguage: ${options.language}\n`;
  }

  vtt += "\n";

  segments.forEach((segment, index) => {
    // Cue identifier (optional but helpful for debugging)
    vtt += `${index + 1}\n`;

    // Timestamp line
    vtt += `${formatVTTTime(segment.startTime)} --> ${formatVTTTime(segment.endTime)}`;

    // Optional cue settings
    if (options.includeSettings) {
      vtt += " align:center";
    }

    vtt += "\n";

    // Cue text - wrap long lines if needed
    let text = segment.text.trim();

    if (wrapLines && text.length > maxLineLength) {
      text = wrapText(text, maxLineLength);
    }

    // Escape special WebVTT characters
    text = escapeVTTText(text);

    vtt += `${text}\n\n`;
  });

  return vtt;
}

/**
 * Wrap text to fit within maxLineLength, breaking at word boundaries
 */
function wrapText(text: string, maxLength: number): string {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (currentLine.length === 0) {
      currentLine = word;
    } else if (currentLine.length + word.length + 1 <= maxLength) {
      currentLine += ` ${word}`;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines.join("\n");
}

/**
 * Escape special characters for WebVTT
 */
function escapeVTTText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

// =============================================================================
// SRT Generation (for compatibility)
// =============================================================================

/**
 * Format time in seconds to SRT timestamp format (HH:MM:SS,mmm)
 */
export function formatSRTTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00:00,000";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);

  const hh = hours.toString().padStart(2, "0");
  const mm = minutes.toString().padStart(2, "0");
  const ss = secs.toString().padStart(2, "0");
  const ms = milliseconds.toString().padStart(3, "0");

  return `${hh}:${mm}:${ss},${ms}`;
}

/**
 * Generate SRT subtitle content from transcript segments
 */
export function generateSRT(segments: readonly TranscriptSegment[]): string {
  let srt = "";

  segments.forEach((segment, index) => {
    srt += `${index + 1}\n`;
    srt += `${formatSRTTime(segment.startTime)} --> ${formatSRTTime(segment.endTime)}\n`;
    srt += `${segment.text.trim()}\n\n`;
  });

  return srt;
}

// =============================================================================
// Subtitle Service Interface
// =============================================================================

export interface SubtitleServiceInterface {
  /**
   * Generate WebVTT subtitles from transcript segments
   */
  readonly generateWebVTT: (
    segments: readonly TranscriptSegment[],
    options?: WebVTTOptions,
  ) => Effect.Effect<string, SubtitleError>;

  /**
   * Generate SRT subtitles from transcript segments
   */
  readonly generateSRT: (segments: readonly TranscriptSegment[]) => Effect.Effect<string, SubtitleError>;

  /**
   * Translate transcript segments to another language
   */
  readonly translateSegments: (
    segments: readonly TranscriptSegment[],
    targetLanguage: string,
  ) => Effect.Effect<TranscriptSegment[], TranslationError>;

  /**
   * Get available subtitle languages for a video
   */
  readonly getAvailableLanguages: (
    videoId: string,
    hasTranslations: boolean,
  ) => Effect.Effect<SubtitleLanguage[], SubtitleError>;
}

// =============================================================================
// Subtitle Service Tag
// =============================================================================

export class SubtitleService extends Context.Tag("SubtitleService")<SubtitleService, SubtitleServiceInterface>() {}

// =============================================================================
// Subtitle Service Implementation
// =============================================================================

const makeSubtitleService = Effect.gen(function* () {
  const generateWebVTTEffect = (
    segments: readonly TranscriptSegment[],
    options?: WebVTTOptions,
  ): Effect.Effect<string, SubtitleError> =>
    Effect.gen(function* () {
      if (!segments || segments.length === 0) {
        return yield* Effect.fail(
          new SubtitleError({
            message: "No transcript segments provided",
            operation: "generateWebVTT",
          }),
        );
      }

      try {
        return generateWebVTT(segments, options);
      } catch (error) {
        return yield* Effect.fail(
          new SubtitleError({
            message: "Failed to generate WebVTT",
            operation: "generateWebVTT",
            cause: error,
          }),
        );
      }
    });

  const generateSRTEffect = (segments: readonly TranscriptSegment[]): Effect.Effect<string, SubtitleError> =>
    Effect.gen(function* () {
      if (!segments || segments.length === 0) {
        return yield* Effect.fail(
          new SubtitleError({
            message: "No transcript segments provided",
            operation: "generateSRT",
          }),
        );
      }

      try {
        return generateSRT(segments);
      } catch (error) {
        return yield* Effect.fail(
          new SubtitleError({
            message: "Failed to generate SRT",
            operation: "generateSRT",
            cause: error,
          }),
        );
      }
    });

  const translateSegments = (
    _segments: readonly TranscriptSegment[],
    targetLanguage: string,
  ): Effect.Effect<TranscriptSegment[], TranslationError> =>
    Effect.gen(function* () {
      // This will be implemented with DeepL integration
      // For now, return original segments as a passthrough
      return yield* Effect.fail(
        new TranslationError({
          message: "Translation not yet implemented - use Translation service",
          targetLanguage,
        }),
      );
    });

  const getAvailableLanguages = (
    _videoId: string,
    hasTranslations: boolean,
  ): Effect.Effect<SubtitleLanguage[], SubtitleError> => {
    // Base languages - original transcript is always available if segments exist
    const languages: SubtitleLanguage[] = [{ code: "en", name: "English", isOriginal: true }];

    // Add translated languages if available
    if (hasTranslations) {
      languages.push(
        { code: "es", name: "Spanish", isOriginal: false },
        { code: "fr", name: "French", isOriginal: false },
        { code: "de", name: "German", isOriginal: false },
        { code: "pt", name: "Portuguese", isOriginal: false },
        { code: "ja", name: "Japanese", isOriginal: false },
        { code: "zh", name: "Chinese", isOriginal: false },
      );
    }

    return Effect.succeed(languages);
  };

  return {
    generateWebVTT: generateWebVTTEffect,
    generateSRT: generateSRTEffect,
    translateSegments,
    getAvailableLanguages,
  } satisfies SubtitleServiceInterface;
});

// =============================================================================
// Subtitle Service Layer
// =============================================================================

export const SubtitleServiceLive = Layer.effect(SubtitleService, makeSubtitleService);

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Find the current segment based on playback time
 */
export function findCurrentSegment(
  segments: readonly TranscriptSegment[],
  currentTime: number,
): TranscriptSegment | null {
  if (!segments || segments.length === 0) {
    return null;
  }

  return segments.find((segment) => currentTime >= segment.startTime && currentTime < segment.endTime) || null;
}

/**
 * Find segment index by time
 */
export function findSegmentIndexByTime(segments: readonly TranscriptSegment[], time: number): number {
  if (!segments || segments.length === 0) {
    return -1;
  }

  return segments.findIndex((segment) => time >= segment.startTime && time < segment.endTime);
}

/**
 * Get segments within a time range
 */
export function getSegmentsInRange(
  segments: readonly TranscriptSegment[],
  startTime: number,
  endTime: number,
): TranscriptSegment[] {
  return segments.filter(
    (segment) =>
      (segment.startTime >= startTime && segment.startTime < endTime) ||
      (segment.endTime > startTime && segment.endTime <= endTime) ||
      (segment.startTime <= startTime && segment.endTime >= endTime),
  );
}

/**
 * Merge adjacent segments that are close together (for smoother reading)
 */
export function mergeAdjacentSegments(
  segments: readonly TranscriptSegment[],
  maxGap: number = 0.5,
  maxDuration: number = 7,
): TranscriptSegment[] {
  if (!segments || segments.length === 0) {
    return [];
  }

  const merged: TranscriptSegment[] = [];
  let current: TranscriptSegment | null = null;

  for (const segment of segments) {
    if (!current) {
      current = { ...segment };
      continue;
    }

    const gap = segment.startTime - current.endTime;
    const combinedDuration = segment.endTime - current.startTime;

    if (gap <= maxGap && combinedDuration <= maxDuration) {
      // Merge segments
      current = {
        startTime: current.startTime,
        endTime: segment.endTime,
        text: `${current.text} ${segment.text}`,
        confidence:
          current.confidence && segment.confidence
            ? (current.confidence + segment.confidence) / 2
            : current.confidence || segment.confidence,
      };
    } else {
      merged.push(current);
      current = { ...segment };
    }
  }

  if (current) {
    merged.push(current);
  }

  return merged;
}

/**
 * Split long segments into smaller chunks for better readability
 */
export function splitLongSegments(
  segments: readonly TranscriptSegment[],
  maxCharsPerSegment: number = 80,
): TranscriptSegment[] {
  const result: TranscriptSegment[] = [];

  for (const segment of segments) {
    if (segment.text.length <= maxCharsPerSegment) {
      result.push(segment);
      continue;
    }

    // Split by sentences or phrases
    const sentences = segment.text.match(/[^.!?]+[.!?]+/g) || [segment.text];
    const duration = segment.endTime - segment.startTime;
    const totalChars = segment.text.length;
    let currentStart = segment.startTime;

    for (const sentence of sentences) {
      const sentenceRatio = sentence.length / totalChars;
      const sentenceDuration = duration * sentenceRatio;

      result.push({
        startTime: currentStart,
        endTime: currentStart + sentenceDuration,
        text: sentence.trim(),
        confidence: segment.confidence,
      });

      currentStart += sentenceDuration;
    }
  }

  return result;
}
