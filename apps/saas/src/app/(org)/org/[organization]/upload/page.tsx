import { auth } from '@nuclom/lib/auth';
import { db } from '@nuclom/lib/db';
import { organizations } from '@nuclom/lib/db/schema';
import { Button } from '@nuclom/ui/button';
import { Skeleton } from '@nuclom/ui/skeleton';
import { Link } from '@vercel/microfrontends/next/client';
import { eq } from 'drizzle-orm';
import { ArrowLeft, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { UploadHub } from '@/components/upload-hub';

export const metadata: Metadata = {
  title: 'Upload Video',
  description: 'Upload videos to your organization from multiple sources',
};

function UploadSkeleton() {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto space-y-8">
          <Skeleton className="h-8 w-32" />
          <div className="text-center space-y-3">
            <Skeleton className="h-10 w-64 mx-auto" />
            <Skeleton className="h-5 w-96 mx-auto" />
          </div>
          <Skeleton className="h-64 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

async function UploadContent({ params }: { params: Promise<{ organization: string }> }) {
  const { organization: organizationSlug } = await params;
  // Get user from session
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/login');
  }

  // Get organization by slug
  const organization = await db.select().from(organizations).where(eq(organizations.slug, organizationSlug)).limit(1);

  if (!organization.length) {
    redirect('/');
  }

  const authorId = session.user.id;
  const organizationId = organization[0].id;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-muted/30 to-background">
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" asChild className="gap-2 text-muted-foreground hover:text-foreground">
              <Link href={`/org/${organizationSlug}`}>
                <ArrowLeft className="h-4 w-4" />
                Back to Videos
              </Link>
            </Button>
          </div>

          {/* Title Section */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-2">
              <Sparkles className="h-4 w-4" />
              AI-Powered Processing
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Upload Your Videos</h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Upload from your computer, import from URLs, or connect to Google Drive, Zoom, and Google Meet. Your
              videos will be automatically transcribed and enhanced with AI.
            </p>
          </div>

          {/* Upload Hub */}
          <UploadHub
            organizationId={organizationId}
            organizationSlug={organizationSlug}
            authorId={authorId}
            redirectPath={`/org/${organizationSlug}/videos`}
          />

          {/* Features Footer */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
            <FeatureCard icon="🎯" title="Auto Transcription" description="AI-powered transcripts in 90+ languages" />
            <FeatureCard icon="✨" title="Smart Summaries" description="Automatic video summaries and chapters" />
            <FeatureCard icon="🔒" title="Secure Storage" description="Enterprise-grade security and privacy" />
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 border border-transparent hover:border-muted-foreground/10 transition-colors">
      <span className="text-2xl">{icon}</span>
      <div>
        <h3 className="font-medium text-sm">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export default function UploadPage({ params }: { params: Promise<{ organization: string }> }) {
  return (
    <Suspense fallback={<UploadSkeleton />}>
      <UploadContent params={params} />
    </Suspense>
  );
}
