import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { LandingPage } from '@/components/marketing/landing-page';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { organizations } from '@/lib/db/schema';
import { getActiveOrganization } from '@/lib/organization';

async function HomeLoader() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return <LandingPage />;
  }

  const activeOrganizationId = session.session?.activeOrganizationId;
  let organization = null;

  if (activeOrganizationId) {
    organization = await db.query.organizations.findFirst({
      where: eq(organizations.id, activeOrganizationId),
    });
  }

  if (!organization) {
    organization = await getActiveOrganization(session.user.id);
  }

  if (!organization) {
    redirect('/onboarding');
  }

  redirect(`/${organization.slug}`);
}

export default function Home() {
  return (
    <Suspense fallback={<LandingPage />}>
      <HomeLoader />
    </Suspense>
  );
}
