import { auth } from '@nuclom/lib/auth';
import type { Organization } from '@nuclom/lib/db/schema';
import { getCachedOrganizationBySlug } from '@nuclom/lib/effect';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';

import { KnowledgeFeed } from '@/components/feed';

// =============================================================================
// Loading Skeleton
// =============================================================================

function FeedPageSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-40 bg-muted rounded animate-pulse" />
        <div className="h-4 w-64 bg-muted rounded animate-pulse mt-2" />
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 w-20 bg-muted rounded animate-pulse" />
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded-lg border bg-card p-4">
            <div className="h-20 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Feed Loader
// =============================================================================

async function FeedLoader({ params }: { params: Promise<{ organization: string }> }) {
  const { organization: organizationSlug } = await params;

  // Authenticate user
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/login');
  }

  // Get organization by slug
  let organization: Organization;
  try {
    organization = await getCachedOrganizationBySlug(organizationSlug);
  } catch {
    notFound();
  }

  return <KnowledgeFeed organizationId={organization.id} />;
}

// =============================================================================
// Page
// =============================================================================

export default function FeedPage({ params }: { params: Promise<{ organization: string }> }) {
  return (
    <Suspense fallback={<FeedPageSkeleton />}>
      <FeedLoader params={params} />
    </Suspense>
  );
}
