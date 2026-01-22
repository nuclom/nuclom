import { db } from '@nuclom/lib/db';
import { organizations } from '@nuclom/lib/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { AnalyticsContent, AnalyticsSkeleton } from './analytics-content';

interface PageProps {
  params: Promise<{ organization: string }>;
  searchParams: Promise<{ period?: string }>;
}

export default async function AnalyticsPage({ params, searchParams }: PageProps) {
  const [{ organization: slug }, { period = '30d' }] = await Promise.all([params, searchParams]);

  // Fetch organization server-side - eliminates client-side waterfall
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, slug),
    columns: { id: true, name: true, slug: true },
  });

  if (!org) {
    notFound();
  }

  return (
    <Suspense fallback={<AnalyticsSkeleton />}>
      <AnalyticsContent organization={org} initialPeriod={period} />
    </Suspense>
  );
}
