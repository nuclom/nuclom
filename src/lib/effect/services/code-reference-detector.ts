/**
 * Code Reference Detection Service using Effect-TS
 *
 * Analyzes video transcripts to automatically detect references to:
 * - Pull requests (PR #123, pull request 123)
 * - Issues (issue #456)
 * - Commits (commit abc1234)
 * - Files (user.ts, src/lib/auth.ts)
 * - Modules/Services (the auth module, UserService class)
 */

import { Context, Effect, Layer } from 'effect';
import type { DetectedCodeRef, TranscriptSegment } from '@/lib/db/schema';

// =============================================================================
// Types
// =============================================================================

export interface CodeReferenceDetectorConfig {
  readonly suggestedRepo?: string; // Default repo to suggest for detected refs
  readonly minConfidence?: number; // Minimum confidence threshold (0-1)
}

export interface DetectionResult {
  readonly references: DetectedCodeRef[];
  readonly metadata: {
    readonly totalSegmentsAnalyzed: number;
    readonly totalReferencesFound: number;
    readonly detectionTimeMs: number;
  };
}

// =============================================================================
// Code Patterns
// =============================================================================

const CODE_PATTERNS = {
  // PR patterns: "PR 123", "PR #123", "pull request 123", "pull request #123"
  pr: [/\bPR\s*#?(\d+)\b/gi, /\bpull\s*request\s*#?(\d+)\b/gi, /\bmerge\s*request\s*#?(\d+)\b/gi],

  // Issue patterns: "issue 456", "issue #456", "bug #789"
  issue: [/\bissue\s*#?(\d+)\b/gi, /\bbug\s*#?(\d+)\b/gi, /\bticket\s*#?(\d+)\b/gi, /\bfeature\s*#?(\d+)\b/gi],

  // Commit patterns: "commit abc1234", "SHA abc1234f"
  commit: [
    /\bcommit\s+([a-f0-9]{7,40})\b/gi,
    /\bsha\s+([a-f0-9]{7,40})\b/gi,
    /\b([a-f0-9]{7,40})\b/gi, // Standalone SHA (lower confidence)
  ],

  // File patterns: "user.ts", "auth.py", "src/lib/utils.ts"
  file: [
    /\b([a-zA-Z_][a-zA-Z0-9_]*\.(ts|tsx|js|jsx|py|go|rs|java|rb|php|cs|cpp|c|h|hpp|swift|kt|scala|ex|exs|clj|vue|svelte|md|json|yaml|yml|toml|xml|html|css|scss|sass|less))\b/g,
    /\b(src\/[a-zA-Z0-9_\-/]+\.[a-z]+)\b/g,
    /\b(lib\/[a-zA-Z0-9_\-/]+\.[a-z]+)\b/g,
    /\b(app\/[a-zA-Z0-9_\-/]+\.[a-z]+)\b/g,
    /\b(components\/[a-zA-Z0-9_\-/]+\.[a-z]+)\b/g,
  ],

  // Module/service patterns: "the auth module", "UserService class"
  module: [
    /\bthe\s+(\w+)\s+(module|service|component|class|controller|middleware|handler|repository|provider)\b/gi,
    /\b(\w+)(Service|Repository|Controller|Module|Component|Handler|Middleware|Provider)\b/g,
  ],
};

// Confidence levels for different pattern types
const CONFIDENCE_LEVELS: Record<string, number> = {
  pr_explicit: 0.95, // "PR #123"
  pr_text: 0.85, // "pull request 123"
  issue_explicit: 0.95, // "issue #123"
  issue_text: 0.85, // "bug 123"
  commit_explicit: 0.9, // "commit abc1234"
  commit_sha_only: 0.6, // Standalone SHA
  file_path: 0.85, // "src/lib/auth.ts"
  file_name: 0.7, // "auth.ts" (might be just mentioning)
  module_explicit: 0.8, // "the auth module"
  module_class: 0.75, // "UserService"
};

// =============================================================================
// Code Reference Detector Interface
// =============================================================================

export interface CodeReferenceDetectorInterface {
  /**
   * Detect code references in transcript text
   */
  readonly detectInText: (
    text: string,
    timestamp?: number,
    config?: CodeReferenceDetectorConfig,
  ) => Effect.Effect<DetectedCodeRef[], never>;

  /**
   * Detect code references in transcript segments
   */
  readonly detectInTranscript: (
    segments: TranscriptSegment[],
    config?: CodeReferenceDetectorConfig,
  ) => Effect.Effect<DetectionResult, never>;

  /**
   * Detect code references in plain transcript text with timestamps
   */
  readonly detectInTranscriptText: (
    transcript: string,
    config?: CodeReferenceDetectorConfig,
  ) => Effect.Effect<DetectedCodeRef[], never>;
}

// =============================================================================
// Code Reference Detector Tag
// =============================================================================

export class CodeReferenceDetector extends Context.Tag('CodeReferenceDetector')<
  CodeReferenceDetector,
  CodeReferenceDetectorInterface
>() {}

// =============================================================================
// Code Reference Detector Implementation
// =============================================================================

const makeCodeReferenceDetectorService = Effect.gen(function* () {
  const detectInText = (
    text: string,
    timestamp = 0,
    config?: CodeReferenceDetectorConfig,
  ): Effect.Effect<DetectedCodeRef[], never> =>
    Effect.sync(() => {
      const references: DetectedCodeRef[] = [];
      const minConfidence = config?.minConfidence ?? 0.5;
      const suggestedRepo = config?.suggestedRepo;

      // Detect PR references
      for (const pattern of CODE_PATTERNS.pr) {
        pattern.lastIndex = 0; // Reset regex state
        for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
          const isExplicit = match[0].toLowerCase().includes('pr');
          const confidence = isExplicit ? CONFIDENCE_LEVELS.pr_explicit : CONFIDENCE_LEVELS.pr_text;

          if (confidence >= minConfidence) {
            references.push({
              type: 'pr',
              reference: match[1],
              timestamp,
              confidence,
              suggestedRepo,
            });
          }
        }
      }

      // Detect issue references
      for (const pattern of CODE_PATTERNS.issue) {
        pattern.lastIndex = 0;
        for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
          const isExplicit = match[0].toLowerCase().includes('issue');
          const confidence = isExplicit ? CONFIDENCE_LEVELS.issue_explicit : CONFIDENCE_LEVELS.issue_text;

          if (confidence >= minConfidence) {
            references.push({
              type: 'issue',
              reference: match[1],
              timestamp,
              confidence,
              suggestedRepo,
            });
          }
        }
      }

      // Detect commit references
      for (let i = 0; i < CODE_PATTERNS.commit.length; i++) {
        const pattern = CODE_PATTERNS.commit[i];
        pattern.lastIndex = 0;
        for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
          // Lower confidence for standalone SHAs (last pattern)
          const confidence =
            i < CODE_PATTERNS.commit.length - 1 ? CONFIDENCE_LEVELS.commit_explicit : CONFIDENCE_LEVELS.commit_sha_only;

          if (confidence >= minConfidence) {
            references.push({
              type: 'commit',
              reference: match[1],
              timestamp,
              confidence,
              suggestedRepo,
            });
          }
        }
      }

      // Detect file references
      for (let i = 0; i < CODE_PATTERNS.file.length; i++) {
        const pattern = CODE_PATTERNS.file[i];
        pattern.lastIndex = 0;
        for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
          // Higher confidence for full paths
          const isPath = match[1].includes('/');
          const confidence = isPath ? CONFIDENCE_LEVELS.file_path : CONFIDENCE_LEVELS.file_name;

          if (confidence >= minConfidence) {
            references.push({
              type: 'file',
              reference: match[1],
              timestamp,
              confidence,
              suggestedRepo,
            });
          }
        }
      }

      // Detect module references
      for (let i = 0; i < CODE_PATTERNS.module.length; i++) {
        const pattern = CODE_PATTERNS.module[i];
        pattern.lastIndex = 0;
        for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
          const isExplicit = match[0].toLowerCase().includes('the ');
          const confidence = isExplicit ? CONFIDENCE_LEVELS.module_explicit : CONFIDENCE_LEVELS.module_class;

          if (confidence >= minConfidence) {
            const moduleName = match[1];
            // Skip common words that aren't likely to be code references
            const skipWords = ['the', 'a', 'an', 'this', 'that', 'my', 'your', 'our'];
            if (!skipWords.includes(moduleName.toLowerCase())) {
              references.push({
                type: 'module',
                reference: moduleName,
                timestamp,
                confidence,
                suggestedRepo,
              });
            }
          }
        }
      }

      // Deduplicate references (same type + reference)
      const uniqueRefs = new Map<string, DetectedCodeRef>();
      for (const ref of references) {
        const key = `${ref.type}:${ref.reference}`;
        const existing = uniqueRefs.get(key);
        if (!existing || ref.confidence > existing.confidence) {
          uniqueRefs.set(key, ref);
        }
      }

      return Array.from(uniqueRefs.values()).sort((a, b) => b.confidence - a.confidence);
    });

  const detectInTranscript = (
    segments: TranscriptSegment[],
    config?: CodeReferenceDetectorConfig,
  ): Effect.Effect<DetectionResult, never> =>
    Effect.sync(() => {
      const startTime = Date.now();
      const allReferences: DetectedCodeRef[] = [];

      for (const segment of segments) {
        const refs = Effect.runSync(detectInText(segment.text, segment.startTime, config));
        allReferences.push(...refs);
      }

      // Deduplicate across segments (keep earliest timestamp for each ref)
      const uniqueRefs = new Map<string, DetectedCodeRef>();
      for (const ref of allReferences) {
        const key = `${ref.type}:${ref.reference}`;
        const existing = uniqueRefs.get(key);
        if (!existing || ref.timestamp < existing.timestamp) {
          uniqueRefs.set(key, ref);
        }
      }

      const references = Array.from(uniqueRefs.values()).sort((a, b) => a.timestamp - b.timestamp);

      return {
        references,
        metadata: {
          totalSegmentsAnalyzed: segments.length,
          totalReferencesFound: references.length,
          detectionTimeMs: Date.now() - startTime,
        },
      };
    });

  const detectInTranscriptText = (
    transcript: string,
    config?: CodeReferenceDetectorConfig,
  ): Effect.Effect<DetectedCodeRef[], never> =>
    Effect.sync(() => {
      // For plain text transcripts, detect references without timestamps
      return Effect.runSync(detectInText(transcript, 0, config));
    });

  return {
    detectInText,
    detectInTranscript,
    detectInTranscriptText,
  } satisfies CodeReferenceDetectorInterface;
});

// =============================================================================
// Code Reference Detector Layer
// =============================================================================

export const CodeReferenceDetectorLive = Layer.effect(CodeReferenceDetector, makeCodeReferenceDetectorService);

// =============================================================================
// Code Reference Detector Helper Functions
// =============================================================================

export const detectCodeRefsInText = (
  text: string,
  timestamp?: number,
  config?: CodeReferenceDetectorConfig,
): Effect.Effect<DetectedCodeRef[], never, CodeReferenceDetector> =>
  Effect.gen(function* () {
    const detector = yield* CodeReferenceDetector;
    return yield* detector.detectInText(text, timestamp, config);
  });

export const detectCodeRefsInTranscript = (
  segments: TranscriptSegment[],
  config?: CodeReferenceDetectorConfig,
): Effect.Effect<DetectionResult, never, CodeReferenceDetector> =>
  Effect.gen(function* () {
    const detector = yield* CodeReferenceDetector;
    return yield* detector.detectInTranscript(segments, config);
  });
