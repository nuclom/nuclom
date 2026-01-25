import { handleEffectExit, runApiEffect } from '@nuclom/lib/api-handler';
import type { ActivityType } from '@nuclom/lib/db/schema';
import { activityTypeEnum } from '@nuclom/lib/db/schema/enums';
import { ActivityFeedRepository } from '@nuclom/lib/effect/services/activity-feed-repository';
import { Auth } from '@nuclom/lib/effect/services/auth';
import { OrganizationRepository } from '@nuclom/lib/effect/services/organization-repository';
import { Effect, Option } from 'effect';
import type { NextRequest } from 'next/server';
import { connection } from 'next/server';

// Type guard for ActivityType
const VALID_ACTIVITY_TYPES = new Set<string>(activityTypeEnum.enumValues);
function isActivityType(value: string): value is ActivityType {
  return VALID_ACTIVITY_TYPES.has(value);
}

function parseValidActivityTypes(input: string): ActivityType[] {
  return input.split(',').filter(isActivityType);
}

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
    const typesParam = searchParams.get('types');
    const types = typesParam ? parseValidActivityTypes(typesParam) : undefined;
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

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}
