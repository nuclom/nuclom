import { auth } from '@nuclom/lib/auth';
import type { Organization } from '@nuclom/lib/db/schema';
import { getCachedOrganizationBySlug } from '@nuclom/lib/effect';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { DecisionDashboard } from '@/components/decisions';

// =============================================================================
// Loading Skeleton
// =============================================================================

function DecisionsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-32 bg-muted rounded animate-pulse" />
        <div className="h-4 w-64 bg-muted rounded animate-pulse mt-2" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-3">
            <div className="h-6 w-24 bg-muted rounded animate-pulse" />
            <div className="min-h-[200px] p-3 rounded-lg bg-muted/30">
              <div className="h-32 bg-muted rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Decisions Loader
// =============================================================================

async function DecisionsLoader({ params }: { params: Promise<{ organization: string }> }) {
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

  return (
    <DecisionDashboard
      organizationId={organization.id}
      organizationSlug={organizationSlug}
    />
  );
}

// =============================================================================
// Page
// =============================================================================

export default function DecisionsPage({ params }: { params: Promise<{ organization: string }> }) {
  return (
    <Suspense fallback={<DecisionsPageSkeleton />}>
      <DecisionsLoader params={params} />
    </Suspense>
  );
}
