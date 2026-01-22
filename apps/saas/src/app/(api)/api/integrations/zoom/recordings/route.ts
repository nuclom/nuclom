import { auth } from '@nuclom/lib/auth';
import { HttpError, NotFoundError, UnauthorizedError } from '@nuclom/lib/effect/errors';
import { DatabaseLive } from '@nuclom/lib/effect/services/database';
import { IntegrationRepository, IntegrationRepositoryLive } from '@nuclom/lib/effect/services/integration-repository';
import { buildZoomOAuthToken, Zoom, ZoomLive } from '@nuclom/lib/effect/services/zoom';
import { ZoomClientLive } from '@nuclom/lib/effect/services/zoom-client';
import { logger } from '@nuclom/lib/logger';
import { Cause, Effect, Exit, Layer, Option } from 'effect';
import { type NextRequest, NextResponse } from 'next/server';

const IntegrationRepositoryWithDeps = IntegrationRepositoryLive.pipe(Layer.provide(DatabaseLive));
const ZoomWithDeps = ZoomLive.pipe(Layer.provide(ZoomClientLive));
const RecordingsLayer = Layer.mergeAll(ZoomWithDeps, IntegrationRepositoryWithDeps, DatabaseLive);

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

    if (integration.expiresAt && new Date(integration.expiresAt) < new Date() && !integration.refreshToken) {
      return yield* Effect.fail(
        new UnauthorizedError({
          message: 'Zoom access token expired. Please reconnect your account.',
        }),
      );
    }

    const token = buildZoomOAuthToken({
      accessToken: integration.accessToken,
      refreshToken: integration.refreshToken,
      expiresAt: integration.expiresAt,
      scope: integration.scope,
    });

    // Fetch recordings (SDK handles refresh when needed)
    const { response, refreshedToken } = yield* zoom.listRecordings(
      token,
      from || defaultFrom,
      to || defaultTo,
      30,
      pageToken,
    );

    if (refreshedToken) {
      yield* integrationRepo.updateIntegration(integration.id, {
        accessToken: refreshedToken.accessToken,
        refreshToken: refreshedToken.refreshToken ?? integration.refreshToken ?? undefined,
        expiresAt: new Date(refreshedToken.expirationTimeIso),
        scope: refreshedToken.scopes.join(' '),
      });
    }

    // Parse recordings into simplified format
    const recordings = zoom.parseRecordings(response);

    return {
      recordings,
      nextPageToken: response.next_page_token ?? undefined,
    };
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
      logger.error('Zoom recordings error', undefined, { cause: String(cause), component: 'zoom-recordings' });
      return NextResponse.json({ success: false, error: 'Failed to fetch recordings' }, { status: 500 });
    },
    onSuccess: (data) => {
      return NextResponse.json({ success: true, data });
    },
  });
}
