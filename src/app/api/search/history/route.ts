import { Effect } from "effect";
import type { NextRequest } from "next/server";
import { createFullLayer, handleEffectExit } from "@/lib/api-handler";
import { MissingFieldError, SearchRepository } from "@/lib/effect";
import { Auth } from "@/lib/effect/services/auth";

// =============================================================================
// GET /api/search/history - Get recent search history
// =============================================================================

export async function GET(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Parse query params
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);

    if (!organizationId) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: "organizationId",
          message: "Organization ID is required",
        }),
      );
    }

    // Get recent searches
    const searchRepo = yield* SearchRepository;
    return yield* searchRepo.getRecentSearches(user.id, organizationId, limit);
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}

// =============================================================================
// DELETE /api/search/history - Clear search history
// =============================================================================

export async function DELETE(request: NextRequest) {
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

    // Clear search history
    const searchRepo = yield* SearchRepository;
    yield* searchRepo.clearSearchHistory(user.id, organizationId);

    return { success: true };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
