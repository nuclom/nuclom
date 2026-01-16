import { Effect, Option } from 'effect';
import { headers } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { createPublicLayer, handleEffectExit } from '@/lib/api-handler';
import { auth } from '@/lib/auth';
import { ValidationError, VideoRepository } from '@/lib/effect';
import { OrganizationRepository } from '@/lib/effect/services/organization-repository';
import type { ApiResponse } from '@/lib/types';

// =============================================================================
// GET /api/videos/search - Search videos
// =============================================================================

/**
 * GET /api/videos/search
 *
 * Search videos with full-text search and filters.
 *
 * Query parameters:
 * - q: Search query (required)
 * - authorId: Filter by author
 * - dateFrom: Filter by start date (ISO 8601)
 * - dateTo: Filter by end date (ISO 8601)
 * - page: Page number (default: 1)
 * - limit: Results per page (default: 20)
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get('q');
  const authorId = url.searchParams.get('authorId') || undefined;
  const dateFromStr = url.searchParams.get('dateFrom');
  const dateToStr = url.searchParams.get('dateTo');
  const page = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
  const limit = Number.parseInt(url.searchParams.get('limit') ?? '20', 10);

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ success: false, error: 'Search query (q) is required' }, { status: 400 });
  }

  const dateFrom = dateFromStr ? new Date(dateFromStr) : undefined;
  const dateTo = dateToStr ? new Date(dateToStr) : undefined;

  const effect = Effect.gen(function* () {
    const orgRepo = yield* OrganizationRepository;
    const activeOrg = yield* orgRepo.getActiveOrganization(session.user.id);

    if (Option.isNone(activeOrg)) {
      return yield* Effect.fail(
        new ValidationError({
          message: 'No active organization found',
        }),
      );
    }

    const videoRepo = yield* VideoRepository;
    const searchResults = yield* videoRepo.searchVideos({
      query: query.trim(),
      organizationId: activeOrg.value.id,
      authorId,
      dateFrom,
      dateTo,
      page,
      limit,
    });

    const response: ApiResponse = {
      success: true,
      data: searchResults,
    };
    return response;
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
