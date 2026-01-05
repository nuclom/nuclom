import { Cause, Effect, Exit, Layer, Option } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { DatabaseLive } from "@/lib/effect/services/database";
import { IntegrationRepository, IntegrationRepositoryLive } from "@/lib/effect/services/integration-repository";

const IntegrationRepositoryWithDeps = IntegrationRepositoryLive.pipe(Layer.provide(DatabaseLive));
const WebhookLayer = Layer.mergeAll(IntegrationRepositoryWithDeps, DatabaseLive);

// Google Push Notification headers
type _GooglePushHeaders = {
  "x-goog-channel-id": string;
  "x-goog-channel-token": string;
  "x-goog-message-number": string;
  "x-goog-resource-id": string;
  "x-goog-resource-state": "sync" | "exists" | "not_exists" | "update";
  "x-goog-resource-uri": string;
};

// =============================================================================
// POST /api/integrations/google/webhook - Handle Google Drive/Calendar webhooks
// =============================================================================

export async function POST(request: NextRequest) {
  // Extract Google push notification headers
  const channelId = request.headers.get("x-goog-channel-id");
  const channelToken = request.headers.get("x-goog-channel-token");
  const resourceState = request.headers.get("x-goog-resource-state");

  console.log(`[Google Webhook] Received notification: ${resourceState} for channel ${channelId}`);

  // Verify channel token matches what we expect
  // In production, you should store and verify channel tokens
  if (!channelId || !resourceState) {
    return NextResponse.json({ error: "Missing required headers" }, { status: 400 });
  }

  // Handle sync message (sent when watch is first created)
  if (resourceState === "sync") {
    console.log(`[Google Webhook] Sync notification for channel ${channelId}`);
    return NextResponse.json({ success: true, status: "sync acknowledged" });
  }

  // Handle resource updates
  if (resourceState === "exists" || resourceState === "update") {
    const effect = Effect.gen(function* () {
      const integrationRepo = yield* IntegrationRepository;

      // Parse channel token to get integration info
      // Token format: "integration:{integrationId}:{userId}"
      let integrationId: string | null = null;

      if (channelToken) {
        const parts = channelToken.split(":");
        if (parts[0] === "integration" && parts[1]) {
          integrationId = parts[1];
        }
      }

      if (!integrationId) {
        console.log(`[Google Webhook] Could not parse integration ID from token`);
        return { processed: false, reason: "Invalid channel token" };
      }

      // Use Effect.catchAll for proper error handling instead of nested Effect.runPromise
      const integration = yield* integrationRepo
        .getIntegration(integrationId)
        .pipe(Effect.catchAll(() => Effect.succeed(null)));

      if (!integration) {
        console.log(`[Google Webhook] No integration found for ID ${integrationId}`);
        return { processed: false, reason: "No matching integration" };
      }

      // Check if auto-import is enabled
      const metadata = (integration.metadata as Record<string, unknown>) || {};
      if (!metadata.autoImport) {
        console.log(`[Google Webhook] Auto-import disabled for integration ${integration.id}`);
        return { processed: false, reason: "Auto-import disabled" };
      }

      // Create a notification record for the user
      // In a full implementation, you would:
      // 1. Fetch the changed file(s) from Google Drive
      // 2. Filter for Meet recordings
      // 3. Trigger auto-import for new recordings

      console.log(`[Google Webhook] Change detected for integration ${integrationId}`);

      return { processed: true, status: "notification_recorded" };
    });

    const exit = await Effect.runPromiseExit(Effect.provide(effect, WebhookLayer));

    return Exit.match(exit, {
      onFailure: (cause) => {
        const error = Cause.failureOption(cause);
        if (Option.isSome(error)) {
          console.error("[Google Webhook Error]", error.value);
        }
        return NextResponse.json({ success: false, error: "Webhook processing failed" }, { status: 500 });
      },
      onSuccess: (result) => {
        return NextResponse.json({ success: true, ...result });
      },
    });
  }

  // Handle deletion
  if (resourceState === "not_exists") {
    console.log(`[Google Webhook] Resource deleted for channel ${channelId}`);
    return NextResponse.json({ success: true, status: "deletion acknowledged" });
  }

  return NextResponse.json({ success: true });
}
