/**
 * Topic Summary API Route
 *
 * GET /api/ai/summaries/topic/[id] - Get summary for a specific topic
 */

import { Auth, createFullLayer, handleEffectExit } from '@nuclom/lib/api-handler';
import { SmartSummary, type SummaryDepth } from '@nuclom/lib/effect/services/knowledge';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// GET - Get Topic Summary
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Get topic ID from params
    const { id: topicId } = yield* Effect.promise(() => params);

    // Parse query params for depth
    const { searchParams } = new URL(request.url);
    const depthParam = searchParams.get('depth') as SummaryDepth | null;
    const depth: SummaryDepth =
      depthParam && ['brief', 'detailed', 'comprehensive'].includes(depthParam) ? depthParam : 'detailed';

    // Get topic summary
    const summaryService = yield* SmartSummary;
    const result = yield* summaryService.generateTopicSummary(topicId, depth);

    return result;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
