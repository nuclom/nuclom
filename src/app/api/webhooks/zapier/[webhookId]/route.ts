import { Effect, Layer } from "effect";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { ZapierWebhookEvent } from "@/lib/db/schema";
import { DatabaseLive } from "@/lib/effect/services/database";
import { ZapierWebhooksService, ZapierWebhooksServiceLive } from "@/lib/effect/services/zapier-webhooks";

const ZapierWebhooksWithDeps = ZapierWebhooksServiceLive.pipe(Layer.provide(DatabaseLive));
const WebhooksLayer = Layer.mergeAll(ZapierWebhooksWithDeps, DatabaseLive);

interface RouteParams {
  params: Promise<{ webhookId: string }>;
}

// GET - Get a specific webhook
export async function GET(request: Request, { params }: RouteParams) {
  const { webhookId } = await params;

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const effect = Effect.gen(function* () {
    const zapierService = yield* ZapierWebhooksService;
    const webhook = yield* zapierService.getWebhook(webhookId);
    return { webhook };
  });

  try {
    const result = await Effect.runPromise(Effect.provide(effect, WebhooksLayer));
    return NextResponse.json(result);
  } catch (err) {
    console.error("[Zapier Webhook GET Error]", err);
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }
}

// PATCH - Update a webhook
export async function PATCH(request: Request, { params }: RouteParams) {
  const { webhookId } = await params;

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { targetUrl?: string; events?: ZapierWebhookEvent[]; isActive?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const effect = Effect.gen(function* () {
    const zapierService = yield* ZapierWebhooksService;
    const webhook = yield* zapierService.updateWebhook(webhookId, body);
    return { webhook };
  });

  try {
    const result = await Effect.runPromise(Effect.provide(effect, WebhooksLayer));
    return NextResponse.json(result);
  } catch (err) {
    console.error("[Zapier Webhook PATCH Error]", err);
    return NextResponse.json({ error: "Failed to update webhook" }, { status: 500 });
  }
}

// DELETE - Delete a webhook
export async function DELETE(request: Request, { params }: RouteParams) {
  const { webhookId } = await params;

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const effect = Effect.gen(function* () {
    const zapierService = yield* ZapierWebhooksService;
    yield* zapierService.deleteWebhook(webhookId);
    return { success: true };
  });

  try {
    const result = await Effect.runPromise(Effect.provide(effect, WebhooksLayer));
    return NextResponse.json(result);
  } catch (err) {
    console.error("[Zapier Webhook DELETE Error]", err);
    return NextResponse.json({ error: "Failed to delete webhook" }, { status: 500 });
  }
}
