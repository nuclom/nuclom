import { Cause, Effect, Exit, Layer, Option } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { UnauthorizedError } from "@/lib/effect/errors";
import { DatabaseLive } from "@/lib/effect/services/database";
import { IntegrationRepository, IntegrationRepositoryLive } from "@/lib/effect/services/integration-repository";
import { Zoom, ZoomLive } from "@/lib/effect/services/zoom";

export const dynamic = "force-dynamic";

const IntegrationRepositoryWithDeps = IntegrationRepositoryLive.pipe(Layer.provide(DatabaseLive));
const MeetingsLayer = Layer.mergeAll(IntegrationRepositoryWithDeps, DatabaseLive, ZoomLive);

interface ZoomMeetingListResponse {
  page_count: number;
  page_number: number;
  page_size: number;
  total_records: number;
  next_page_token?: string;
  meetings: Array<{
    uuid: string;
    id: number;
    host_id: string;
    topic: string;
    type: number;
    start_time: string;
    duration: number;
    timezone: string;
    agenda?: string;
    created_at: string;
    join_url: string;
  }>;
}

// =============================================================================
// GET /api/integrations/zoom/meetings - List Zoom scheduled/past meetings
// =============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const type = searchParams.get("type") || "scheduled"; // scheduled, live, upcoming, previous

  // Verify authentication
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const effect = Effect.gen(function* () {
    const integrationRepo = yield* IntegrationRepository;
    const zoom = yield* Zoom;

    // Get user's Zoom integration
    const integration = yield* integrationRepo.getIntegrationByProvider(session.user.id, "zoom");

    if (!integration) {
      return { meetings: [] };
    }

    // Check if token is expired and refresh if needed
    let accessToken = integration.accessToken;
    if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
      if (!integration.refreshToken) {
        return yield* Effect.fail(
          new UnauthorizedError({
            message: "Access token expired. Please reconnect your account.",
          })
        );
      }

      const newTokens = yield* zoom.refreshAccessToken(integration.refreshToken);
      accessToken = newTokens.access_token;

      yield* integrationRepo.updateIntegration(integration.id, {
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token || integration.refreshToken,
        expiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
      });
    }

    // Fetch meetings from Zoom API
    const meetingsResponse = yield* Effect.tryPromise({
      try: async () => {
        const params = new URLSearchParams({
          type,
          page_size: "100",
        });

        if (from) {
          params.set("from", from.split("T")[0]);
        }
        if (to) {
          params.set("to", to.split("T")[0]);
        }

        const res = await fetch(`https://api.zoom.us/v2/users/me/meetings?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`Zoom API error: ${res.status} - ${error}`);
        }

        return res.json() as Promise<ZoomMeetingListResponse>;
      },
      catch: (error) =>
        new Error(`Failed to fetch meetings: ${error instanceof Error ? error.message : "Unknown error"}`),
    });

    return {
      meetings: meetingsResponse.meetings,
      totalRecords: meetingsResponse.total_records,
      nextPageToken: meetingsResponse.next_page_token,
    };
  });

  const exit = await Effect.runPromiseExit(Effect.provide(effect, MeetingsLayer));

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (Option.isSome(error)) {
        const err = error.value;
        if (err instanceof UnauthorizedError) {
          return NextResponse.json({ success: false, error: err.message }, { status: 401 });
        }
        console.error("[Zoom Meetings Error]", err);
      }
      return NextResponse.json({ success: false, error: "Failed to fetch meetings" }, { status: 500 });
    },
    onSuccess: (data) => {
      return NextResponse.json({ success: true, data });
    },
  });
}
