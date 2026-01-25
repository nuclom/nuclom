import { auth } from '@nuclom/lib/auth';
import type { Organization } from '@nuclom/lib/db/schema';
import { getOrganizationBySlug } from '@nuclom/lib/effect/server';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { KnowledgeQAContainer } from '@/components/knowledge-qa/knowledge-qa-container';

// =============================================================================
// Loading Skeleton
// =============================================================================

function AskPageSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-muted animate-pulse mx-auto" />
          <div className="h-6 w-48 bg-muted rounded animate-pulse mx-auto" />
          <div className="h-4 w-64 bg-muted rounded animate-pulse mx-auto" />
        </div>
      </div>
      <div className="border-t p-4">
        <div className="max-w-4xl mx-auto">
          <div className="h-20 bg-muted rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Ask Loader
// =============================================================================

async function AskLoader({ params }: { params: Promise<{ organization: string }> }) {
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

  return <KnowledgeQAContainer organizationId={organization.id} className="h-[calc(100vh-4rem)]" />;
}

// =============================================================================
// Page
// =============================================================================

export default function AskPage({ params }: { params: Promise<{ organization: string }> }) {
  return (
    <Suspense fallback={<AskPageSkeleton />}>
      <AskLoader params={params} />
    </Suspense>
  );
}
