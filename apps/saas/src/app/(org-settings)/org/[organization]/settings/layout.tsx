import { auth } from '@nuclom/lib/auth';
import { db } from '@nuclom/lib/db';
import { organizations } from '@nuclom/lib/db/schema';
import { Skeleton } from '@nuclom/ui/skeleton';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import type React from 'react';
import { Suspense } from 'react';
import { OrgSettingsSidebar } from '@/components/org-settings-sidebar';
import { OrgSettingsTopNav } from '@/components/org-settings-top-nav';

function NavSkeleton() {
  return (
    <div className="h-14 border-b bg-background flex items-center px-4">
      <Skeleton className="h-8 w-32" />
    </div>
  );
}

async function LayoutContent({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organization: string }>;
}) {
  await connection();
  const { organization } = await params;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/login');
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, organization),
  });

  if (!org) {
    redirect('/');
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <OrgSettingsTopNav user={session.user} organization={organization} organizationName={org.name} />
      <div className="flex-1 flex min-h-0">
        <div className="hidden md:block">
          <OrgSettingsSidebar organization={organization} />
        </div>
        <main className="flex-1 overflow-auto">
          <div className="w-full max-w-screen-xl p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default function OrgSettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organization: string }>;
}) {
  return (
    <Suspense fallback={<NavSkeleton />}>
      <LayoutContent params={params}>{children}</LayoutContent>
    </Suspense>
  );
}
