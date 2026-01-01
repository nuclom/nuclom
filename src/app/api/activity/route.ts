import { Effect, Layer, Option } from "effect";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { ActivityType } from "@/lib/db/schema";
import { ActivityFeedRepository, ActivityFeedRepositoryLive } from "@/lib/effect/services/activity-feed-repository";
import { DatabaseLive } from "@/lib/effect/services/database";
import { OrganizationRepository, OrganizationRepositoryLive } from "@/lib/effect/services/organization-repository";

const ActivityFeedRepoWithDeps = ActivityFeedRepositoryLive.pipe(Layer.provide(DatabaseLive));
const OrgRepoWithDeps = OrganizationRepositoryLive.pipe(Layer.provide(DatabaseLive));
const ActivityLayer = Layer.mergeAll(ActivityFeedRepoWithDeps, OrgRepoWithDeps, DatabaseLive);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const limit = Number.parseInt(searchParams.get("limit") ?? "20", 10);
  const types = searchParams.get("types")?.split(",") as ActivityType[] | undefined;
  const actorId = searchParams.get("actorId") ?? undefined;
  const resourceType = searchParams.get("resourceType") ?? undefined;
  const resourceId = searchParams.get("resourceId") ?? undefined;
  const startDateParam = searchParams.get("startDate");
  const startDate = startDateParam ? new Date(startDateParam) : undefined;
  const endDateParam = searchParams.get("endDate");
  const endDate = endDateParam ? new Date(endDateParam) : undefined;

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
      return { data: [], total: 0, page, limit };
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

  try {
    const result = await Effect.runPromise(Effect.provide(effect, ActivityLayer));
    return NextResponse.json(result);
  } catch (err) {
    console.error("[Activity Feed Error]", err);
    return NextResponse.json({ error: "Failed to fetch activity feed" }, { status: 500 });
  }
}
