import { Effect } from "effect";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { DecisionRepositoryLive } from "@/lib/effect/services/decision-repository";
import { DatabaseLive } from "@/lib/effect/services/database";
import { Layer } from "effect";
import { getCachedOrganizationBySlug } from "@/lib/effect/server";
import { DecisionRegistryClient } from "./decisions-client";
import type { DecisionFilters } from "@/lib/types";

interface DecisionRegistryPageProps {
  params: Promise<{ organization: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DecisionRegistryPage({
  params,
  searchParams,
}: DecisionRegistryPageProps) {
  const { organization } = await params;
  const query = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    notFound();
  }

  // Get organization
  const org = await getCachedOrganizationBySlug(organization);
  if (!org) {
    notFound();
  }

  // Build filters from search params
  const filters: DecisionFilters = {};

  const status = typeof query.status === "string" ? query.status : undefined;
  if (status === "decided" || status === "proposed" || status === "superseded") {
    filters.status = status;
  }

  const source = typeof query.source === "string" ? query.source : undefined;
  if (source === "meeting" || source === "adhoc" || source === "manual") {
    filters.source = source;
  }

  const topics = typeof query.topics === "string" ? query.topics : undefined;
  if (topics) {
    filters.topics = topics.split(",").map((t) => t.trim());
  }

  const participants = typeof query.participants === "string" ? query.participants : undefined;
  if (participants) {
    filters.participants = participants.split(",").map((p) => p.trim());
  }

  const from = typeof query.from === "string" ? query.from : undefined;
  if (from) {
    filters.from = new Date(from);
  }

  const to = typeof query.to === "string" ? query.to : undefined;
  if (to) {
    filters.to = new Date(to);
  }

  const search = typeof query.search === "string" ? query.search : undefined;
  if (search) {
    filters.search = search;
  }

  // Parse pagination
  const page = typeof query.page === "string" ? parseInt(query.page, 10) : 1;
  const limit = 20;

  // Fetch decisions and tags
  const DecisionLayer = DecisionRepositoryLive.pipe(Layer.provide(DatabaseLive));

  const fetchData = Effect.gen(function* () {
    const { DecisionRepository } = yield* Effect.all({
      DecisionRepository: Effect.serviceOption(
        Effect.Tag<typeof import("@/lib/effect/services/decision-repository").DecisionRepository>()
      ),
    }).pipe(Effect.provide(DecisionLayer));

    // We need to import and use the repository directly
    const { db } = yield* Effect.service(
      Effect.Tag<typeof import("@/lib/effect/services/database").Database>()
    ).pipe(Effect.provide(DatabaseLive));

    return { db };
  });

  // Use fetch API to get data instead of Effect for simplicity in RSC
  const decisionsUrl = new URL(`/api/decisions`, "http://localhost:3000");
  decisionsUrl.searchParams.set("organizationId", org.id);
  if (filters.status) decisionsUrl.searchParams.set("status", filters.status);
  if (filters.source) decisionsUrl.searchParams.set("source", filters.source);
  if (filters.search) decisionsUrl.searchParams.set("search", filters.search);
  if (filters.topics) decisionsUrl.searchParams.set("topics", filters.topics.join(","));
  if (filters.participants) decisionsUrl.searchParams.set("participants", filters.participants.join(","));
  if (filters.from) decisionsUrl.searchParams.set("from", filters.from.toISOString());
  if (filters.to) decisionsUrl.searchParams.set("to", filters.to.toISOString());
  decisionsUrl.searchParams.set("page", String(page));
  decisionsUrl.searchParams.set("limit", String(limit));

  const tagsUrl = new URL(`/api/decisions/tags`, "http://localhost:3000");
  tagsUrl.searchParams.set("organizationId", org.id);

  // Fetch data using internal fetch (we'll handle this through the client component instead)
  // For now, pass empty initial data and let the client fetch

  return (
    <DecisionRegistryClient
      organization={organization}
      organizationId={org.id}
      initialDecisions={{ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }}
      initialTags={[]}
      initialFilters={filters}
      initialPage={page}
    />
  );
}
