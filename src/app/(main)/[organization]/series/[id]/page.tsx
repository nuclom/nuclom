import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { auth } from '@/lib/auth';
import { getCachedOrganizationBySlug, getCachedSeriesProgress, getCachedSeriesWithVideos } from '@/lib/effect';
import type { SeriesProgressWithDetails, SeriesWithVideos } from '@/lib/types';
import { SeriesDetailClient } from './series-detail-client';

function SeriesDetailSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-48 w-full rounded-lg" />
      <Skeleton className="h-9 w-64" />
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={`skeleton-${i}`} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

async function SeriesDetailLoader({ params }: { params: Promise<{ organization: string; id: string }> }) {
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

export default function SeriesDetailPage({ params }: { params: Promise<{ organization: string; id: string }> }) {
  return (
    <Suspense fallback={<SeriesDetailSkeleton />}>
      <SeriesDetailLoader params={params} />
    </Suspense>
  );
}
