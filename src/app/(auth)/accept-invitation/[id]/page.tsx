import { Suspense } from "react";
import { AcceptInvitationForm } from "@/components/auth/accept-invitation-form";
import { env } from "@/lib/env/server";

async function getInvitation(id: string) {
  try {
    // Use absolute URL for server-side fetch
    const response = await fetch(`${env.APP_URL}/api/invitations/${id}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.error("Error fetching invitation:", error);
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

async function AcceptInvitationContent({ id }: { id: string }) {
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

export default async function AcceptInvitationPage({ params }: AcceptInvitationPageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={<AcceptInvitationSkeleton />}>
      <AcceptInvitationContent id={id} />
    </Suspense>
  );
}
