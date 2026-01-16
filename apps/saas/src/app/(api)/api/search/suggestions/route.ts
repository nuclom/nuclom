import { Effect } from 'effect';
import type { NextRequest } from 'next/server';
import { connection } from 'next/server';
import { createFullLayer, handleEffectExit } from '@/lib/api-handler';
import { MissingFieldError, SearchRepository } from '@/lib/effect';
import { Auth } from '@/lib/effect/services/auth';

// =============================================================================
// GET /api/search/suggestions - Get search suggestions
// =============================================================================

export async function GET(request: NextRequest) {
  await connection();

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Parse query params
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const organizationId = searchParams.get('organizationId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 20);

    if (!organizationId) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: 'organizationId',
          message: 'Organization ID is required',
        }),
      );
    }

    // Get suggestions
    const searchRepo = yield* SearchRepository;
    return yield* searchRepo.getSuggestions(query, organizationId, user.id, limit);
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
