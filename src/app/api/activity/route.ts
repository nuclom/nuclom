import { Effect, Layer, Option } from 'effect';
import type { NextRequest } from 'next/server';
import { connection } from 'next/server';
import { handleEffectExit } from '@/lib/api-handler';
import { auth } from '@/lib/auth';
import type { ActivityType } from '@/lib/db/schema';
import { AppLive } from '@/lib/effect';
import { ActivityFeedRepository, ActivityFeedRepositoryLive } from '@/lib/effect/services/activity-feed-repository';
import { Auth, makeAuthLayer } from '@/lib/effect/services/auth';
import { DatabaseLive } from '@/lib/effect/services/database';
import { OrganizationRepository, OrganizationRepositoryLive } from '@/lib/effect/services/organization-repository';

// Build layers with dependencies
const ActivityFeedRepoWithDeps = ActivityFeedRepositoryLive.pipe(Layer.provide(DatabaseLive));
const OrgRepoWithDeps = OrganizationRepositoryLive.pipe(Layer.provide(DatabaseLive));
const ActivityLayer = Layer.mergeAll(AppLive, ActivityFeedRepoWithDeps, OrgRepoWithDeps);

export async function GET(request: NextRequest) {
  await connection();

  const effect = Effect.gen(function* () {
    // Authenticate using Auth service
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Parse query params
    const { searchParams } = new URL(request.url);
    const page = Number.parseInt(searchParams.get('page') ?? '1', 10);
    const limit = Number.parseInt(searchParams.get('limit') ?? '20', 10);
    const types = searchParams.get('types')?.split(',') as ActivityType[] | undefined;
    const actorId = searchParams.get('actorId') ?? undefined;
    const resourceType = searchParams.get('resourceType') ?? undefined;
    const resourceId = searchParams.get('resourceId') ?? undefined;
    const startDateParam = searchParams.get('startDate');
    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDateParam = searchParams.get('endDate');
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    const activityRepo = yield* ActivityFeedRepository;
    const orgRepo = yield* OrganizationRepository;

    // Get the user's active organization
    const activeOrgOption = yield* orgRepo.getActiveOrganization(user.id);

    if (Option.isNone(activeOrgOption)) {
      return { data: [], total: 0, page, limit, totalPages: 0 };
    }

    const activeOrg = activeOrgOption.value;

    // Fetch activity feed
    const result = yield* activityRepo.getActivityFeed(activeOrg.id, page, limit, {
      activityTypes: types,
      actorId,
      resourceType,
      resourceId,
      startDate,
      endDate,
    });

    return {
      ...result,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    };
  });

  // Compose layers with authentication
  const AuthLayer = makeAuthLayer(auth);
  const FullLayer = Layer.merge(ActivityLayer, AuthLayer);
  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
