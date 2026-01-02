/**
 * Code Reference Detection Service using Effect-TS
 *
 * Detects code references (PRs, issues, commits, files) in video transcripts
 * and generates suggestions for linking videos to code artifacts.
 */

import { Context, Effect, Layer } from "effect";
import type { TranscriptSegment } from "@/lib/db/schema";
import type { CodeLinkType } from "@/lib/db/schema";

// =============================================================================
// Types
// =============================================================================

export interface DetectedCodeReference {
  readonly type: CodeLinkType;
  readonly reference: string;
  readonly timestamp: number;
  readonly timestampEnd?: number;
  readonly confidence: number;
  readonly rawMatch: string;
  readonly suggestedRepo?: string;
  readonly suggestedUrl?: string;
}

export interface CodeReferencePattern {
  readonly pattern: RegExp;
  readonly type: CodeLinkType;
  readonly extractReference: (match: RegExpMatchArray) => string;
  readonly baseConfidence: number;
}

export interface DetectionOptions {
  readonly defaultRepo?: string;
  readonly organizationRepos?: string[];
  readonly minConfidence?: number;
}

export interface DetectionResult {
  readonly references: DetectedCodeReference[];
  readonly stats: {
    readonly totalReferences: number;
    readonly byType: Record<CodeLinkType, number>;
    readonly averageConfidence: number;
  };
}

// =============================================================================
// Code Reference Patterns
// =============================================================================

const CODE_PATTERNS: CodeReferencePattern[] = [
  // PR patterns - highest confidence
  {
    pattern: /\bPR\s*#?(\d+)\b/gi,
    type: "pr",
    extractReference: (match) => match[1],
    baseConfidence: 95,
  },
  {
    pattern: /\bpull\s+request\s*#?(\d+)\b/gi,
    type: "pr",
    extractReference: (match) => match[1],
    baseConfidence: 98,
  },
  {
    pattern: /\bmerge\s+request\s*#?(\d+)\b/gi,
    type: "pr",
    extractReference: (match) => match[1],
    baseConfidence: 95,
  },
  // GitHub PR URL pattern
  {
    pattern: /github\.com\/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)\/pull\/(\d+)/gi,
    type: "pr",
    extractReference: (match) => match[2],
    baseConfidence: 100,
  },

  // Issue patterns
  {
    pattern: /\bissue\s*#?(\d+)\b/gi,
    type: "issue",
    extractReference: (match) => match[1],
    baseConfidence: 90,
  },
  {
    pattern: /\bbug\s*#?(\d+)\b/gi,
    type: "issue",
    extractReference: (match) => match[1],
    baseConfidence: 85,
  },
  {
    pattern: /\bticket\s*#?(\d+)\b/gi,
    type: "issue",
    extractReference: (match) => match[1],
    baseConfidence: 80,
  },
  // GitHub Issue URL pattern
  {
    pattern: /github\.com\/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)\/issues\/(\d+)/gi,
    type: "issue",
    extractReference: (match) => match[2],
    baseConfidence: 100,
  },

  // Commit patterns
  {
    pattern: /\bcommit\s+([a-f0-9]{7,40})\b/gi,
    type: "commit",
    extractReference: (match) => match[1],
    baseConfidence: 95,
  },
  {
    pattern: /\b([a-f0-9]{40})\b/g,
    type: "commit",
    extractReference: (match) => match[1],
    baseConfidence: 70, // Lower confidence for bare SHA
  },
  {
    pattern: /\bsha\s+([a-f0-9]{7,40})\b/gi,
    type: "commit",
    extractReference: (match) => match[1],
    baseConfidence: 90,
  },
  // GitHub Commit URL pattern
  {
    pattern: /github\.com\/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)\/commit\/([a-f0-9]{7,40})/gi,
    type: "commit",
    extractReference: (match) => match[2],
    baseConfidence: 100,
  },

  // File patterns - look for common file extensions
  {
    pattern: /\b([a-zA-Z_][a-zA-Z0-9_-]*\.(ts|tsx|js|jsx|py|go|rs|java|rb|cpp|c|h|hpp|swift|kt|scala|vue|svelte|astro))\b/g,
    type: "file",
    extractReference: (match) => match[1],
    baseConfidence: 70,
  },
  // File paths
  {
    pattern: /\b(src\/[a-zA-Z0-9_\-./]+\.[a-z]+)\b/g,
    type: "file",
    extractReference: (match) => match[1],
    baseConfidence: 85,
  },
  {
    pattern: /\b(lib\/[a-zA-Z0-9_\-./]+\.[a-z]+)\b/g,
    type: "file",
    extractReference: (match) => match[1],
    baseConfidence: 85,
  },
  {
    pattern: /\b(app\/[a-zA-Z0-9_\-./]+\.[a-z]+)\b/g,
    type: "file",
    extractReference: (match) => match[1],
    baseConfidence: 85,
  },
  {
    pattern: /\b(components\/[a-zA-Z0-9_\-./]+\.[a-z]+)\b/g,
    type: "file",
    extractReference: (match) => match[1],
    baseConfidence: 85,
  },
  {
    pattern: /\b(pages\/[a-zA-Z0-9_\-./]+\.[a-z]+)\b/g,
    type: "file",
    extractReference: (match) => match[1],
    baseConfidence: 85,
  },

  // Directory patterns
  {
    pattern: /\b(src\/[a-zA-Z0-9_\-/]+)\b(?!\.)/g,
    type: "directory",
    extractReference: (match) => match[1],
    baseConfidence: 60,
  },
  {
    pattern: /\bthe\s+([a-zA-Z_][a-zA-Z0-9_-]+)\s+(module|service|component|class|folder|directory)\b/gi,
    type: "directory",
    extractReference: (match) => match[1],
    baseConfidence: 50,
  },
];

// =============================================================================
// Code Reference Detector Interface
// =============================================================================

export interface CodeReferenceDetectorService {
  /**
   * Detect code references in a transcript
   */
  readonly detectInTranscript: (
    transcript: string,
    segments?: TranscriptSegment[],
    options?: DetectionOptions,
  ) => Effect.Effect<DetectionResult, never>;

  /**
   * Detect code references in text with a known timestamp range
   */
  readonly detectInText: (
    text: string,
    timestampStart: number,
    timestampEnd?: number,
    options?: DetectionOptions,
  ) => Effect.Effect<DetectedCodeReference[], never>;

  /**
   * Get all supported patterns
   */
  readonly getPatterns: () => CodeReferencePattern[];

  /**
   * Validate a detected reference
   */
  readonly validateReference: (
    reference: DetectedCodeReference,
    options?: DetectionOptions,
  ) => Effect.Effect<DetectedCodeReference, never>;

  /**
   * Deduplicate and merge overlapping references
   */
  readonly deduplicateReferences: (
    references: DetectedCodeReference[],
  ) => Effect.Effect<DetectedCodeReference[], never>;

  /**
   * Generate GitHub URLs for detected references
   */
  readonly generateUrls: (
    references: DetectedCodeReference[],
    repo: string,
  ) => Effect.Effect<DetectedCodeReference[], never>;
}

// =============================================================================
// Code Reference Detector Tag
// =============================================================================

export class CodeReferenceDetector extends Context.Tag("CodeReferenceDetector")<
  CodeReferenceDetector,
  CodeReferenceDetectorService
>() {}

// =============================================================================
// Code Reference Detector Implementation
// =============================================================================

const makeCodeReferenceDetector = Effect.gen(function* () {
  const detectInText = (
    text: string,
    timestampStart: number,
    timestampEnd?: number,
    options: DetectionOptions = {},
  ): Effect.Effect<DetectedCodeReference[], never> =>
    Effect.sync(() => {
      const references: DetectedCodeReference[] = [];
      const minConfidence = options.minConfidence ?? 50;

      for (const pattern of CODE_PATTERNS) {
        const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
          const reference = pattern.extractReference(match);
          let confidence = pattern.baseConfidence;

          // Boost confidence if we have a default repo context
          if (options.defaultRepo && pattern.type !== "file" && pattern.type !== "directory") {
            confidence = Math.min(confidence + 5, 100);
          }

          // Boost confidence for explicit URL matches
          if (match[0].includes("github.com")) {
            confidence = 100;
          }

          // Skip if below minimum confidence
          if (confidence < minConfidence) continue;

          // Extract repo from GitHub URL if present
          let suggestedRepo = options.defaultRepo;
          let suggestedUrl: string | undefined;

          if (match[0].includes("github.com/")) {
            const repoMatch = match[0].match(/github\.com\/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)/);
            if (repoMatch) {
              suggestedRepo = repoMatch[1];
              suggestedUrl = match[0];
            }
          } else if (suggestedRepo) {
            // Generate URL from repo
            suggestedUrl = generateGitHubUrl(suggestedRepo, pattern.type, reference);
          }

          references.push({
            type: pattern.type,
            reference,
            timestamp: timestampStart,
            timestampEnd,
            confidence,
            rawMatch: match[0],
            suggestedRepo,
            suggestedUrl,
          });
        }
      }

      return references;
    });

  const detectInTranscript = (
    transcript: string,
    segments?: TranscriptSegment[],
    options: DetectionOptions = {},
  ): Effect.Effect<DetectionResult, never> =>
    Effect.gen(function* () {
      let allReferences: DetectedCodeReference[] = [];

      if (segments && segments.length > 0) {
        // Process each segment with its timestamp
        for (const segment of segments) {
          const refs = yield* detectInText(
            segment.text,
            segment.start,
            segment.end,
            options,
          );
          allReferences.push(...refs);
        }
      } else {
        // Process entire transcript without segment timestamps
        const refs = yield* detectInText(transcript, 0, undefined, options);
        allReferences.push(...refs);
      }

      // Deduplicate
      allReferences = yield* deduplicateReferences(allReferences);

      // Calculate stats
      const byType: Record<CodeLinkType, number> = {
        pr: 0,
        issue: 0,
        commit: 0,
        file: 0,
        directory: 0,
      };

      for (const ref of allReferences) {
        byType[ref.type]++;
      }

      const averageConfidence =
        allReferences.length > 0
          ? allReferences.reduce((sum, r) => sum + r.confidence, 0) / allReferences.length
          : 0;

      return {
        references: allReferences,
        stats: {
          totalReferences: allReferences.length,
          byType,
          averageConfidence,
        },
      };
    });

  const getPatterns = (): CodeReferencePattern[] => [...CODE_PATTERNS];

  const validateReference = (
    reference: DetectedCodeReference,
    options: DetectionOptions = {},
  ): Effect.Effect<DetectedCodeReference, never> =>
    Effect.sync(() => {
      let adjustedConfidence = reference.confidence;

      // Validate PR/Issue numbers (usually reasonable range)
      if ((reference.type === "pr" || reference.type === "issue") && reference.reference) {
        const num = parseInt(reference.reference, 10);
        if (num > 100000) {
          adjustedConfidence -= 20; // Unusually high number
        }
      }

      // Validate commit SHAs
      if (reference.type === "commit") {
        if (reference.reference.length < 7) {
          adjustedConfidence -= 30; // Too short
        }
        if (!/^[a-f0-9]+$/.test(reference.reference)) {
          adjustedConfidence = 0; // Invalid characters
        }
      }

      // Validate file paths
      if (reference.type === "file" || reference.type === "directory") {
        // Check if repo list includes this path structure
        if (options.organizationRepos && options.organizationRepos.length > 0) {
          // Could enhance by checking if file matches known repo structure
        }
      }

      return {
        ...reference,
        confidence: Math.max(0, Math.min(100, adjustedConfidence)),
      };
    });

  const deduplicateReferences = (
    references: DetectedCodeReference[],
  ): Effect.Effect<DetectedCodeReference[], never> =>
    Effect.sync(() => {
      const seen = new Map<string, DetectedCodeReference>();

      for (const ref of references) {
        const key = `${ref.type}:${ref.reference}:${ref.suggestedRepo || ""}`;

        const existing = seen.get(key);
        if (!existing || ref.confidence > existing.confidence) {
          seen.set(key, ref);
        } else if (ref.confidence === existing.confidence) {
          // Merge timestamps to get the earliest occurrence
          if (ref.timestamp < existing.timestamp) {
            seen.set(key, {
              ...existing,
              timestamp: ref.timestamp,
            });
          }
        }
      }

      return Array.from(seen.values()).sort((a, b) => a.timestamp - b.timestamp);
    });

  const generateUrls = (
    references: DetectedCodeReference[],
    repo: string,
  ): Effect.Effect<DetectedCodeReference[], never> =>
    Effect.sync(() =>
      references.map((ref) => ({
        ...ref,
        suggestedRepo: ref.suggestedRepo || repo,
        suggestedUrl: ref.suggestedUrl || generateGitHubUrl(repo, ref.type, ref.reference),
      })),
    );

  return {
    detectInTranscript,
    detectInText,
    getPatterns,
    validateReference,
    deduplicateReferences,
    generateUrls,
  } satisfies CodeReferenceDetectorService;
});

// =============================================================================
// Helper Functions
// =============================================================================

function generateGitHubUrl(repo: string, type: CodeLinkType, reference: string): string {
  const baseUrl = `https://github.com/${repo}`;

  switch (type) {
    case "pr":
      return `${baseUrl}/pull/${reference}`;
    case "issue":
      return `${baseUrl}/issues/${reference}`;
    case "commit":
      return `${baseUrl}/commit/${reference}`;
    case "file":
      return `${baseUrl}/blob/main/${reference}`;
    case "directory":
      return `${baseUrl}/tree/main/${reference}`;
    default:
      return baseUrl;
  }
}

// =============================================================================
// Code Reference Detector Layer
// =============================================================================

export const CodeReferenceDetectorLive = Layer.effect(
  CodeReferenceDetector,
  makeCodeReferenceDetector,
);

// =============================================================================
// Exported Helper Functions
// =============================================================================

export const detectCodeReferencesInTranscript = (
  transcript: string,
  segments?: TranscriptSegment[],
  options?: DetectionOptions,
): Effect.Effect<DetectionResult, never, CodeReferenceDetector> =>
  Effect.gen(function* () {
    const detector = yield* CodeReferenceDetector;
    return yield* detector.detectInTranscript(transcript, segments, options);
  });

export const detectCodeReferencesInText = (
  text: string,
  timestampStart: number,
  timestampEnd?: number,
  options?: DetectionOptions,
): Effect.Effect<DetectedCodeReference[], never, CodeReferenceDetector> =>
  Effect.gen(function* () {
    const detector = yield* CodeReferenceDetector;
    return yield* detector.detectInText(text, timestampStart, timestampEnd, options);
  });

export const generateCodeReferenceUrls = (
  references: DetectedCodeReference[],
  repo: string,
): Effect.Effect<DetectedCodeReference[], never, CodeReferenceDetector> =>
  Effect.gen(function* () {
    const detector = yield* CodeReferenceDetector;
    return yield* detector.generateUrls(references, repo);
  });
