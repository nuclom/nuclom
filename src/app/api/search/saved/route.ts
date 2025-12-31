import { Effect } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { createFullLayer, handleEffectExit } from "@/lib/api-handler";
import type { SearchFilters } from "@/lib/db/schema";
import { MissingFieldError, SearchRepository } from "@/lib/effect";
import { Auth } from "@/lib/effect/services/auth";

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
    const body = yield* Effect.tryPromise({
      try: () => request.json(),
      catch: () =>
        new MissingFieldError({
          field: "body",
          message: "Invalid request body",
        }),
    });

    const { name, query, organizationId, filters } = body as {
      name?: string;
      query?: string;
      organizationId?: string;
      filters?: SearchFilters;
    };

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
