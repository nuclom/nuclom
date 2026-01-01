import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getCachedOrganizationBySlug, getCachedSeriesWithProgress } from "@/lib/effect";
import { env } from "@/lib/env/server";
import { SeriesListClient } from "./series-list-client";

export default async function SeriesListPage({ params }: { params: Promise<{ organization: string }> }) {
  const { organization } = await params;

  // Get the current user session
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  // Get organization by slug
  let organizationData: Awaited<ReturnType<typeof getCachedOrganizationBySlug>>;
  try {
    organizationData = await getCachedOrganizationBySlug(organization);
  } catch {
    return (
      <div className="space-y-8">
        <h1 className="text-3xl font-bold">Series</h1>
        <div className="text-center py-12 text-muted-foreground">Organization not found</div>
      </div>
    );
  }

  // Fetch series data with progress if user is logged in
  let seriesData: Awaited<ReturnType<typeof getCachedSeriesWithProgress>> = [];
  try {
    if (session?.user) {
      seriesData = await getCachedSeriesWithProgress(organizationData.id, session.user.id);
    } else {
      const result = await fetch(`${env.APP_URL}/api/series?organizationId=${organizationData.id}`, {
        cache: "no-store",
      });
      if (result.ok) {
        const data = await result.json();
        seriesData = data.data || [];
      }
    }
  } catch {
    // Continue with empty array
  }

  return (
    <SeriesListClient organization={organization} organizationId={organizationData.id} initialSeries={seriesData} />
  );
}
