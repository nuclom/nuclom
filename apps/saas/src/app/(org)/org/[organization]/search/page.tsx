import { auth } from '@nuclom/lib/auth';
import { and, eq } from 'drizzle-orm';
import { Loader2 } from 'lucide-react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { SearchPageContent } from '@/components/search';
import { db } from '@/lib/db';
import { collections, members, organizations, users, videos } from '@/lib/db/schema';

interface SearchPageProps {
  params: Promise<{ organization: string }>;
  searchParams: Promise<{ q?: string }>;
}

function SearchSkeleton() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

async function SearchLoader({
  params,
  searchParams,
}: {
  params: Promise<{ organization: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { organization: organizationSlug } = await params;
  const { q: query } = await searchParams;
  const headersList = await headers();

  // Get current session
  const session = await auth.api.getSession({
    headers: headersList,
  });

  if (!session?.user) {
    redirect('/login');
  }

  // Get organization
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, organizationSlug),
  });

  if (!org) {
    redirect('/');
  }

  // Verify user is a member of the organization
  const membership = await db.query.members.findFirst({
    where: and(eq(members.organizationId, org.id), eq(members.userId, session.user.id)),
  });

  if (!membership) {
    redirect('/');
  }

  // Fetch filter options in parallel
  const [orgCollections, orgAuthors] = await Promise.all([
    // Get collections for this organization
    db
      .select()
      .from(collections)
      .where(eq(collections.organizationId, org.id)),

    // Get unique authors (users who have videos in this organization)
    db
      .selectDistinct({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        emailVerified: users.emailVerified,
        role: users.role,
        banned: users.banned,
        banReason: users.banReason,
        banExpires: users.banExpires,
        twoFactorEnabled: users.twoFactorEnabled,
        stripeCustomerId: users.stripeCustomerId,
        lastLoginMethod: users.lastLoginMethod,
      })
      .from(users)
      .innerJoin(videos, eq(videos.authorId, users.id))
      .where(eq(videos.organizationId, org.id)),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">
          {query ? (
            <>
              Search results for <span className="text-primary">"{query}"</span>
            </>
          ) : (
            'Search'
          )}
        </h1>
        <p className="text-muted-foreground mt-1">Search across videos, transcripts, and AI summaries</p>
      </div>

      <SearchPageContent
        organizationId={org.id}
        organization={organizationSlug}
        authors={orgAuthors}
        collections={orgCollections}
      />
    </div>
  );
}

export default function SearchPage({ params, searchParams }: SearchPageProps) {
  return (
    <Suspense fallback={<SearchSkeleton />}>
      <SearchLoader params={params} searchParams={searchParams} />
    </Suspense>
  );
}
