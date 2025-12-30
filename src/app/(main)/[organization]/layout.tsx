import type React from "react";
import { eq } from "drizzle-orm";
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
      <TopNav organization={organization} organizationId={org?.id} />
      <main className="flex-1 flex flex-col">
        <div className="flex-1 w-full max-w-screen-2xl mx-auto p-4 md:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
