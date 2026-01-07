import { Folders, Plus, Video } from 'lucide-react';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { auth } from '@/lib/auth';
import type { Organization } from '@/lib/db/schema';
import { getCachedChannels, getCachedOrganizationBySlug } from '@/lib/effect';

// =============================================================================
// Loading Skeleton Component
// =============================================================================

function ChannelsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={`skeleton-${i}`} className="space-y-3">
            <Skeleton className="h-40 rounded-lg" />
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
        <Folders className="h-12 w-12 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold mb-2">No channels yet</h2>
      <p className="text-muted-foreground max-w-sm mb-6">
        Channels help you organize videos by topic, team, or project. Create your first channel to get started.
      </p>
      <Button className="flex items-center gap-2">
        <Plus className="h-4 w-4" />
        Create Channel
      </Button>
    </div>
  );
}

// =============================================================================
// Channel Card Component
// =============================================================================

interface ChannelCardProps {
  channel: {
    id: string;
    name: string;
    description: string | null;
    videoCount: number;
    memberCount: number;
  };
  organizationSlug: string;
}

function ChannelCard({ channel, organizationSlug }: ChannelCardProps) {
  return (
    <Link href={`/${organizationSlug}/channels/${channel.id}`}>
      <Card className="h-full transition-all hover:shadow-md hover:border-primary/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <div className="flex h-full w-full items-center justify-center rounded-full bg-purple-500 text-lg font-bold text-white">
                {channel.name.charAt(0).toUpperCase()}
              </div>
            </Avatar>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg truncate">{channel.name}</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {channel.description && (
            <CardDescription className="line-clamp-2 mb-3">{channel.description}</CardDescription>
          )}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Video className="h-4 w-4" />
              <span>
                {channel.videoCount} {channel.videoCount === 1 ? 'video' : 'videos'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// =============================================================================
// Channels Content Component (Server Component)
// =============================================================================

interface ChannelsContentProps {
  organizationId: string;
  organizationSlug: string;
}

async function ChannelsContent({ organizationId, organizationSlug }: ChannelsContentProps) {
  const result = await getCachedChannels(organizationId);
  const channels = result.data;

  if (channels.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {channels.map((channel) => (
        <ChannelCard key={channel.id} channel={channel} organizationSlug={organizationSlug} />
      ))}
    </div>
  );
}

// =============================================================================
// Channels Loader Component
// =============================================================================

async function ChannelsLoader({ params }: { params: Promise<{ organization: string }> }) {
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
        <h1 className="text-3xl font-bold">Channels</h1>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Channel
        </Button>
      </div>

      <ChannelsContent organizationId={organization.id} organizationSlug={organizationSlug} />
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function ChannelsPage({ params }: { params: Promise<{ organization: string }> }) {
  return (
    <Suspense fallback={<ChannelsSkeleton />}>
      <ChannelsLoader params={params} />
    </Suspense>
  );
}
