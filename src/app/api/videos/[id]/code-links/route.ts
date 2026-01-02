import { Cause, Effect, Exit, Schema } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { createFullLayer, createPublicLayer, handleEffectExit, mapErrorToApiResponse } from "@/lib/api-handler";
import type { CodeLinkType } from "@/lib/db/schema";
import { CodeLinksRepository, NotFoundError, VideoRepository } from "@/lib/effect";
import { Auth } from "@/lib/effect/services/auth";
import { safeParse } from "@/lib/validation";

// =============================================================================
// Validation Schemas
// =============================================================================

const CreateCodeLinkSchema = Schema.Struct({
  type: Schema.Literal("pr", "issue", "commit", "file", "directory"),
  repo: Schema.String.pipe(
    Schema.pattern(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/, {
      message: () => "Invalid repository format (owner/repo)",
    }),
  ),
  ref: Schema.String.pipe(Schema.minLength(1, { message: () => "Reference is required" })),
  context: Schema.optional(Schema.String),
  timestamp: Schema.optional(Schema.Number),
  timestampEnd: Schema.optional(Schema.Number),
});

// =============================================================================
// GET /api/videos/[id]/code-links - Get code links for a video
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const { id: videoId } = yield* Effect.promise(() => params);

    // Verify video exists
    const videoRepo = yield* VideoRepository;
    const video = yield* videoRepo.getVideo(videoId);

    if (!video) {
      return yield* Effect.fail(
        new NotFoundError({
          message: "Video not found",
          entity: "Video",
          id: videoId,
        }),
      );
    }

    // Get code links for the video
    const codeLinksRepo = yield* CodeLinksRepository;
    const codeLinks = yield* codeLinksRepo.getCodeLinksForVideo(videoId);

    return {
      success: true,
      data: {
        videoId,
        codeLinks,
        count: codeLinks.length,
      },
    };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// =============================================================================
// POST /api/videos/[id]/code-links - Create a code link for a video
// =============================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const { id: videoId } = yield* Effect.promise(() => params);

    // Parse and validate request body
    const body = yield* Effect.tryPromise({
      try: () => request.json(),
      catch: () => new Error("Invalid JSON body"),
    });

    const parseResult = safeParse(CreateCodeLinkSchema, body);
    if (!parseResult.success) {
      return yield* Effect.fail({
        _tag: "ValidationError" as const,
        message: parseResult.error.issues.map((e) => e.message).join(", "),
      });
    }

    const { type, repo, ref, context, timestamp, timestampEnd } = parseResult.data;

    // Verify video exists and user has access
    const videoRepo = yield* VideoRepository;
    const video = yield* videoRepo.getVideo(videoId);

    if (!video) {
      return yield* Effect.fail(
        new NotFoundError({
          message: "Video not found",
          entity: "Video",
          id: videoId,
        }),
      );
    }

    // Generate GitHub URL
    const githubUrl = generateGitHubUrl(repo, type as CodeLinkType, ref);

    // Create code link
    const codeLinksRepo = yield* CodeLinksRepository;
    const newCodeLink = yield* codeLinksRepo.createCodeLink({
      videoId,
      linkType: type as CodeLinkType,
      githubRepo: repo,
      githubRef: ref,
      githubUrl,
      context,
      autoDetected: false,
      timestampStart: timestamp,
      timestampEnd,
      createdById: user.id,
    });

    return {
      success: true,
      data: newCodeLink,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === "Some") {
        return mapErrorToApiResponse(error.value);
      }
      return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    },
    onSuccess: (data) => {
      return NextResponse.json(data, { status: 201 });
    },
  });
}

// =============================================================================
// DELETE /api/videos/[id]/code-links - Delete a code link (query param: linkId)
// =============================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    const { id: videoId } = yield* Effect.promise(() => params);
    const { searchParams } = new URL(request.url);
    const linkId = searchParams.get("linkId");

    if (!linkId) {
      return yield* Effect.fail({
        _tag: "ValidationError" as const,
        message: "linkId query parameter is required",
      });
    }

    // Verify the link exists and belongs to this video
    const codeLinksRepo = yield* CodeLinksRepository;
    const existingLink = yield* codeLinksRepo.getCodeLink(linkId);

    if (existingLink.videoId !== videoId) {
      return yield* Effect.fail({
        _tag: "ForbiddenError" as const,
        message: "Code link does not belong to this video",
      });
    }

    // Delete the code link
    yield* codeLinksRepo.deleteCodeLink(linkId);

    return {
      success: true,
      data: { deleted: true, id: linkId },
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// =============================================================================
// Helper Functions
// =============================================================================

function generateGitHubUrl(repo: string, type: CodeLinkType, ref: string): string {
  const baseUrl = `https://github.com/${repo}`;

  switch (type) {
    case "pr":
      return `${baseUrl}/pull/${ref}`;
    case "issue":
      return `${baseUrl}/issues/${ref}`;
    case "commit":
      return `${baseUrl}/commit/${ref}`;
    case "file":
      return `${baseUrl}/blob/main/${ref}`;
    case "directory":
      return `${baseUrl}/tree/main/${ref}`;
    default:
      return baseUrl;
  }
}
