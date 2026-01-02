import { Cause, Effect, Exit, Schema } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { createFullLayer, createPublicLayer, handleEffectExit, mapErrorToApiResponse } from "@/lib/api-handler";
import type { CodeLinkType } from "@/lib/db/schema";
import { CodeLinksRepository, ValidationError } from "@/lib/effect";
import { Auth } from "@/lib/effect/services/auth";

// =============================================================================
// Validation Schemas
// =============================================================================

const CreateCodeLinkSchema = Schema.Struct({
  type: Schema.Literal("pr", "issue", "commit", "file", "directory"),
  repo: Schema.String.pipe(Schema.minLength(1), Schema.pattern(/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/)),
  ref: Schema.String.pipe(Schema.minLength(1)),
  url: Schema.optional(Schema.String),
  context: Schema.optional(Schema.String.pipe(Schema.maxLength(500))),
  timestampStart: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))),
  timestampEnd: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))),
});

const UpdateCodeLinkSchema = Schema.Struct({
  id: Schema.UUID,
  context: Schema.optional(Schema.String.pipe(Schema.maxLength(500))),
  timestampStart: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))),
  timestampEnd: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))),
});

// =============================================================================
// GET /api/videos/[id]/code-links - List all code links for a video
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const { id: videoId } = yield* Effect.promise(() => params);

    // Fetch code links using repository
    const codeLinksRepo = yield* CodeLinksRepository;
    const codeLinks = yield* codeLinksRepo.getCodeLinks(videoId);

    return {
      success: true,
      data: codeLinks,
    };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// =============================================================================
// POST /api/videos/[id]/code-links - Create a new code link
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
      catch: () => new ValidationError({ message: "Invalid JSON body" }),
    });

    const parseResult = Schema.decodeUnknownEither(CreateCodeLinkSchema)(body);
    if (parseResult._tag === "Left") {
      return yield* Effect.fail(new ValidationError({ message: "Invalid code link data" }));
    }

    const { type, repo, ref, url, context, timestampStart, timestampEnd } = parseResult.right;

    // Generate GitHub URL if not provided
    const githubUrl = url || generateGitHubUrl(repo, type as CodeLinkType, ref);

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
      timestampStart,
      timestampEnd,
      createdByUserId: user.id,
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
        const err = error.value as { _tag?: string; message?: string; errors?: unknown };
        if (err._tag === "ValidationError") {
          return NextResponse.json({ success: false, error: err.message, errors: err.errors }, { status: 400 });
        }
        return mapErrorToApiResponse(error.value);
      }
      return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    },
    onSuccess: (data) => NextResponse.json(data, { status: 201 }),
  });
}

// =============================================================================
// PATCH /api/videos/[id]/code-links - Update a code link
// =============================================================================

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    yield* Effect.promise(() => params);

    // Parse and validate request body
    const body = yield* Effect.tryPromise({
      try: () => request.json(),
      catch: () => new ValidationError({ message: "Invalid JSON body" }),
    });

    const parseResult = Schema.decodeUnknownEither(UpdateCodeLinkSchema)(body);
    if (parseResult._tag === "Left") {
      return yield* Effect.fail(new ValidationError({ message: "Invalid update data" }));
    }

    const { id, context, timestampStart, timestampEnd } = parseResult.right;

    // Update code link
    const codeLinksRepo = yield* CodeLinksRepository;
    const updatedCodeLink = yield* codeLinksRepo.updateCodeLink(id, {
      context,
      timestampStart,
      timestampEnd,
    });

    return {
      success: true,
      data: updatedCodeLink,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// =============================================================================
// DELETE /api/videos/[id]/code-links - Delete a code link
// =============================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { searchParams } = new URL(request.url);
  const codeLinkId = searchParams.get("linkId");

  if (!codeLinkId) {
    return NextResponse.json({ success: false, error: "Missing linkId" }, { status: 400 });
  }

  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    yield* Effect.promise(() => params);

    // Delete code link
    const codeLinksRepo = yield* CodeLinksRepository;
    yield* codeLinksRepo.deleteCodeLink(codeLinkId);

    return {
      success: true,
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
