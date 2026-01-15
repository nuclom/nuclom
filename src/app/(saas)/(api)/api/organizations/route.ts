import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';
import { handleEffectExit, handleEffectExitWithStatus, runApiEffect } from '@/lib/api-handler';
import { BillingRepository, OrganizationRepository } from '@/lib/effect';
import { Auth } from '@/lib/effect/services/auth';
import { SlackMonitoring } from '@/lib/effect/services/slack-monitoring';
import { validateRequestBody } from '@/lib/validation';

const CreateOrganizationSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1)),
  slug: Schema.String.pipe(Schema.minLength(1)),
  logo: Schema.optional(Schema.String),
});

// =============================================================================
// GET /api/organizations - Get user's organizations
// =============================================================================

export async function GET(request: NextRequest) {
  const effect = Effect.gen(function* () {
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const orgRepo = yield* OrganizationRepository;
    return yield* orgRepo.getUserOrganizations(user.id);
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit, {
    cache: { maxAge: 60, staleWhileRevalidate: 120 },
  });
}

// =============================================================================
// POST /api/organizations - Create organization
// =============================================================================

export async function POST(request: NextRequest) {
  const effect = Effect.gen(function* () {
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const { name, slug, logo } = yield* validateRequestBody(CreateOrganizationSchema, request);

    const orgRepo = yield* OrganizationRepository;
    const org = yield* orgRepo.createOrganization({
      name,
      slug,
      logo,
      userId: user.id,
    });

    // Create a 14-day trial subscription for the new organization
    const billingRepo = yield* BillingRepository;
    yield* billingRepo.createTrialSubscription(org.id, 14);

    // Send Slack monitoring notification
    const slackMonitoring = yield* SlackMonitoring;
    yield* slackMonitoring
      .sendAccountEvent('organization_created', {
        organizationId: org.id,
        organizationName: org.name,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
      })
      .pipe(Effect.catchAll(() => Effect.succeed(undefined)));

    return org;
  });

  const exit = await runApiEffect(effect);
  return handleEffectExitWithStatus(exit, 201);
}
