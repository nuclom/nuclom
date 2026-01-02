import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { getOrganizationBySlug } from "@/lib/effect/server";
import type { DecisionFilters } from "@/lib/types";
import { DecisionRegistryClient } from "./decisions-client";

interface DecisionRegistryPageProps {
  params: Promise<{ organization: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DecisionRegistryPage({ params, searchParams }: DecisionRegistryPageProps) {
  const { organization } = await params;
  const query = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    notFound();
  }

  // Get organization
  const org = await getOrganizationBySlug(organization);
  if (!org) {
    notFound();
  }

  // Build filters from search params
  const status = typeof query.status === "string" ? query.status : undefined;
  const source = typeof query.source === "string" ? query.source : undefined;
  const topicsRaw = typeof query.topics === "string" ? query.topics : undefined;
  const participantsRaw = typeof query.participants === "string" ? query.participants : undefined;
  const fromRaw = typeof query.from === "string" ? query.from : undefined;
  const toRaw = typeof query.to === "string" ? query.to : undefined;
  const search = typeof query.search === "string" ? query.search : undefined;

  const filters: DecisionFilters = {
    ...(status === "decided" || status === "proposed" || status === "superseded" ? { status } : {}),
    ...(source === "meeting" || source === "adhoc" || source === "manual" ? { source } : {}),
    ...(topicsRaw ? { topics: topicsRaw.split(",").map((t) => t.trim()) } : {}),
    ...(participantsRaw ? { participants: participantsRaw.split(",").map((p) => p.trim()) } : {}),
    ...(fromRaw ? { from: new Date(fromRaw) } : {}),
    ...(toRaw ? { to: new Date(toRaw) } : {}),
    ...(search ? { search } : {}),
  };

  // Parse pagination
  const page = typeof query.page === "string" ? parseInt(query.page, 10) : 1;

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
