import { Effect, Schema } from "effect";
import type { NextRequest } from "next/server";
import { createFullLayer, handleEffectExit } from "@/lib/api-handler";
import type { CodeLinkType } from "@/lib/db/schema";
import { CodeLinksRepository, CodeReferenceDetector, VideoRepository } from "@/lib/effect";
import { Auth } from "@/lib/effect/services/auth";

// =============================================================================
// Validation Schemas
// =============================================================================

const DetectOptionsSchema = Schema.Struct({
  defaultRepo: Schema.optional(Schema.String),
  minConfidence: Schema.optional(
    Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(100)),
  ),
  autoSave: Schema.optional(Schema.Boolean),
});

// =============================================================================
// POST /api/videos/[id]/detect-code-refs - Detect code references in transcript
// =============================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const { id: videoId } = yield* Effect.promise(() => params);

    // Parse options from request body with defaults
    let options = { defaultRepo: undefined as string | undefined, minConfidence: 60, autoSave: false };
    const bodyResult = yield* Effect.tryPromise({
      try: () => request.json(),
      catch: () => null, // Use defaults if body is empty or invalid
    });

    if (bodyResult) {
      const parseResult = Schema.decodeUnknownEither(DetectOptionsSchema)(bodyResult);
      if (parseResult._tag === "Right") {
        options = {
          defaultRepo: parseResult.right.defaultRepo,
          minConfidence: parseResult.right.minConfidence ?? 60,
          autoSave: parseResult.right.autoSave ?? false,
        };
      }
    }

    // Get video with transcript
    const videoRepo = yield* VideoRepository;
    const video = yield* videoRepo.getVideo(videoId);

    if (!video.transcript) {
      return {
        success: true,
        data: {
          references: [],
          stats: {
            totalReferences: 0,
            byType: { pr: 0, issue: 0, commit: 0, file: 0, directory: 0 },
            averageConfidence: 0,
          },
          message: "No transcript available for this video",
        },
      };
    }

    // Detect code references
    const detector = yield* CodeReferenceDetector;
    const result = yield* detector.detectInTranscript(video.transcript, video.transcriptSegments || undefined, {
      defaultRepo: options.defaultRepo,
      minConfidence: options.minConfidence,
    });

    // If autoSave is enabled, save the detected references as code links
    if (options.autoSave && result.references.length > 0 && options.defaultRepo) {
      const defaultRepo = options.defaultRepo; // Capture for type narrowing
      const codeLinksRepo = yield* CodeLinksRepository;

      // Generate URLs for references
      const referencesWithUrls = yield* detector.generateUrls(result.references, defaultRepo);

      // Create code links for each detected reference
      const codeLinksToCreate = referencesWithUrls.map((ref) => ({
        videoId,
        linkType: ref.type as CodeLinkType,
        githubRepo: ref.suggestedRepo || defaultRepo,
        githubRef: ref.reference,
        githubUrl: ref.suggestedUrl,
        autoDetected: true,
        confidence: Math.round(ref.confidence),
        timestampStart: ref.timestamp,
        timestampEnd: ref.timestampEnd,
        createdByUserId: user.id,
      }));

      yield* codeLinksRepo.createCodeLinksBatch(codeLinksToCreate);

      return {
        success: true,
        data: {
          ...result,
          saved: true,
          savedCount: codeLinksToCreate.length,
        },
      };
    }

    return {
      success: true,
      data: result,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// =============================================================================
// GET /api/videos/[id]/detect-code-refs - Preview code references without saving
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { searchParams } = new URL(request.url);
  const defaultRepo = searchParams.get("defaultRepo") || undefined;
  const minConfidence = Number.parseInt(searchParams.get("minConfidence") || "60", 10);

  const effect = Effect.gen(function* () {
    const { id: videoId } = yield* Effect.promise(() => params);

    // Get video with transcript
    const videoRepo = yield* VideoRepository;
    const video = yield* videoRepo.getVideo(videoId);

    if (!video.transcript) {
      return {
        success: true,
        data: {
          references: [],
          stats: {
            totalReferences: 0,
            byType: { pr: 0, issue: 0, commit: 0, file: 0, directory: 0 },
            averageConfidence: 0,
          },
          message: "No transcript available for this video",
        },
      };
    }

    // Detect code references
    const detector = yield* CodeReferenceDetector;
    const result = yield* detector.detectInTranscript(video.transcript, video.transcriptSegments || undefined, {
      defaultRepo,
      minConfidence,
    });

    // Generate URLs if we have a default repo
    if (defaultRepo && result.references.length > 0) {
      const referencesWithUrls = yield* detector.generateUrls(result.references, defaultRepo);
      return {
        success: true,
        data: {
          ...result,
          references: referencesWithUrls,
        },
      };
    }

    return {
      success: true,
      data: result,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
