import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { VideoSection } from "@/components/dashboard/video-section";
import { GettingStartedChecklist } from "@/components/getting-started-checklist";
import { auth } from "@/lib/auth";
import type { Organization } from "@/lib/db/schema";
import { getCachedOrganizationBySlug, getCachedVideos } from "@/lib/effect";

// =============================================================================
// Loading Skeleton Component
// =============================================================================

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Hero skeleton */}
      <div className="h-48 rounded-2xl bg-muted animate-pulse" />

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div>
            <div className="h-6 w-48 bg-muted animate-pulse rounded mb-6" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={`skeleton-${i}`} className="space-y-3">
                  <div className="aspect-video bg-muted animate-pulse rounded-lg" />
                  <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                  <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="h-64 rounded-xl bg-muted animate-pulse" />
          <div className="h-48 rounded-xl bg-muted animate-pulse" />
        </div>
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
      {/* Hero Section */}
      <DashboardHero organization={organizationSlug} userName={userName} hasVideos={hasVideos} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Video Sections */}
        <div className="lg:col-span-2 space-y-10">
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

        {/* Sidebar */}
        <div className="space-y-6">
          <GettingStartedChecklist organization={organizationSlug} hasVideos={hasVideos} />

          <ActivityFeed />
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default async function OrganizationPage({ params }: { params: Promise<{ organization: string }> }) {
  const { organization: organizationSlug } = await params;

  // Authenticate user
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/auth/sign-in");
  }

  // Get organization by slug using cached Effect query
  let organization: Organization;
  try {
    organization = await getCachedOrganizationBySlug(organizationSlug);
  } catch {
    notFound();
  }

  // Render with Suspense for streaming
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent
        organizationId={organization.id}
        organizationSlug={organizationSlug}
        userName={session.user?.name || undefined}
      />
    </Suspense>
  );
}
