import crypto from "node:crypto";
import { Cause, Effect, Exit, Layer, Option } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { DatabaseLive } from "@/lib/effect/services/database";
import { IntegrationRepository, IntegrationRepositoryLive } from "@/lib/effect/services/integration-repository";
import { env } from "@/lib/env/server";
import { createLogger } from "@/lib/logger";
import { triggerImportMeeting } from "@/lib/workflow/import-meeting";

const log = createLogger("zoom-webhook");

const IntegrationRepositoryWithDeps = IntegrationRepositoryLive.pipe(Layer.provide(DatabaseLive));
const WebhookLayer = Layer.mergeAll(IntegrationRepositoryWithDeps, DatabaseLive);

// Zoom webhook event types
type ZoomWebhookEvent =
  | "recording.completed"
  | "recording.started"
  | "recording.stopped"
  | "recording.deleted"
  | "meeting.started"
  | "meeting.ended";

interface ZoomWebhookPayload {
  event: ZoomWebhookEvent;
  event_ts: number;
  payload: {
    account_id: string;
    object: {
      uuid: string;
      id: number;
      host_id: string;
      host_email: string;
      topic: string;
      type: number;
      start_time: string;
      duration: number;
      timezone: string;
      recording_files?: Array<{
        id: string;
        meeting_id: string;
        recording_start: string;
        recording_end: string;
        file_type: string;
        file_extension: string;
        file_size: number;
        download_url: string;
        status: string;
        recording_type: string;
      }>;
    };
  };
}

// Verify Zoom webhook signature
function verifyZoomWebhook(request: NextRequest, body: string): boolean {
  const webhookSecret = env.ZOOM_WEBHOOK_SECRET;
  if (!webhookSecret) {
    log.warn("ZOOM_WEBHOOK_SECRET not configured, skipping verification");
    return true; // Skip verification if secret not configured
  }

  const timestamp = request.headers.get("x-zm-request-timestamp");
  const signature = request.headers.get("x-zm-signature");

  if (!timestamp || !signature) {
    return false;
  }

  const message = `v0:${timestamp}:${body}`;
  const expectedSignature = `v0=${crypto.createHmac("sha256", webhookSecret).update(message).digest("hex")}`;

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

// =============================================================================
// POST /api/integrations/zoom/webhook - Handle Zoom webhooks
// =============================================================================

export async function POST(request: NextRequest) {
  const body = await request.text();

  // Verify webhook signature
  if (!verifyZoomWebhook(request, body)) {
    log.error("Invalid Zoom webhook signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: ZoomWebhookPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  // Handle Zoom URL verification challenge
  if ((payload as unknown as { event: string; payload: { plainToken: string } }).event === "endpoint.url_validation") {
    const plainToken = (payload as unknown as { payload: { plainToken: string } }).payload.plainToken;
    const webhookSecret = env.ZOOM_WEBHOOK_SECRET || "";
    const encryptedToken = crypto.createHmac("sha256", webhookSecret).update(plainToken).digest("hex");

    return NextResponse.json({
      plainToken,
      encryptedToken,
    });
  }

  log.info({ event: payload.event }, "Received webhook event");

  // Handle recording completed event for auto-import
  if (payload.event === "recording.completed") {
    const effect = Effect.gen(function* () {
      const integrationRepo = yield* IntegrationRepository;

      // Find integration by account ID or host email
      const { account_id, object } = payload.payload;
      const integration = yield* Effect.tryPromise({
        try: async () => {
          // Try to find integration by email
          const integrations = await Effect.runPromise(
            Effect.provide(integrationRepo.getIntegrationsByAccountId(account_id), WebhookLayer),
          );
          return integrations[0] || null;
        },
        catch: () => null,
      });

      if (!integration) {
        log.debug({ accountId: account_id }, "No integration found for account");
        return { processed: false, reason: "No matching integration" };
      }

      // Check if auto-import is enabled
      const metadata = (integration.metadata as Record<string, unknown>) || {};
      if (!metadata.autoImport) {
        log.debug({ integrationId: integration.id }, "Auto-import disabled for integration");
        return { processed: false, reason: "Auto-import disabled" };
      }

      // Check minimum duration
      const minDuration = (metadata.importMinDuration as number) || 0;
      if (object.duration < minDuration) {
        log.debug({ duration: object.duration, minDuration }, "Recording too short");
        return { processed: false, reason: "Recording below minimum duration" };
      }

      // Find the main video recording
      const videoFile =
        object.recording_files?.find(
          (f) => f.file_type === "MP4" && f.recording_type === "shared_screen_with_speaker_view",
        ) || object.recording_files?.find((f) => f.file_type === "MP4");

      if (!videoFile) {
        log.debug({ meetingId: object.id }, "No video file found in recording");
        return { processed: false, reason: "No video file" };
      }

      // Create import record
      const importedMeeting = yield* integrationRepo.createImportedMeeting({
        integrationId: integration.id,
        externalId: videoFile.id,
        meetingTitle: object.topic,
        meetingDate: new Date(object.start_time),
        duration: object.duration,
        downloadUrl: videoFile.download_url,
        fileSize: videoFile.file_size,
      });

      // Trigger import workflow
      triggerImportMeeting({
        importedMeetingId: importedMeeting.id,
        integrationId: integration.id,
        provider: "zoom",
        externalId: videoFile.id,
        downloadUrl: videoFile.download_url,
        meetingTitle: object.topic,
        userId: integration.userId,
        organizationId: integration.organizationId,
        accessToken: integration.accessToken,
      });

      log.info({ meetingTopic: object.topic, importId: importedMeeting.id }, "Auto-import triggered for meeting");
      return { processed: true, importId: importedMeeting.id };
    });

    const exit = await Effect.runPromiseExit(Effect.provide(effect, WebhookLayer));

    return Exit.match(exit, {
      onFailure: (cause) => {
        const error = Cause.failureOption(cause);
        if (Option.isSome(error)) {
          log.error({ err: error.value }, "Webhook processing failed");
        }
        return NextResponse.json({ success: false, error: "Webhook processing failed" }, { status: 500 });
      },
      onSuccess: (result) => {
        return NextResponse.json({ success: true, ...result });
      },
    });
  }

  // Acknowledge other events
  return NextResponse.json({ success: true, event: payload.event });
}
