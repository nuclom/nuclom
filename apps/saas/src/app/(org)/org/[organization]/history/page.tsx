import { auth } from '@nuclom/lib/auth';
import type { Organization } from '@nuclom/lib/db/schema';
import { getCachedOrganizationBySlug } from '@nuclom/lib/effect';
import { History } from 'lucide-react';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// =============================================================================
// Loading Skeleton Component
// =============================================================================

function HistorySkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-9 w-40" />
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
        <History className="h-12 w-12 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold mb-2">No watch history</h2>
      <p className="text-muted-foreground max-w-sm">
        Videos you watch will appear here so you can easily find them again.
      </p>
    </div>
  );
}

// =============================================================================
// History Loader Component
// =============================================================================

async function HistoryLoader({ params }: { params: Promise<{ organization: string }> }) {
  const { organization: organizationSlug } = await params;

  // Authenticate user
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/login');
  }

  // Get organization by slug using cached Effect query
  let _organization: Organization;
  try {
    _organization = await getCachedOrganizationBySlug(organizationSlug);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <History className="h-8 w-8 text-muted-foreground" />
        <h1 className="text-3xl font-bold">Watch History</h1>
      </div>

      <EmptyState />
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function HistoryPage({ params }: { params: Promise<{ organization: string }> }) {
  return (
    <Suspense fallback={<HistorySkeleton />}>
      <HistoryLoader params={params} />
    </Suspense>
  );
}
