import { Effect, Layer, Option } from "effect";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ActivityFeedRepository, ActivityFeedRepositoryLive } from "@/lib/effect/services/activity-feed-repository";
import { DatabaseLive } from "@/lib/effect/services/database";
import { OrganizationRepository, OrganizationRepositoryLive } from "@/lib/effect/services/organization-repository";
import { logger } from "@/lib/logger";

const ActivityFeedRepoWithDeps = ActivityFeedRepositoryLive.pipe(Layer.provide(DatabaseLive));
const OrgRepoWithDeps = OrganizationRepositoryLive.pipe(Layer.provide(DatabaseLive));
const StatsLayer = Layer.mergeAll(ActivityFeedRepoWithDeps, OrgRepoWithDeps, DatabaseLive);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = Number.parseInt(searchParams.get("days") ?? "30", 10);

  // Verify the user is authenticated
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const effect = Effect.gen(function* () {
    const activityRepo = yield* ActivityFeedRepository;
    const orgRepo = yield* OrganizationRepository;

    // Get the user's active organization
    const activeOrgOption = yield* orgRepo.getActiveOrganization(session.user.id);

    if (Option.isNone(activeOrgOption)) {
      return { stats: [], days };
    }

    const activeOrg = activeOrgOption.value;

    // Fetch activity stats
    const stats = yield* activityRepo.getActivityStats(activeOrg.id, days);

    return { stats, days };
  });

  try {
    const result = await Effect.runPromise(Effect.provide(effect, StatsLayer));
    return NextResponse.json(result);
  } catch (err) {
    logger.error("[Activity Stats Error]", err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: "Failed to fetch activity stats" }, { status: 500 });
  }
}
