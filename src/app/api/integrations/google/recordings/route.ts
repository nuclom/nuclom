import { Cause, Effect, Exit, Layer, Option } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { HttpError, NotFoundError, UnauthorizedError } from "@/lib/effect/errors";
import { DatabaseLive } from "@/lib/effect/services/database";
import { GoogleMeet, GoogleMeetLive, type GoogleMeetRecording } from "@/lib/effect/services/google-meet";
import { IntegrationRepository, IntegrationRepositoryLive } from "@/lib/effect/services/integration-repository";

export const dynamic = "force-dynamic";

const IntegrationRepositoryWithDeps = IntegrationRepositoryLive.pipe(Layer.provide(DatabaseLive));
const RecordingsLayer = Layer.mergeAll(GoogleMeetLive, IntegrationRepositoryWithDeps, DatabaseLive);

interface RecordingsResponse {
  recordings: GoogleMeetRecording[];
  nextPageToken?: string;
}

// =============================================================================
// GET /api/integrations/google/recordings - List Google Meet recordings
// =============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pageToken = searchParams.get("pageToken") || undefined;
  const pageSize = Number.parseInt(searchParams.get("pageSize") || "50", 10);

  // Verify authentication
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const effect = Effect.gen(function* () {
    const google = yield* GoogleMeet;
    const integrationRepo = yield* IntegrationRepository;

    // Get user's Google Meet integration
    const integration = yield* integrationRepo.getIntegrationByProvider(session.user.id, "google_meet");

    if (!integration) {
      return yield* Effect.fail(
        new NotFoundError({
          message: "Google Meet integration not found. Please connect your Google account.",
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
            message: "Google access token expired. Please reconnect your account.",
          }),
        );
      }

      const newTokens = yield* google.refreshAccessToken(integration.refreshToken);
      accessToken = newTokens.access_token;

      // Update the integration with new tokens
      yield* integrationRepo.updateIntegration(integration.id, {
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token || integration.refreshToken,
        expiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
      });
    }

    // Fetch recordings from Google Drive
    const response = yield* google.listMeetRecordings(accessToken, pageSize, pageToken);

    // Parse recordings into simplified format
    const recordings = google.parseRecordings(response);

    return {
      recordings,
      nextPageToken: response.nextPageToken,
    } as RecordingsResponse;
  });

  const exit = await Effect.runPromiseExit(Effect.provide(effect, RecordingsLayer));

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
        if (err instanceof HttpError) {
          return NextResponse.json({ success: false, error: err.message }, { status: err.status });
        }
      }
      console.error("[Google Recordings Error]", cause);
      return NextResponse.json({ success: false, error: "Failed to fetch recordings" }, { status: 500 });
    },
    onSuccess: (data) => {
      return NextResponse.json({ success: true, data });
    },
  });
}
