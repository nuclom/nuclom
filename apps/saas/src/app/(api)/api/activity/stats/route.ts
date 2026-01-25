import { handleEffectExit, runApiEffect } from '@nuclom/lib/api-handler';
import { ActivityFeedRepository } from '@nuclom/lib/effect/services/activity-feed-repository';
import { Auth } from '@nuclom/lib/effect/services/auth';
import { OrganizationRepository } from '@nuclom/lib/effect/services/organization-repository';
import { Effect, Option } from 'effect';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = Number.parseInt(searchParams.get('days') ?? '30', 10);

  const effect = Effect.gen(function* () {
    // Authenticate using Auth service
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const activityRepo = yield* ActivityFeedRepository;
    const orgRepo = yield* OrganizationRepository;

    // Get the user's active organization
    const activeOrgOption = yield* orgRepo.getActiveOrganization(user.id);

    if (Option.isNone(activeOrgOption)) {
      return { stats: [], days };
    }

    const activeOrg = activeOrgOption.value;

    // Fetch activity stats
    const stats = yield* activityRepo.getActivityStats(activeOrg.id, days);

    return { stats, days };
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}
