import { eq } from "drizzle-orm";
import type React from "react";
import { MobileSidebar } from "@/components/dashboard/mobile-sidebar";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { TopNav } from "@/components/top-nav";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";

export default async function MainLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organization: string }>;
}) {
  const { organization } = await params;

  // Get organization ID for search functionality
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, organization),
  });

  return (
    <div className="flex flex-col min-h-screen">
      <TopNav organization={organization} organizationId={org?.id}>
        <MobileSidebar organization={organization} />
      </TopNav>
      <div className="flex-1 flex">
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
