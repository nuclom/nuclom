import { auth } from '@nuclom/lib/auth';
import type { Organization } from '@nuclom/lib/db/schema';
import { getOrganizationBySlug } from '@nuclom/lib/effect/server';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { GapsDashboard } from '@/components/gaps/gaps-dashboard';

// =============================================================================
// Loading Skeleton
// =============================================================================

function GapsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="h-4 w-96 bg-muted rounded animate-pulse mt-2" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="h-96 bg-muted rounded-lg animate-pulse" />
    </div>
  );
}

// =============================================================================
// Gaps Loader
// =============================================================================

async function GapsLoader({ params }: { params: Promise<{ organization: string }> }) {
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
    organization = await getOrganizationBySlug(organizationSlug);
  } catch {
    notFound();
  }

  return <GapsDashboard organizationId={organization.id} />;
}

// =============================================================================
// Page
// =============================================================================

export default function GapsPage({ params }: { params: Promise<{ organization: string }> }) {
  return (
    <Suspense fallback={<GapsPageSkeleton />}>
      <GapsLoader params={params} />
    </Suspense>
  );
}
