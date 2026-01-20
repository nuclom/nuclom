import { auth } from '@nuclom/lib/auth';
import type { Organization } from '@nuclom/lib/db/schema';
import { getCachedOrganizationBySlug } from '@nuclom/lib/effect';
import { Loader2 } from 'lucide-react';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { TopicList } from '@/components/topics';

// =============================================================================
// Loading Skeleton
// =============================================================================

function TopicsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-32 bg-muted rounded animate-pulse" />
        <div className="h-4 w-64 bg-muted rounded animate-pulse mt-2" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="rounded-lg border bg-card p-6">
            <div className="h-24 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Topics Loader
// =============================================================================

async function TopicsLoader({ params }: { params: Promise<{ organization: string }> }) {
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
    <TopicList
      organizationId={organization.id}
      organizationSlug={organizationSlug}
    />
  );
}

// =============================================================================
// Page
// =============================================================================

export default function TopicsPage({ params }: { params: Promise<{ organization: string }> }) {
  return (
    <Suspense fallback={<TopicsPageSkeleton />}>
      <TopicsLoader params={params} />
    </Suspense>
  );
}
