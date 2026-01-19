import { auth } from '@nuclom/lib/auth';
import { Effect, Layer } from 'effect';
import { NextResponse } from 'next/server';
import { DatabaseLive } from '@/lib/effect/services/database';
import { ZapierWebhooksService, ZapierWebhooksServiceLive } from '@/lib/effect/services/zapier-webhooks';

const ZapierWebhooksWithDeps = ZapierWebhooksServiceLive.pipe(Layer.provide(DatabaseLive));
const DeliveriesLayer = Layer.mergeAll(ZapierWebhooksWithDeps, DatabaseLive);

interface RouteParams {
  params: Promise<{ webhookId: string }>;
}

// GET - Get deliveries for a webhook
export async function GET(request: Request, { params }: RouteParams) {
  const { webhookId } = await params;
  const { searchParams } = new URL(request.url);
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10);
  const limit = Number.parseInt(searchParams.get('limit') ?? '20', 10);

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const effect = Effect.gen(function* () {
    const zapierService = yield* ZapierWebhooksService;
    const result = yield* zapierService.getDeliveries(webhookId, page, limit);

    return {
      ...result,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    };
  });

  try {
    const result = await Effect.runPromise(Effect.provide(effect, DeliveriesLayer));
    return NextResponse.json(result);
  } catch (err) {
    console.error('[Zapier Deliveries GET Error]', err);
    return NextResponse.json({ error: 'Failed to fetch deliveries' }, { status: 500 });
  }
}

// POST - Retry a delivery
export async function POST(request: Request, { params }: RouteParams) {
  await params; // Consume params even if not used

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { deliveryId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.deliveryId) {
    return NextResponse.json({ error: 'Missing required field: deliveryId' }, { status: 400 });
  }

  const effect = Effect.gen(function* () {
    const zapierService = yield* ZapierWebhooksService;
    const result = yield* zapierService.retryDelivery(body.deliveryId);
    return { result };
  });

  try {
    const result = await Effect.runPromise(Effect.provide(effect, DeliveriesLayer));
    return NextResponse.json(result);
  } catch (err) {
    console.error('[Zapier Retry Delivery Error]', err);
    return NextResponse.json({ error: 'Failed to retry delivery' }, { status: 500 });
  }
}
