import { createFullLayer, handleEffectExit } from '@nuclom/lib/api-handler';
import { MissingFieldError, SearchRepository } from '@nuclom/lib/effect';
import { Auth } from '@nuclom/lib/effect/services/auth';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';
import { connection } from 'next/server';

// =============================================================================
// GET /api/search/quick - Quick search for command bar
// =============================================================================

export async function GET(request: NextRequest) {
  await connection();

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Parse query params
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const organizationId = searchParams.get('organizationId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '5', 10), 10);

    if (!organizationId) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: 'organizationId',
          message: 'Organization ID is required',
        }),
      );
    }

    // Perform quick search
    const searchRepo = yield* SearchRepository;
    return yield* searchRepo.quickSearch(query, organizationId, limit);
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
