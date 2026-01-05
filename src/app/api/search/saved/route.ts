import { Effect, Schema } from "effect";
import type { NextRequest } from "next/server";
import { createFullLayer, handleEffectExit } from "@/lib/api-handler";
import { MissingFieldError, SearchRepository } from "@/lib/effect";
import { Auth } from "@/lib/effect/services/auth";
import { validateRequestBody } from "@/lib/validation";

// =============================================================================
// GET /api/search/saved - Get saved searches
// =============================================================================

export async function GET(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Parse query params
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: "organizationId",
          message: "Organization ID is required",
        }),
      );
    }

    // Get saved searches
    const searchRepo = yield* SearchRepository;
    return yield* searchRepo.getSavedSearches(user.id, organizationId);
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// =============================================================================
// POST /api/search/saved - Create a saved search
// =============================================================================

export async function POST(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Parse request body
    const SearchFiltersSchema = Schema.Struct({
      types: Schema.optional(Schema.Array(Schema.Literal("video", "series", "channel"))),
      authorId: Schema.optional(Schema.String),
      channelId: Schema.optional(Schema.String),
      collectionId: Schema.optional(Schema.String),
      dateFrom: Schema.optional(Schema.String),
      dateTo: Schema.optional(Schema.String),
      hasTranscript: Schema.optional(Schema.Boolean),
      hasAiSummary: Schema.optional(Schema.Boolean),
      processingStatus: Schema.optional(Schema.String),
      tags: Schema.optional(Schema.Array(Schema.String)),
      sortBy: Schema.optional(Schema.Literal("relevance", "date", "title")),
      sortOrder: Schema.optional(Schema.Literal("asc", "desc")),
    });

    const SavedSearchBodySchema = Schema.Struct({
      name: Schema.optional(Schema.String),
      query: Schema.optional(Schema.String),
      organizationId: Schema.optional(Schema.String),
      filters: Schema.optional(SearchFiltersSchema),
    });

    const body = yield* validateRequestBody(SavedSearchBodySchema, request);
    const { name, query, organizationId, filters } = body;

    // Validate required fields
    if (!name) {
      return yield* Effect.fail(new MissingFieldError({ field: "name", message: "Name is required" }));
    }

    if (!query) {
      return yield* Effect.fail(new MissingFieldError({ field: "query", message: "Query is required" }));
    }

    if (!organizationId) {
      return yield* Effect.fail(
        new MissingFieldError({ field: "organizationId", message: "Organization ID is required" }),
      );
    }

    // Create saved search
    const searchRepo = yield* SearchRepository;
    return yield* searchRepo.createSavedSearch({
      userId: user.id,
      organizationId,
      name,
      query,
      filters,
    });
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
