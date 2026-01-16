import { Effect, Layer, Option, Schema } from 'effect';
import type { NextRequest } from 'next/server';
import { handleEffectExit, handleEffectExitWithStatus } from '@/lib/api-handler';
import { auth } from '@/lib/auth';
import { UnauthorizedError, ValidationError } from '@/lib/effect/errors';
import { DatabaseLive } from '@/lib/effect/services/database';
import { OrganizationRepository, OrganizationRepositoryLive } from '@/lib/effect/services/organization-repository';
import { ZapierWebhooksService, ZapierWebhooksServiceLive } from '@/lib/effect/services/zapier-webhooks';
import { safeParse } from '@/lib/validation';

const ZapierWebhooksWithDeps = ZapierWebhooksServiceLive.pipe(Layer.provide(DatabaseLive));
const OrgRepoWithDeps = OrganizationRepositoryLive.pipe(Layer.provide(DatabaseLive));
const WebhooksLayer = Layer.mergeAll(ZapierWebhooksWithDeps, OrgRepoWithDeps, DatabaseLive);

const CreateWebhookSchema = Schema.Struct({
  targetUrl: Schema.String,
  events: Schema.Array(
    Schema.Literal(
      'video.uploaded',
      'video.processed',
      'video.shared',
      'comment.created',
      'comment.replied',
      'member.joined',
      'member.left',
    ),
  ),
});

// GET - List all webhooks for the organization
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return Effect.runPromiseExit(Effect.fail(UnauthorizedError.default)).then(handleEffectExit);
  }

  const effect = Effect.gen(function* () {
    const zapierService = yield* ZapierWebhooksService;
    const orgRepo = yield* OrganizationRepository;

    const activeOrgOption = yield* orgRepo.getActiveOrganization(session.user.id);

    if (Option.isNone(activeOrgOption)) {
      return { webhooks: [] };
    }

    const activeOrg = activeOrgOption.value;

    const webhooks = yield* zapierService.getWebhooks(activeOrg.id);

    return { webhooks };
  });

  const runnable = Effect.provide(effect, WebhooksLayer);
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// POST - Create a new webhook
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return Effect.runPromiseExit(Effect.fail(UnauthorizedError.default)).then(handleEffectExit);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Effect.runPromiseExit(Effect.fail(new ValidationError({ message: 'Invalid JSON body' }))).then(
      handleEffectExit,
    );
  }

  const result = safeParse(CreateWebhookSchema, rawBody);
  if (!result.success) {
    return Effect.runPromiseExit(
      Effect.fail(new ValidationError({ message: 'Missing required fields: targetUrl, events' })),
    ).then(handleEffectExit);
  }
  const body = result.data;

  const effect = Effect.gen(function* () {
    const zapierService = yield* ZapierWebhooksService;
    const orgRepo = yield* OrganizationRepository;

    const activeOrgOption = yield* orgRepo.getActiveOrganization(session.user.id);

    if (Option.isNone(activeOrgOption)) {
      return yield* Effect.fail(new ValidationError({ message: 'No active organization' }));
    }

    const activeOrg = activeOrgOption.value;

    const webhook = yield* zapierService.createWebhook({
      organizationId: activeOrg.id,
      userId: session.user.id,
      targetUrl: body.targetUrl,
      events: [...body.events],
    });

    return { webhook };
  });

  const runnable = Effect.provide(effect, WebhooksLayer);
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExitWithStatus(exit, 201);
}
