import process from "node:process";
import { headers } from "next/headers";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { auth } from "@/lib/auth";
import { getCachedOrganizationBySlug, getCachedSeriesWithProgress } from "@/lib/effect";
import { SeriesListClient } from "./series-list-client";

function SeriesListSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-9 w-32" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={`skeleton-${i}`} className="space-y-3">
            <Skeleton className="aspect-video rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

async function SeriesListLoader({ params }: { params: Promise<{ organization: string }> }) {
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
      const result = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/series?organizationId=${organizationData.id}`,
        {
          cache: "no-store",
        },
      );
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

export default function SeriesListPage({ params }: { params: Promise<{ organization: string }> }) {
  return (
    <Suspense fallback={<SeriesListSkeleton />}>
      <SeriesListLoader params={params} />
    </Suspense>
  );
}
