import { Cause, Effect, Exit, Layer, Option } from 'effect';
import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { HttpError, NotFoundError, UnauthorizedError } from '@/lib/effect/errors';
import { DatabaseLive } from '@/lib/effect/services/database';
import { IntegrationRepository, IntegrationRepositoryLive } from '@/lib/effect/services/integration-repository';
import { Zoom, ZoomLive, type ZoomRecording } from '@/lib/effect/services/zoom';

const IntegrationRepositoryWithDeps = IntegrationRepositoryLive.pipe(Layer.provide(DatabaseLive));
const RecordingsLayer = Layer.mergeAll(ZoomLive, IntegrationRepositoryWithDeps, DatabaseLive);

interface RecordingsResponse {
  recordings: ZoomRecording[];
  nextPageToken?: string;
}

// =============================================================================
// GET /api/integrations/zoom/recordings - List Zoom recordings
// =============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const pageToken = searchParams.get('pageToken') || undefined;

  // Verify authentication
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Default date range: last 30 days
  const now = new Date();
  const defaultTo = now.toISOString().split('T')[0];
  const defaultFrom = new Date(now.setDate(now.getDate() - 30)).toISOString().split('T')[0];

  const effect = Effect.gen(function* () {
    const zoom = yield* Zoom;
    const integrationRepo = yield* IntegrationRepository;

    // Get user's Zoom integration
    const integration = yield* integrationRepo.getIntegrationByProvider(session.user.id, 'zoom');

    if (!integration) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'Zoom integration not found. Please connect your Zoom account.',
          entity: 'Integration',
        }),
      );
    }

    // Check if token is expired and refresh if needed
    let accessToken = integration.accessToken;
    if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
      if (!integration.refreshToken) {
        return yield* Effect.fail(
          new UnauthorizedError({
            message: 'Zoom access token expired. Please reconnect your account.',
          }),
        );
      }

      const newTokens = yield* zoom.refreshAccessToken(integration.refreshToken);
      accessToken = newTokens.access_token;

      // Update the integration with new tokens
      yield* integrationRepo.updateIntegration(integration.id, {
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token || integration.refreshToken,
        expiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
      });
    }

    // Fetch recordings
    const response = yield* zoom.listRecordings(accessToken, from || defaultFrom, to || defaultTo, 30, pageToken);

    // Parse recordings into simplified format
    const recordings = zoom.parseRecordings(response);

    return {
      recordings,
      nextPageToken: response.next_page_token,
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
      console.error('[Zoom Recordings Error]', cause);
      return NextResponse.json({ success: false, error: 'Failed to fetch recordings' }, { status: 500 });
    },
    onSuccess: (data) => {
      return NextResponse.json({ success: true, data });
    },
  });
}
