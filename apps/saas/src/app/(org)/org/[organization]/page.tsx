import { auth } from '@nuclom/lib/auth';
import type { Organization } from '@nuclom/lib/db/schema';
import { getCollections, getOrganizationBySlug, getVideos } from '@nuclom/lib/effect/server';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { DashboardHero } from '@/components/dashboard/dashboard-hero';
import { VideoSection } from '@/components/dashboard/video-section';
import { GettingStartedChecklist } from '@/components/getting-started-checklist';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Your video collaboration dashboard',
};

// =============================================================================
// Loading Skeleton Components
// =============================================================================

function VideoCardSkeleton() {
  return (
    <div className="space-y-3">
      {/* Video thumbnail */}
      <div className="relative aspect-video bg-muted animate-pulse rounded-xl" />
      {/* Content with avatar */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="h-9 w-9 rounded-full bg-muted animate-pulse shrink-0" />
        <div className="flex-1 space-y-2">
          {/* Title */}
          <div className="h-4 bg-muted animate-pulse rounded w-full" />
          <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
          {/* Author */}
          <div className="h-3 bg-muted animate-pulse rounded w-1/3" />
          {/* Date */}
          <div className="h-3 bg-muted animate-pulse rounded w-1/4" />
        </div>
      </div>
    </div>
  );
}

function VideoSectionSkeleton({ cardCount = 4 }: { cardCount?: number }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          {/* Section title */}
          <div className="h-6 w-40 bg-muted animate-pulse rounded" />
          {/* Section description */}
          <div className="h-4 w-56 bg-muted animate-pulse rounded" />
        </div>
        {/* View all button */}
        <div className="h-9 w-20 bg-muted animate-pulse rounded" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8">
        {Array.from({ length: cardCount }).map((_, i) => (
          <VideoCardSkeleton key={i} />
        ))}
      </div>
    </section>
  );
}

function SidebarSkeleton() {
  return (
    <div className="space-y-4">
      {/* Getting Started Checklist skeleton */}
      <div className="rounded-xl border bg-card p-4 space-y-4">
        <div className="h-5 w-32 bg-muted animate-pulse rounded" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-5 w-5 rounded-full bg-muted animate-pulse" />
              <div className="h-4 flex-1 bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
      {/* Activity Feed skeleton */}
      <div className="rounded-xl border bg-card p-4 space-y-4">
        <div className="h-5 w-28 bg-muted animate-pulse rounded" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-muted animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted animate-pulse rounded w-full" />
                <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Main grid: Content + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Main Section */}
        <div className="space-y-10">
          {/* Continue Watching section */}
          <VideoSectionSkeleton cardCount={4} />
          {/* New This Week section */}
          <VideoSectionSkeleton cardCount={4} />
          {/* From Your Channels section */}
          <VideoSectionSkeleton cardCount={4} />
        </div>

        {/* Sidebar - Right side (desktop) */}
        <div className="hidden lg:block">
          <SidebarSkeleton />
        </div>
      </div>

      {/* Mobile sidebar */}
      <div className="lg:hidden">
        <SidebarSkeleton />
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
  // Fetch videos and collections using cached Effect queries
  const [videosResult, collectionsResult] = await Promise.all([
    getVideos(organizationId),
    getCollections(organizationId),
  ]);
  const videos = videosResult.data;
  const collections = collectionsResult.data;

  const hasVideos = videos.length > 0;
  const hasCollectionsWithVideos = collections.some((collection) => collection.videoCount > 0);

  // Split videos into sections
  const continueWatching = videos.slice(0, 4);
  const newThisWeek = videos.slice(0, 8);
  const fromCollections = hasCollectionsWithVideos ? videos.slice(0, 6) : [];

  return (
    <div className="space-y-8">
      {/* Top Section: Hero (centered) + Sidebar (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Main Section - Centered */}
        <div className="space-y-10">
          {!hasVideos && <DashboardHero organization={organizationSlug} userName={userName} />}

          {hasVideos ? (
            <>
              <VideoSection
                title="Continue Watching"
                description="Pick up where you left off"
                videos={continueWatching}
                organization={organizationSlug}
                viewAllHref={`/org/${organizationSlug}/history`}
              />

              <VideoSection
                title="New This Week"
                description="Latest videos from your team"
                videos={newThisWeek}
                organization={organizationSlug}
                viewAllHref={`/org/${organizationSlug}/videos`}
              />

              <VideoSection
                title="From Your Collections"
                videos={fromCollections}
                organization={organizationSlug}
                viewAllHref={`/org/${organizationSlug}/collections`}
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
    organization = await getOrganizationBySlug(organizationSlug);
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
