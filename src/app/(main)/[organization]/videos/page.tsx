import { Upload, VideoOff } from 'lucide-react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { VideoPreviewCard } from '@/components/video-preview-card';
import { auth } from '@/lib/auth';
import type { Organization } from '@/lib/db/schema';
import { getCachedOrganizationBySlug, getCachedVideos } from '@/lib/effect';

export const metadata: Metadata = {
  title: 'Videos',
  description: 'View and manage all videos in your organization',
};

// =============================================================================
// Loading Skeleton Component
// =============================================================================

function VideosSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8">
        {Array.from({ length: 8 }).map((_, i) => (
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

// =============================================================================
// Empty State Component
// =============================================================================

function EmptyState({ organizationSlug }: { organizationSlug: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-6 mb-4">
        <VideoOff className="h-12 w-12 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold mb-2">No videos yet</h2>
      <p className="text-muted-foreground max-w-sm mb-6">
        Upload your first video to start building your library and sharing with your team.
      </p>
      <Link href={`/${organizationSlug}/upload`}>
        <Button className="flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Upload Your First Video
        </Button>
      </Link>
    </div>
  );
}

// =============================================================================
// Videos Content Component (Server Component)
// =============================================================================

interface VideosContentProps {
  organizationId: string;
  organizationSlug: string;
}

async function VideosContent({ organizationId, organizationSlug }: VideosContentProps) {
  const result = await getCachedVideos(organizationId);
  const videos = result.data;

  if (videos.length === 0) {
    return <EmptyState organizationSlug={organizationSlug} />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8">
      {videos.map((video) => (
        <VideoPreviewCard key={video.id} video={video} organization={organizationSlug} />
      ))}
    </div>
  );
}

// =============================================================================
// Videos Loader Component
// =============================================================================

async function VideosLoader({ params }: { params: Promise<{ organization: string }> }) {
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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">All Videos</h1>
        <Link href={`/${organizationSlug}/upload`}>
          <Button className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload Video
          </Button>
        </Link>
      </div>

      <VideosContent organizationId={organization.id} organizationSlug={organizationSlug} />
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function VideosPage({ params }: { params: Promise<{ organization: string }> }) {
  return (
    <Suspense fallback={<VideosSkeleton />}>
      <VideosLoader params={params} />
    </Suspense>
  );
}
