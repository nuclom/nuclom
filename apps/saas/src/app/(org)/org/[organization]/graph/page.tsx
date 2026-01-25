import { auth } from '@nuclom/lib/auth';
import type { Organization } from '@nuclom/lib/db/schema';
import { getOrganizationBySlug } from '@nuclom/lib/effect/server';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { KnowledgeExplorer } from '@/components/knowledge/knowledge-explorer';

// =============================================================================
// Loading Skeleton
// =============================================================================

function GraphPageSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="h-4 w-96 bg-muted rounded animate-pulse mt-2" />
      </div>
      <div className="h-[600px] bg-muted rounded-lg animate-pulse" />
    </div>
  );
}

// =============================================================================
// Graph Loader
// =============================================================================

async function GraphLoader({ params }: { params: Promise<{ organization: string }> }) {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Knowledge Graph</h1>
        <p className="text-muted-foreground">Explore connections between topics, decisions, and content</p>
      </div>
      <KnowledgeExplorer organizationId={organization.id} className="h-[600px]" />
    </div>
  );
}

// =============================================================================
// Page
// =============================================================================

export default function GraphPage({ params }: { params: Promise<{ organization: string }> }) {
  return (
    <Suspense fallback={<GraphPageSkeleton />}>
      <GraphLoader params={params} />
    </Suspense>
  );
}
