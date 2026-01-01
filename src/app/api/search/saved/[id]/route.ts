import { Effect } from "effect";
import type { NextRequest } from "next/server";
import { createFullLayer, handleEffectExit } from "@/lib/api-handler";
import type { SearchFilters } from "@/lib/db/schema";
import { MissingFieldError, SearchRepository } from "@/lib/effect";
import { Auth } from "@/lib/effect/services/auth";

// =============================================================================
// PATCH /api/search/saved/[id] - Update a saved search
// =============================================================================

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const { id } = yield* Effect.promise(() => params);

    // Parse request body
    const body = yield* Effect.tryPromise({
      try: () => request.json(),
      catch: () =>
        new MissingFieldError({
          field: "body",
          message: "Invalid request body",
        }),
    });

    const { name, query, filters } = body as {
      name?: string;
      query?: string;
      filters?: SearchFilters;
    };

    // Update saved search
    const searchRepo = yield* SearchRepository;
    return yield* searchRepo.updateSavedSearch(id, user.id, {
      name,
      query,
      filters,
    });
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// =============================================================================
// DELETE /api/search/saved/[id] - Delete a saved search
// =============================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const { id } = yield* Effect.promise(() => params);

    // Delete saved search
    const searchRepo = yield* SearchRepository;
    yield* searchRepo.deleteSavedSearch(id, user.id);

    return { success: true };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
