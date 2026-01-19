import { auth } from '@nuclom/lib/auth';
import { Link } from '@vercel/microfrontends/next/client';
import { Folders, ListVideo, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Organization } from '@/lib/db/schema';
import { getCachedCollections, getCachedOrganizationBySlug } from '@/lib/effect';

export const metadata: Metadata = {
  title: 'Collections',
  description: 'Organize your videos into folders and playlists',
};

// =============================================================================
// Loading Skeleton Component
// =============================================================================

function CollectionsSkeleton() {
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
      <h2 className="text-xl font-semibold mb-2">No collections yet</h2>
      <p className="text-muted-foreground max-w-sm mb-6">
        Collections help you organize videos into folders or playlists. Create your first collection to get started.
      </p>
      <Button className="flex items-center gap-2">
        <Plus className="h-4 w-4" />
        Create Collection
      </Button>
    </div>
  );
}

// =============================================================================
// Collection Card Component
// =============================================================================

interface CollectionCardProps {
  collection: {
    id: string;
    name: string;
    description: string | null;
    type: 'folder' | 'playlist';
    videoCount: number;
    thumbnailUrl: string | null;
  };
  organizationSlug: string;
}

function CollectionCard({ collection, organizationSlug }: CollectionCardProps) {
  const isPlaylist = collection.type === 'playlist';
  const Icon = isPlaylist ? ListVideo : Folders;
  const iconColor = isPlaylist ? 'bg-blue-500' : 'bg-purple-500';

  return (
    <Link href={`/org/${organizationSlug}/collections/${collection.id}`}>
      <Card className="h-full transition-all hover:shadow-md hover:border-primary/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg ${iconColor} flex items-center justify-center`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg truncate">{collection.name}</CardTitle>
                <Badge variant={isPlaylist ? 'default' : 'secondary'} className="text-xs">
                  {isPlaylist ? 'Playlist' : 'Folder'}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {collection.description && (
            <CardDescription className="line-clamp-2 mb-3">{collection.description}</CardDescription>
          )}
          <div className="text-sm text-muted-foreground">
            {collection.videoCount} {collection.videoCount === 1 ? 'video' : 'videos'}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// =============================================================================
// Collections Content Component (Server Component)
// =============================================================================

interface CollectionsContentProps {
  organizationId: string;
  organizationSlug: string;
}

async function CollectionsContent({ organizationId, organizationSlug }: CollectionsContentProps) {
  const result = await getCachedCollections(organizationId);
  const collections = result.data;

  if (collections.length === 0) {
    return <EmptyState />;
  }

  // Separate folders and playlists
  const folders = collections.filter((c) => c.type === 'folder');
  const playlists = collections.filter((c) => c.type === 'playlist');

  return (
    <div className="space-y-10">
      {folders.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Folders className="h-5 w-5" />
            Folders
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {folders.map((collection) => (
              <CollectionCard key={collection.id} collection={collection} organizationSlug={organizationSlug} />
            ))}
          </div>
        </section>
      )}

      {playlists.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <ListVideo className="h-5 w-5" />
            Playlists
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {playlists.map((collection) => (
              <CollectionCard key={collection.id} collection={collection} organizationSlug={organizationSlug} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// =============================================================================
// Collections Loader Component
// =============================================================================

async function CollectionsLoader({ params }: { params: Promise<{ organization: string }> }) {
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
        <h1 className="text-3xl font-bold">Collections</h1>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Collection
        </Button>
      </div>

      <CollectionsContent organizationId={organization.id} organizationSlug={organizationSlug} />
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function CollectionsPage({ params }: { params: Promise<{ organization: string }> }) {
  return (
    <Suspense fallback={<CollectionsSkeleton />}>
      <CollectionsLoader params={params} />
    </Suspense>
  );
}
