import { Camera, MonitorUp } from 'lucide-react';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { auth } from '@/lib/auth';
import type { Organization } from '@/lib/db/schema';
import { getCachedOrganizationBySlug } from '@/lib/effect';

// =============================================================================
// Loading Skeleton Component
// =============================================================================

function RecordSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-9 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    </div>
  );
}

// =============================================================================
// Record Content Component
// =============================================================================

function RecordContent({ organizationSlug }: { organizationSlug: string }) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Record a Video</h1>
        <p className="text-muted-foreground mt-2">Create a new video by recording your screen, camera, or both.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
        <Card className="transition-all hover:shadow-md hover:border-primary/50">
          <CardHeader>
            <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-2">
              <MonitorUp className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Screen Recording</CardTitle>
            <CardDescription>Record your screen with optional camera overlay and microphone audio.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Perfect for tutorials, demos, and presentations.</p>
            <Button className="w-full" disabled>
              Coming Soon
            </Button>
          </CardContent>
        </Card>

        <Card className="transition-all hover:shadow-md hover:border-primary/50">
          <CardHeader>
            <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-2">
              <Camera className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Camera Recording</CardTitle>
            <CardDescription>Record directly from your webcam for video messages and updates.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Great for quick updates, feedback, and announcements.</p>
            <Button className="w-full" disabled>
              Coming Soon
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="max-w-3xl">
        <p className="text-sm text-muted-foreground">
          In the meantime, you can{' '}
          <Link href={`/${organizationSlug}/upload`} className="text-primary hover:underline">
            upload existing videos
          </Link>{' '}
          to your library.
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// Record Loader Component
// =============================================================================

async function RecordLoader({ params }: { params: Promise<{ organization: string }> }) {
  const { organization: organizationSlug } = await params;

  // Authenticate user
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/login');
  }

  // Get organization by slug using cached Effect query
  let _organization: Organization;
  try {
    _organization = await getCachedOrganizationBySlug(organizationSlug);
  } catch {
    notFound();
  }

  return <RecordContent organizationSlug={organizationSlug} />;
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function RecordPage({ params }: { params: Promise<{ organization: string }> }) {
  return (
    <Suspense fallback={<RecordSkeleton />}>
      <RecordLoader params={params} />
    </Suspense>
  );
}
