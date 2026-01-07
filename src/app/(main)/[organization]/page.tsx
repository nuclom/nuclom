import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { DashboardHero } from '@/components/dashboard/dashboard-hero';
import { VideoSection } from '@/components/dashboard/video-section';
import { GettingStartedChecklist } from '@/components/getting-started-checklist';
import { auth } from '@/lib/auth';
import type { Organization } from '@/lib/db/schema';
import { getCachedOrganizationBySlug, getCachedVideos } from '@/lib/effect';

// =============================================================================
// Loading Skeleton Component
// =============================================================================

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Main grid: Content + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Main Section */}
        <div className="space-y-10">
          {/* Hero skeleton */}
          <div className="h-48 rounded-2xl bg-muted animate-pulse" />

          {/* Video section skeletons */}
          {Array.from({ length: 3 }).map((_, sectionIndex) => (
            <div key={`section-${sectionIndex}`}>
              <div className="h-6 w-48 bg-muted animate-pulse rounded mb-6" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={`skeleton-${sectionIndex}-${i}`} className="space-y-3">
                    <div className="aspect-video bg-muted animate-pulse rounded-lg" />
                    <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                    <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar skeleton - Right side */}
        <div className="space-y-4 hidden lg:block">
          <div className="h-64 rounded-xl bg-muted animate-pulse" />
          <div className="h-48 rounded-xl bg-muted animate-pulse" />
        </div>
      </div>

      {/* Mobile sidebar skeleton */}
      <div className="space-y-4 lg:hidden">
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
        <div className="h-48 rounded-xl bg-muted animate-pulse" />
      </div>
    </div>
  );
}

// =============================================================================
// Dashboard Content Component (Server Component)
// =============================================================================

interface DashboardContentProps {
  organizationId: string;
  organizationSlug: string;
  userName?: string;
}

async function DashboardContent({ organizationId, organizationSlug, userName }: DashboardContentProps) {
  // Fetch videos using cached Effect query
  const result = await getCachedVideos(organizationId);
  const videos = result.data;

  const hasVideos = videos.length > 0;

  // Split videos into sections
  const continueWatching = videos.slice(0, 4);
  const newThisWeek = videos.slice(0, 8);
  const fromChannels = videos.slice(0, 6);

  return (
    <div className="space-y-8">
      {/* Top Section: Hero (centered) + Sidebar (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Main Section - Centered */}
        <div className="space-y-10">
          <DashboardHero organization={organizationSlug} userName={userName} hasVideos={hasVideos} />

          {hasVideos ? (
            <>
              <VideoSection
                title="Continue Watching"
                description="Pick up where you left off"
                videos={continueWatching}
                organization={organizationSlug}
                viewAllHref={`/${organizationSlug}/history`}
              />

              <VideoSection
                title="New This Week"
                description="Latest videos from your team"
                videos={newThisWeek}
                organization={organizationSlug}
                viewAllHref={`/${organizationSlug}/videos`}
              />

              <VideoSection
                title="From Your Channels"
                videos={fromChannels}
                organization={organizationSlug}
                viewAllHref={`/${organizationSlug}/channels`}
              />
            </>
          ) : (
            <VideoSection
              title="Your Videos"
              videos={[]}
              organization={organizationSlug}
              emptyMessage="Upload your first video to get started"
              showUploadCTA
            />
          )}
        </div>

        {/* Sidebar - Right side */}
        <div className="space-y-4 hidden lg:block">
          <GettingStartedChecklist organization={organizationSlug} hasVideos={hasVideos} />
          <ActivityFeed />
        </div>
      </div>

      {/* Mobile sidebar - shown below on smaller screens */}
      <div className="space-y-4 lg:hidden">
        <GettingStartedChecklist organization={organizationSlug} hasVideos={hasVideos} />
        <ActivityFeed />
      </div>
    </div>
  );
}

// =============================================================================
// Dashboard Loader Component
// =============================================================================

async function DashboardLoader({ params }: { params: Promise<{ organization: string }> }) {
  const { organization: organizationSlug } = await params;

  // Authenticate user
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/login');
  }

  // Get organization by slug using cached Effect query
  let organization: Organization;
  try {
    organization = await getCachedOrganizationBySlug(organizationSlug);
  } catch {
    notFound();
  }

  return (
    <DashboardContent
      organizationId={organization.id}
      organizationSlug={organizationSlug}
      userName={session.user?.name || undefined}
    />
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function OrganizationPage({ params }: { params: Promise<{ organization: string }> }) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardLoader params={params} />
    </Suspense>
  );
}
