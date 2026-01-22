import { auth } from '@nuclom/lib/auth';
import { HttpError, UnauthorizedError } from '@nuclom/lib/effect/errors';
import { DatabaseLive } from '@nuclom/lib/effect/services/database';
import { IntegrationRepository, IntegrationRepositoryLive } from '@nuclom/lib/effect/services/integration-repository';
import { buildZoomOAuthToken, Zoom, ZoomLive } from '@nuclom/lib/effect/services/zoom';
import { ZoomClientLive } from '@nuclom/lib/effect/services/zoom-client';
import { logger } from '@nuclom/lib/logger';
import type { MeetingsListMeetingsQueryParams } from '@zoom/rivet/meetings';
import { Cause, Effect, Exit, Layer, Option } from 'effect';
import { type NextRequest, NextResponse } from 'next/server';

const IntegrationRepositoryWithDeps = IntegrationRepositoryLive.pipe(Layer.provide(DatabaseLive));
const ZoomWithDeps = ZoomLive.pipe(Layer.provide(ZoomClientLive));
const MeetingsLayer = Layer.mergeAll(IntegrationRepositoryWithDeps, DatabaseLive, ZoomWithDeps);

// =============================================================================
// GET /api/integrations/zoom/meetings - List Zoom scheduled/past meetings
// =============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const type = searchParams.get('type') || 'scheduled'; // scheduled, live, upcoming, previous

  // Verify authentication
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const effect = Effect.gen(function* () {
    const integrationRepo = yield* IntegrationRepository;
    const zoom = yield* Zoom;

    // Get user's Zoom integration
    const integration = yield* integrationRepo.getIntegrationByProvider(session.user.id, 'zoom');

    if (!integration) {
      return { meetings: [] };
    }

    if (integration.expiresAt && new Date(integration.expiresAt) < new Date() && !integration.refreshToken) {
      return yield* Effect.fail(
        new UnauthorizedError({
          message: 'Access token expired. Please reconnect your account.',
        }),
      );
    }

    const token = buildZoomOAuthToken({
      accessToken: integration.accessToken,
      refreshToken: integration.refreshToken,
      expiresAt: integration.expiresAt,
      scope: integration.scope,
    });

    const meetingType: MeetingsListMeetingsQueryParams['type'] =
      type === 'scheduled' ||
      type === 'live' ||
      type === 'upcoming' ||
      type === 'upcoming_meetings' ||
      type === 'previous_meetings'
        ? type
        : 'scheduled';

    const query: MeetingsListMeetingsQueryParams = {
      type: meetingType,
      page_size: 100,
      from: from ? from.split('T')[0] : undefined,
      to: to ? to.split('T')[0] : undefined,
    };

    const { response, refreshedToken } = yield* zoom.listMeetings(token, query);

    if (refreshedToken) {
      yield* integrationRepo.updateIntegration(integration.id, {
        accessToken: refreshedToken.accessToken,
        refreshToken: refreshedToken.refreshToken ?? integration.refreshToken ?? undefined,
        expiresAt: new Date(refreshedToken.expirationTimeIso),
        scope: refreshedToken.scopes.join(' '),
      });
    }

    return {
      meetings: response.meetings ?? [],
      totalRecords: response.total_records ?? 0,
      nextPageToken: response.next_page_token ?? undefined,
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
        if (err instanceof HttpError) {
          return NextResponse.json({ success: false, error: err.message }, { status: err.status });
        }
        logger.error('Zoom meetings error', err instanceof Error ? err : new Error(String(err)), {
          component: 'zoom-meetings',
        });
      }
      return NextResponse.json({ success: false, error: 'Failed to fetch meetings' }, { status: 500 });
    },
    onSuccess: (data) => {
      return NextResponse.json({ success: true, data });
    },
  });
}
