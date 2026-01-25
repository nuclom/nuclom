import { getAppUrl } from '@nuclom/lib/env/server';
import { createLogger } from '@nuclom/lib/logger';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { AcceptInvitationForm } from '@/components/auth/accept-invitation-form';

const log = createLogger('accept-invitation');

async function getInvitation(id: string) {
  try {
    // Use absolute URL for server-side fetch
    const response = await fetch(`${getAppUrl()}/api/invitations/${id}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    log.error('Failed to fetch invitation', error instanceof Error ? error : undefined, { invitationId: id });
    return null;
  }
}

function AcceptInvitationSkeleton() {
  return (
    <div className="w-full max-w-md space-y-4">
      <div className="h-8 w-48 bg-muted animate-pulse rounded" />
      <div className="h-4 w-64 bg-muted animate-pulse rounded" />
      <div className="h-10 w-full bg-muted animate-pulse rounded" />
    </div>
  );
}

async function AcceptInvitationContent({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const invitation = await getInvitation(id);

  return (
    <div className="w-full max-w-md">
      <AcceptInvitationForm invitation={invitation} />
    </div>
  );
}

interface AcceptInvitationPageProps {
  params: Promise<{ id: string }>;
}

export default function AcceptInvitationPage({ params }: AcceptInvitationPageProps) {
  return (
    <Suspense fallback={<AcceptInvitationSkeleton />}>
      <AcceptInvitationContent params={params} />
    </Suspense>
  );
}
