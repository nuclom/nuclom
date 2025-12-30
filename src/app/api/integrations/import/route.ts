import { type NextRequest, NextResponse } from "next/server";
import { Cause, Effect, Exit, Layer, Option } from "effect";
import { auth } from "@/lib/auth";
import { DatabaseLive } from "@/lib/effect/services/database";
import { IntegrationRepository, IntegrationRepositoryLive } from "@/lib/effect/services/integration-repository";
import { Zoom, ZoomLive } from "@/lib/effect/services/zoom";
import { GoogleMeet, GoogleMeetLive } from "@/lib/effect/services/google-meet";
import { NotFoundError, UnauthorizedError } from "@/lib/effect/errors";
import { triggerImportMeeting } from "@/lib/workflow/import-meeting";
import type { IntegrationProvider } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const IntegrationRepositoryWithDeps = IntegrationRepositoryLive.pipe(Layer.provide(DatabaseLive));
const ImportLayer = Layer.mergeAll(IntegrationRepositoryWithDeps, DatabaseLive, ZoomLive, GoogleMeetLive);

interface ImportRecordingRequest {
  provider: IntegrationProvider;
  recordings: Array<{
    externalId: string;
    downloadUrl: string;
    title: string;
    duration?: number;
    fileSize?: number;
    meetingDate?: string;
  }>;
}

// =============================================================================
// POST /api/integrations/import - Import recordings from a provider
// =============================================================================

export async function POST(request: NextRequest) {
  // Verify authentication
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // Parse request body
  let body: ImportRecordingRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const { provider, recordings } = body;

  if (!provider || !["zoom", "google_meet"].includes(provider)) {
    return NextResponse.json({ success: false, error: "Invalid provider" }, { status: 400 });
  }

  if (!recordings || !Array.isArray(recordings) || recordings.length === 0) {
    return NextResponse.json({ success: false, error: "No recordings to import" }, { status: 400 });
  }

  const effect = Effect.gen(function* () {
    const integrationRepo = yield* IntegrationRepository;
    const zoom = yield* Zoom;
    const google = yield* GoogleMeet;

    // Get user's integration for this provider
    const integration = yield* integrationRepo.getIntegrationByProvider(session.user.id, provider);

    if (!integration) {
      return yield* Effect.fail(
        new NotFoundError({
          message: `${provider === "zoom" ? "Zoom" : "Google Meet"} integration not found`,
          entity: "Integration",
        }),
      );
    }

    // Check if token is expired and refresh if needed
    let accessToken = integration.accessToken;
    if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
      if (!integration.refreshToken) {
        return yield* Effect.fail(
          new UnauthorizedError({
            message: "Access token expired. Please reconnect your account.",
          }),
        );
      }

      if (provider === "zoom") {
        const newTokens = yield* zoom.refreshAccessToken(integration.refreshToken);
        accessToken = newTokens.access_token;

        yield* integrationRepo.updateIntegration(integration.id, {
          accessToken: newTokens.access_token,
          refreshToken: newTokens.refresh_token || integration.refreshToken,
          expiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
        });
      } else {
        const newTokens = yield* google.refreshAccessToken(integration.refreshToken);
        accessToken = newTokens.access_token;

        yield* integrationRepo.updateIntegration(integration.id, {
          accessToken: newTokens.access_token,
          refreshToken: newTokens.refresh_token || integration.refreshToken,
          expiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
        });
      }
    }

    // Create import records and trigger workflows
    const importResults: Array<{ externalId: string; importId: string; status: string }> = [];

    for (const recording of recordings) {
      // Check if already imported
      const existing = yield* integrationRepo.getImportedMeetingByExternalId(integration.id, recording.externalId);

      if (existing) {
        importResults.push({
          externalId: recording.externalId,
          importId: existing.id,
          status: existing.importStatus,
        });
        continue;
      }

      // Create import record
      const importedMeeting = yield* integrationRepo.createImportedMeeting({
        integrationId: integration.id,
        externalId: recording.externalId,
        meetingTitle: recording.title,
        meetingDate: recording.meetingDate ? new Date(recording.meetingDate) : undefined,
        duration: recording.duration,
        downloadUrl: recording.downloadUrl,
        fileSize: recording.fileSize,
      });

      // Trigger the import workflow (fire and forget - it's async)
      // The triggerImportMeeting function doesn't throw, it handles errors internally
      triggerImportMeeting({
        importedMeetingId: importedMeeting.id,
        integrationId: integration.id,
        provider,
        externalId: recording.externalId,
        downloadUrl: recording.downloadUrl,
        meetingTitle: recording.title,
        userId: session.user.id,
        organizationId: integration.organizationId,
        accessToken,
      });

      importResults.push({
        externalId: recording.externalId,
        importId: importedMeeting.id,
        status: "pending",
      });
    }

    return {
      imported: importResults.filter((r) => r.status !== "failed").length,
      failed: importResults.filter((r) => r.status === "failed").length,
      results: importResults,
    };
  });

  const exit = await Effect.runPromiseExit(Effect.provide(effect, ImportLayer));

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (Option.isSome(error)) {
        const err = error.value;
        if (err instanceof NotFoundError) {
          return NextResponse.json({ success: false, error: err.message }, { status: 404 });
        }
        if (err instanceof UnauthorizedError) {
          return NextResponse.json({ success: false, error: err.message }, { status: 401 });
        }
      }
      console.error("[Import Error]", cause);
      return NextResponse.json({ success: false, error: "Failed to import recordings" }, { status: 500 });
    },
    onSuccess: (data) => {
      return NextResponse.json({ success: true, data });
    },
  });
}

// =============================================================================
// GET /api/integrations/import - Get import status
// =============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const integrationId = searchParams.get("integrationId");

  // Verify authentication
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!integrationId) {
    return NextResponse.json({ success: false, error: "integrationId is required" }, { status: 400 });
  }

  const effect = Effect.gen(function* () {
    const integrationRepo = yield* IntegrationRepository;

    // Verify the user owns this integration
    const integration = yield* integrationRepo.getIntegration(integrationId);
    if (integration.userId !== session.user.id) {
      return yield* Effect.fail(
        new UnauthorizedError({
          message: "You don't have permission to view this integration",
        }),
      );
    }

    // Get imported meetings
    const imports = yield* integrationRepo.getImportedMeetings(integrationId);

    return imports;
  });

  const exit = await Effect.runPromiseExit(Effect.provide(effect, ImportLayer));

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (Option.isSome(error)) {
        const err = error.value;
        if (err instanceof NotFoundError) {
          return NextResponse.json({ success: false, error: err.message }, { status: 404 });
        }
        if (err instanceof UnauthorizedError) {
          return NextResponse.json({ success: false, error: err.message }, { status: 403 });
        }
      }
      return NextResponse.json({ success: false, error: "Failed to fetch imports" }, { status: 500 });
    },
    onSuccess: (data) => {
      return NextResponse.json({ success: true, data });
    },
  });
}
