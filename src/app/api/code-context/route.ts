import { Effect } from "effect";
import type { NextRequest } from "next/server";
import { createPublicLayer, handleEffectExit } from "@/lib/api-handler";
import type { CodeLinkType } from "@/lib/db/schema";
import { CodeLinksRepository } from "@/lib/effect";

// =============================================================================
// GET /api/code-context - Get videos linked to a code artifact
// =============================================================================

export async function GET(request: NextRequest) {
  const effect = Effect.gen(function* () {
    const { searchParams } = new URL(request.url);
    const repo = searchParams.get("repo");
    const type = searchParams.get("type") as CodeLinkType | null;
    const ref = searchParams.get("ref");

    // Validate required parameters
    if (!repo) {
      return yield* Effect.fail({
        _tag: "ValidationError" as const,
        message: "repo query parameter is required (format: owner/repo)",
      });
    }

    if (!type) {
      return yield* Effect.fail({
        _tag: "ValidationError" as const,
        message: "type query parameter is required (pr, issue, commit, file, directory)",
      });
    }

    if (!ref) {
      return yield* Effect.fail({
        _tag: "ValidationError" as const,
        message: "ref query parameter is required (PR number, commit SHA, or file path)",
      });
    }

    // Validate type
    const validTypes: CodeLinkType[] = ["pr", "issue", "commit", "file", "directory"];
    if (!validTypes.includes(type)) {
      return yield* Effect.fail({
        _tag: "ValidationError" as const,
        message: `Invalid type. Must be one of: ${validTypes.join(", ")}`,
      });
    }

    // Get code links for the artifact
    const codeLinksRepo = yield* CodeLinksRepository;
    const result = yield* codeLinksRepo.getCodeLinksByArtifact(repo, type, ref);

    // Format the response with video information
    const videos = result.links.map((link) => ({
      videoId: link.videoId,
      videoTitle: link.video.title,
      thumbnailUrl: link.video.thumbnailUrl,
      duration: link.video.duration,
      organizationId: link.video.organizationId,
      timestamp: link.timestampStart,
      timestampEnd: link.timestampEnd,
      context: link.context,
      autoDetected: link.autoDetected,
      createdAt: link.createdAt,
      createdBy: link.createdBy,
    }));

    return {
      success: true,
      data: {
        repo,
        type,
        ref,
        videos,
        totalCount: result.totalCount,
      },
    };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
