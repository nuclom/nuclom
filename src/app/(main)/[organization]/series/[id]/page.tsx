import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCachedOrganizationBySlug, getCachedSeriesProgress, getCachedSeriesWithVideos } from "@/lib/effect";
import type { SeriesProgressWithDetails, SeriesWithVideos } from "@/lib/types";
import { SeriesDetailClient } from "./series-detail-client";

export default async function SeriesDetailPage({ params }: { params: Promise<{ organization: string; id: string }> }) {
  const { organization, id } = await params;

  // Get the current user session
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  // Get organization by slug
  let organizationData: Awaited<ReturnType<typeof getCachedOrganizationBySlug>>;
  try {
    organizationData = await getCachedOrganizationBySlug(organization);
  } catch {
    notFound();
  }

  // Fetch series with videos
  let seriesData: SeriesWithVideos;
  try {
    seriesData = await getCachedSeriesWithVideos(id);
  } catch {
    notFound();
  }

  // Verify series belongs to this organization
  if (seriesData.organizationId !== organizationData.id) {
    notFound();
  }

  // Get user's progress for this series if logged in
  let progressData: SeriesProgressWithDetails | null = null;
  if (session?.user) {
    try {
      progressData = await getCachedSeriesProgress(session.user.id, id);
    } catch {
      // Continue without progress
    }
  }

  return (
    <SeriesDetailClient
      organization={organization}
      organizationId={organizationData.id}
      series={seriesData}
      progress={progressData}
    />
  );
}
