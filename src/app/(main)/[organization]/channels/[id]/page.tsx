import { Users, VideoOff } from 'lucide-react';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { VideoPreviewCard } from '@/components/video-preview-card';
import { auth } from '@/lib/auth';
import { getCachedChannel, getCachedChannelVideos, getCachedOrganizationBySlug } from '@/lib/effect';

// =============================================================================
// Loading Skeleton Component
// =============================================================================

function ChannelSkeleton() {
  return (
    <div className="space-y-8">
      <header className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div>
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-24 mt-2" />
        </div>
      </header>
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

function EmptyState({ channelName }: { channelName: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-6 mb-4">
        <VideoOff className="h-12 w-12 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold mb-2">No videos in this channel</h2>
      <p className="text-muted-foreground max-w-sm">Videos added to &quot;{channelName}&quot; will appear here.</p>
    </div>
  );
}

// =============================================================================
// Channel Content Component (Server Component)
// =============================================================================

interface ChannelContentProps {
  channelId: string;
  organizationSlug: string;
}

async function ChannelContent({ channelId, organizationSlug }: ChannelContentProps) {
  const [channel, videosResult] = await Promise.all([getCachedChannel(channelId), getCachedChannelVideos(channelId)]);

  const videos = videosResult.data;

  return (
    <div className="space-y-8">
      <header className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <div className="flex h-full w-full items-center justify-center rounded-full bg-purple-500 text-2xl font-bold text-white">
            {channel.name.charAt(0).toUpperCase()}
          </div>
        </Avatar>
        <div>
          <h1 className="text-4xl font-bold">{channel.name}</h1>
          <div className="flex items-center gap-1 text-muted-foreground mt-1">
            <Users className="h-4 w-4" />
            <span>
              {channel.memberCount} {channel.memberCount === 1 ? 'member' : 'members'}
            </span>
          </div>
          {channel.description && <p className="text-muted-foreground mt-2 max-w-2xl">{channel.description}</p>}
        </div>
      </header>

      {videos.length === 0 ? (
        <EmptyState channelName={channel.name} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8">
          {videos.map((video) => (
            <VideoPreviewCard key={video.id} video={video} organization={organizationSlug} />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Channel Loader Component
// =============================================================================

async function ChannelLoader({ channelId, organizationSlug }: { channelId: string; organizationSlug: string }) {
  // Authenticate user
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/login');
  }

  // Verify organization exists (for access control)
  try {
    await getCachedOrganizationBySlug(organizationSlug);
  } catch {
    notFound();
  }

  return <ChannelContent channelId={channelId} organizationSlug={organizationSlug} />;
}

// =============================================================================
// Main Page Component
// =============================================================================

export default async function ChannelPage({ params }: { params: Promise<{ organization: string; id: string }> }) {
  const { organization: organizationSlug, id: channelId } = await params;

  return (
    <Suspense fallback={<ChannelSkeleton />}>
      <ChannelLoader channelId={channelId} organizationSlug={organizationSlug} />
    </Suspense>
  );
}
