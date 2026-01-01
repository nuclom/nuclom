import { Effect, Layer } from "effect";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { ZapierWebhookEvent } from "@/lib/db/schema";
import { DatabaseLive } from "@/lib/effect/services/database";
import {
  OrganizationRepository,
  OrganizationRepositoryLive,
} from "@/lib/effect/services/organization-repository";
import {
  ZapierWebhooksService,
  ZapierWebhooksServiceLive,
} from "@/lib/effect/services/zapier-webhooks";

const ZapierWebhooksWithDeps = ZapierWebhooksServiceLive.pipe(Layer.provide(DatabaseLive));
const OrgRepoWithDeps = OrganizationRepositoryLive.pipe(Layer.provide(DatabaseLive));
const WebhooksLayer = Layer.mergeAll(ZapierWebhooksWithDeps, OrgRepoWithDeps, DatabaseLive);

// GET - List all webhooks for the organization
export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const effect = Effect.gen(function* () {
    const zapierService = yield* ZapierWebhooksService;
    const orgRepo = yield* OrganizationRepository;

    const activeOrg = yield* orgRepo.getActiveOrganization(session.user.id);

    if (!activeOrg) {
      return { webhooks: [] };
    }

    const webhooks = yield* zapierService.getWebhooks(activeOrg.id);

    return { webhooks };
  });

  try {
    const result = await Effect.runPromise(Effect.provide(effect, WebhooksLayer));
    return NextResponse.json(result);
  } catch (err) {
    console.error("[Zapier Webhooks GET Error]", err);
    return NextResponse.json(
      { error: "Failed to fetch webhooks" },
      { status: 500 },
    );
  }
}

// POST - Create a new webhook
export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { targetUrl: string; events: ZapierWebhookEvent[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.targetUrl || !body.events || !Array.isArray(body.events)) {
    return NextResponse.json(
      { error: "Missing required fields: targetUrl, events" },
      { status: 400 },
    );
  }

  const effect = Effect.gen(function* () {
    const zapierService = yield* ZapierWebhooksService;
    const orgRepo = yield* OrganizationRepository;

    const activeOrg = yield* orgRepo.getActiveOrganization(session.user.id);

    if (!activeOrg) {
      return yield* Effect.fail(new Error("No active organization"));
    }

    const webhook = yield* zapierService.createWebhook({
      organizationId: activeOrg.id,
      userId: session.user.id,
      targetUrl: body.targetUrl,
      events: body.events,
    });

    return { webhook };
  });

  try {
    const result = await Effect.runPromise(Effect.provide(effect, WebhooksLayer));
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("[Zapier Webhooks POST Error]", err);
    return NextResponse.json(
      { error: "Failed to create webhook" },
      { status: 500 },
    );
  }
}
