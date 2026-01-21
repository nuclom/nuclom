/**
 * Meeting Prep API Route
 *
 * POST /api/ai/summaries/meeting-prep - Generate meeting preparation materials
 */

import { Auth, createFullLayer, handleEffectExit } from '@nuclom/lib/api-handler';
import { OrganizationRepository } from '@nuclom/lib/effect';
import { SmartSummary } from '@nuclom/lib/effect/services/knowledge';
import { validateRequestBody } from '@nuclom/lib/validation';
import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// Schemas
// =============================================================================

const MeetingPrepRequestSchema = Schema.Struct({
  organizationId: Schema.String,
  topicIds: Schema.Array(Schema.String).pipe(Schema.minItems(1)),
});

// =============================================================================
// POST - Generate Meeting Prep Materials
// =============================================================================

export async function POST(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Validate request body
    const body = yield* validateRequestBody(MeetingPrepRequestSchema, request);

    // Verify user has access to the organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, body.organizationId);

    // Generate meeting prep materials
    const summaryService = yield* SmartSummary;
    const result = yield* summaryService.generateMeetingPrep(body.organizationId, body.topicIds);

    return result;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
