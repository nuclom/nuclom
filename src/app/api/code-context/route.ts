import { Effect, Schema } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { createPublicLayer, handleEffectExit } from "@/lib/api-handler";
import type { CodeLinkType } from "@/lib/db/schema";
import { CodeLinksRepository } from "@/lib/effect";

// =============================================================================
// Validation Schemas
// =============================================================================

const QuerySchema = Schema.Struct({
  repo: Schema.String.pipe(Schema.minLength(1)),
  type: Schema.optional(Schema.Literal("pr", "issue", "commit", "file", "directory")),
  ref: Schema.optional(Schema.String),
  limit: Schema.optional(
    Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1), Schema.lessThanOrEqualTo(100)),
  ),
  offset: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))),
});

// =============================================================================
// GET /api/code-context - Get videos linked to a code artifact
// =============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const queryParams = {
    repo: searchParams.get("repo"),
    type: searchParams.get("type") || undefined,
    ref: searchParams.get("ref") || undefined,
    limit: searchParams.get("limit") || undefined,
    offset: searchParams.get("offset") || undefined,
  };

  const parseResult = Schema.decodeUnknownEither(QuerySchema)(queryParams);
  if (parseResult._tag === "Left") {
    return NextResponse.json(
      {
        success: false,
        error: "Validation error",
      },
      { status: 400 },
    );
  }

  const { repo, type, ref, limit = 20, offset = 0 } = parseResult.right;

  const effect = Effect.gen(function* () {
    const codeLinksRepo = yield* CodeLinksRepository;

    // Get code links for the repository
    const codeLinks = yield* codeLinksRepo.getCodeLinksByRepo(repo, {
      type: type as CodeLinkType | undefined,
      ref,
      limit,
      offset,
    });

    // Get repository context summary
    const summary = yield* codeLinksRepo.getRepoContextSummary(repo);

    return {
      success: true,
      data: {
        codeLinks,
        summary,
      },
    };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
