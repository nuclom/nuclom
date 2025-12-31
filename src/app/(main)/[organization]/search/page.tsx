import { and, eq } from "drizzle-orm";
import { Loader2 } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SearchPageContent } from "@/components/search";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { channels, collections, members, organizations, users, videos } from "@/lib/db/schema";

interface SearchPageProps {
  params: Promise<{ organization: string }>;
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const { organization: organizationSlug } = await params;
  const { q } = await searchParams;
  const headersList = await headers();

  // Get current session
  const session = await auth.api.getSession({
    headers: headersList,
  });

  if (!session?.user) {
    redirect("/login");
  }

  // Get organization
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, organizationSlug),
  });

  if (!org) {
    redirect("/");
  }

  // Verify user is a member of the organization
  const membership = await db.query.members.findFirst({
    where: and(eq(members.organizationId, org.id), eq(members.userId, session.user.id)),
  });

  if (!membership) {
    redirect("/");
  }

  // Fetch filter options in parallel
  const [orgChannels, orgCollections, orgAuthors] = await Promise.all([
    // Get channels for this organization
    db
      .select()
      .from(channels)
      .where(eq(channels.organizationId, org.id)),

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
        tosAcceptedAt: users.tosAcceptedAt,
        tosVersion: users.tosVersion,
        privacyAcceptedAt: users.privacyAcceptedAt,
        privacyVersion: users.privacyVersion,
        marketingConsentAt: users.marketingConsentAt,
        marketingConsent: users.marketingConsent,
        deletionRequestedAt: users.deletionRequestedAt,
        deletionScheduledFor: users.deletionScheduledFor,
        warnedAt: users.warnedAt,
        warningReason: users.warningReason,
        suspendedUntil: users.suspendedUntil,
        suspensionReason: users.suspensionReason,
      })
      .from(users)
      .innerJoin(videos, eq(videos.authorId, users.id))
      .where(eq(videos.organizationId, org.id)),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">
          {q ? (
            <>
              Search results for <span className="text-primary">"{q}"</span>
            </>
          ) : (
            "Search"
          )}
        </h1>
        <p className="text-muted-foreground mt-1">Search across videos, transcripts, and AI summaries</p>
      </div>

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <SearchPageContent
          organizationId={org.id}
          organization={organizationSlug}
          authors={orgAuthors}
          channels={orgChannels}
          collections={orgCollections}
        />
      </Suspense>
    </div>
  );
}
