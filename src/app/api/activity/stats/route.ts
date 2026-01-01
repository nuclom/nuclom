import { Effect, Layer } from "effect";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  ActivityFeedRepository,
  ActivityFeedRepositoryLive,
} from "@/lib/effect/services/activity-feed-repository";
import { DatabaseLive } from "@/lib/effect/services/database";
import {
  OrganizationRepository,
  OrganizationRepositoryLive,
} from "@/lib/effect/services/organization-repository";

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
    const activeOrg = yield* orgRepo.getActiveOrganization(session.user.id);

    if (!activeOrg) {
      return { stats: [], days };
    }

    // Fetch activity stats
    const stats = yield* activityRepo.getActivityStats(activeOrg.id, days);

    return { stats, days };
  });

  try {
    const result = await Effect.runPromise(Effect.provide(effect, StatsLayer));
    return NextResponse.json(result);
  } catch (err) {
    console.error("[Activity Stats Error]", err);
    return NextResponse.json(
      { error: "Failed to fetch activity stats" },
      { status: 500 },
    );
  }
}
