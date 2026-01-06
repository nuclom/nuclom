import { eq } from 'drizzle-orm';
import type React from 'react';
import { Suspense } from 'react';
import { MobileSidebar } from '@/components/dashboard/mobile-sidebar';
import { SidebarNav } from '@/components/dashboard/sidebar-nav';
import { TopNav } from '@/components/top-nav';
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/db';
import { organizations } from '@/lib/db/schema';

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ organization: string }>;
}

function NavSkeleton() {
  return (
    <div className="h-14 border-b bg-background flex items-center px-4">
      <Skeleton className="h-8 w-32" />
    </div>
  );
}

async function LayoutContent({ children, params }: LayoutProps) {
  const { organization } = await params;

  // Get organization ID for search functionality
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, organization),
  });

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopNav organization={organization} organizationId={org?.id}>
        <MobileSidebar organization={organization} />
      </TopNav>
      <div className="flex-1 flex min-h-0">
        {/* Desktop sidebar - hidden on mobile */}
        <div className="hidden md:block">
          <SidebarNav organization={organization} />
        </div>
        <main className="flex-1 overflow-auto">
          <div className="w-full max-w-screen-xl p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default function MainLayout({ children, params }: LayoutProps) {
  return (
    <Suspense fallback={<NavSkeleton />}>
      <LayoutContent params={params}>{children}</LayoutContent>
    </Suspense>
  );
}
