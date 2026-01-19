import { auth } from '@nuclom/lib/auth';
import type { Organization } from '@nuclom/lib/db/schema';
import { getCachedOrganizationBySlug, getCachedVideosSharedByOthers } from '@nuclom/lib/effect';
import { Share2, VideoOff } from 'lucide-react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { VideoPreviewCard } from '@/components/video-preview-card';

export const metadata: Metadata = {
  title: 'Shared with Me',
  description: 'Videos shared with you by team members',
};

// =============================================================================
// Loading Skeleton Component
// =============================================================================

function SharedVideosSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-48" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8">
        {Array.from({ length: 4 }).map((_, i) => (
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

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-6 mb-4">
        <VideoOff className="h-12 w-12 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold mb-2">No shared videos</h2>
      <p className="text-muted-foreground max-w-sm">Videos created by other team members will appear here.</p>
    </div>
  );
}

// =============================================================================
// Shared Videos Content Component (Server Component)
// =============================================================================

interface SharedVideosContentProps {
  userId: string;
  organizationId: string;
  organizationSlug: string;
}

async function SharedVideosContent({ userId, organizationId, organizationSlug }: SharedVideosContentProps) {
  const result = await getCachedVideosSharedByOthers(userId, organizationId);
  const videos = result.data;

  if (videos.length === 0) {
    return <EmptyState />;
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
// Shared Videos Loader Component
// =============================================================================

async function SharedVideosLoader({ params }: { params: Promise<{ organization: string }> }) {
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
      <div className="flex items-center gap-3">
        <Share2 className="h-8 w-8 text-muted-foreground" />
        <h1 className="text-3xl font-bold">Shared with me</h1>
      </div>

      <SharedVideosContent
        userId={session.user.id}
        organizationId={organization.id}
        organizationSlug={organizationSlug}
      />
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function SharedVideosPage({ params }: { params: Promise<{ organization: string }> }) {
  return (
    <Suspense fallback={<SharedVideosSkeleton />}>
      <SharedVideosLoader params={params} />
    </Suspense>
  );
}
