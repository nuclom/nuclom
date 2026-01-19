import { auth } from '@nuclom/lib/auth';
import { Effect, Layer, Schema } from 'effect';
import type { NextRequest } from 'next/server';
import { handleEffectExit } from '@/lib/api-handler';
import { UnauthorizedError, ValidationError } from '@/lib/effect/errors';
import { DatabaseLive } from '@/lib/effect/services/database';
import { ZapierWebhooksService, ZapierWebhooksServiceLive } from '@/lib/effect/services/zapier-webhooks';
import { safeParse } from '@/lib/validation';

const ZapierWebhooksWithDeps = ZapierWebhooksServiceLive.pipe(Layer.provide(DatabaseLive));
const WebhooksLayer = Layer.mergeAll(ZapierWebhooksWithDeps, DatabaseLive);

const UpdateWebhookSchema = Schema.Struct({
  targetUrl: Schema.optional(Schema.String),
  events: Schema.optional(
    Schema.Array(
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
  ),
  isActive: Schema.optional(Schema.Boolean),
});

interface RouteParams {
  params: Promise<{ webhookId: string }>;
}

// GET - Get a specific webhook
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { webhookId } = await params;

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return Effect.runPromiseExit(Effect.fail(UnauthorizedError.default)).then(handleEffectExit);
  }

  const effect = Effect.gen(function* () {
    const zapierService = yield* ZapierWebhooksService;
    const webhook = yield* zapierService.getWebhook(webhookId);
    return { webhook };
  });

  const runnable = Effect.provide(effect, WebhooksLayer);
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// PATCH - Update a webhook
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { webhookId } = await params;

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

  const result = safeParse(UpdateWebhookSchema, rawBody);
  if (!result.success) {
    return Effect.runPromiseExit(Effect.fail(new ValidationError({ message: 'Invalid request format' }))).then(
      handleEffectExit,
    );
  }
  const body = result.data;

  const effect = Effect.gen(function* () {
    const zapierService = yield* ZapierWebhooksService;
    // Convert readonly arrays to mutable
    const updateData = {
      ...body,
      events: body.events ? [...body.events] : undefined,
    };
    const webhook = yield* zapierService.updateWebhook(webhookId, updateData);
    return { webhook };
  });

  const runnable = Effect.provide(effect, WebhooksLayer);
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// DELETE - Delete a webhook
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { webhookId } = await params;

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return Effect.runPromiseExit(Effect.fail(UnauthorizedError.default)).then(handleEffectExit);
  }

  const effect = Effect.gen(function* () {
    const zapierService = yield* ZapierWebhooksService;
    yield* zapierService.deleteWebhook(webhookId);
    return { success: true };
  });

  const runnable = Effect.provide(effect, WebhooksLayer);
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
