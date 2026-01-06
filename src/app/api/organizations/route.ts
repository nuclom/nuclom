import { Cause, Effect, Exit, Schema } from 'effect';
import { type NextRequest, NextResponse } from 'next/server';
import { mapErrorToApiResponse } from '@/lib/api-errors';
import { createFullLayer, handleEffectExit } from '@/lib/api-handler';
import { OrganizationRepository } from '@/lib/effect';
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

  const FullLayer = createFullLayer();
  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

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

  const FullLayer = createFullLayer();
  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === 'Some') {
        return mapErrorToApiResponse(error.value);
      }
      return mapErrorToApiResponse(new Error('Internal server error'));
    },
    onSuccess: (data) => NextResponse.json(data, { status: 201 }),
  });
}
