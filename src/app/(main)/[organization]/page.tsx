import { Upload } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { VideoCard } from "@/components/video-card";
import { auth } from "@/lib/auth";
import { getCachedOrganizationBySlug, getCachedVideos } from "@/lib/effect";
import type { VideoWithAuthor } from "@/lib/types";

// =============================================================================
// Loading Skeleton Component
// =============================================================================

function VideoSectionSkeleton() {
  return (
    <section>
      <div className="h-8 w-48 bg-muted animate-pulse rounded mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={`skeleton-${i}`} className="space-y-3">
            <div className="aspect-video bg-muted animate-pulse rounded-lg" />
            <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
            <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
          </div>
        ))}
      </div>
    </section>
  );
}

// =============================================================================
// Video Section Component (Server Component)
// =============================================================================

interface VideoSectionProps {
  title: string;
  videos: VideoWithAuthor[];
  organization: string;
}

function VideoSection({ title, videos, organization }: VideoSectionProps) {
  if (videos.length === 0) {
    return (
      <section>
        <h2 className="text-2xl font-bold mb-6">{title}</h2>
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">No videos found. Upload your first video to get started.</p>
          <Button asChild>
            <Link href={`/${organization}/upload`}>
              <Upload className="mr-2 h-4 w-4" />
              Upload first video
            </Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-2xl font-bold mb-6">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8">
        {videos.map((video) => (
          <VideoCard key={video.id} video={video} organization={organization} />
        ))}
      </div>
    </section>
  );
}

// =============================================================================
// Async Video Sections Component (with streaming)
// =============================================================================

interface VideoSectionsProps {
  organizationId: string;
  organizationSlug: string;
}

async function VideoSections({ organizationId, organizationSlug }: VideoSectionsProps) {
  // Fetch videos using cached Effect query
  const result = await getCachedVideos(organizationId);
  const videos = result.data;

  return (
    <div className="space-y-12">
      <VideoSection title="Continue watching" videos={videos.slice(0, 2)} organization={organizationSlug} />
      <VideoSection title="New this week" videos={videos} organization={organizationSlug} />
      <VideoSection title="From your channels" videos={videos.slice(1, 4)} organization={organizationSlug} />
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
  let organization;
  try {
    organization = await getCachedOrganizationBySlug(organizationSlug);
  } catch {
    notFound();
  }

  // Render with Suspense for streaming
  return (
    <Suspense
      fallback={
        <div className="space-y-12">
          <VideoSectionSkeleton />
          <VideoSectionSkeleton />
          <VideoSectionSkeleton />
        </div>
      }
    >
      <VideoSections organizationId={organization.id} organizationSlug={organizationSlug} />
    </Suspense>
  );
}
