import { Cause, Effect, Exit, Layer, Option } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { UnauthorizedError } from "@/lib/effect/errors";
import { DatabaseLive } from "@/lib/effect/services/database";
import { GoogleMeet, GoogleMeetLive } from "@/lib/effect/services/google-meet";
import { IntegrationRepository, IntegrationRepositoryLive } from "@/lib/effect/services/integration-repository";
import { logger } from "@/lib/logger";

const IntegrationRepositoryWithDeps = IntegrationRepositoryLive.pipe(Layer.provide(DatabaseLive));
const CalendarLayer = Layer.mergeAll(IntegrationRepositoryWithDeps, DatabaseLive, GoogleMeetLive);

// =============================================================================
// GET /api/integrations/google/calendar - List Google Calendar events with Meet links
// =============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // Verify authentication
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!from || !to) {
    return NextResponse.json({ success: false, error: "from and to parameters are required" }, { status: 400 });
  }

  const effect = Effect.gen(function* () {
    const integrationRepo = yield* IntegrationRepository;
    const google = yield* GoogleMeet;

    // Get user's Google integration
    const integration = yield* integrationRepo.getIntegrationByProvider(session.user.id, "google_meet");

    if (!integration) {
      return { events: [] };
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

      const newTokens = yield* google.refreshAccessToken(integration.refreshToken);
      accessToken = newTokens.access_token;

      yield* integrationRepo.updateIntegration(integration.id, {
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token || integration.refreshToken,
        expiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
      });
    }

    // List calendar events
    const response = yield* google.listCalendarEvents(accessToken, from, to, 100);

    // Filter events that have Google Meet links
    const meetEvents = response.items.filter(
      (event) =>
        event.hangoutLink || (event.conferenceData && event.conferenceData.conferenceSolution?.name === "Google Meet"),
    );

    return {
      events: meetEvents,
      nextPageToken: response.nextPageToken,
    };
  });

  const exit = await Effect.runPromiseExit(Effect.provide(effect, CalendarLayer));

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (Option.isSome(error)) {
        const err = error.value;
        if (err instanceof UnauthorizedError) {
          return NextResponse.json({ success: false, error: err.message }, { status: 401 });
        }
        logger.error("[Google Calendar Error]", err instanceof Error ? err : new Error(String(err)));
      }
      return NextResponse.json({ success: false, error: "Failed to fetch calendar events" }, { status: 500 });
    },
    onSuccess: (data) => {
      return NextResponse.json({ success: true, data });
    },
  });
}
