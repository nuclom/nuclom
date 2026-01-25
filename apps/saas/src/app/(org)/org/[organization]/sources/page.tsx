'use client';

/**
 * Content Sources Page
 *
 * Manage content source integrations for knowledge import.
 */

import { Card, CardContent } from '@nuclom/ui/card';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { ContentSourcesManager } from '@/components/integrations/content-sources-manager';
import { useToast } from '@/hooks/use-toast';

function SourcesPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const organizationSlug = params.organization as string;

  // Handle OAuth callback success/error
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success === 'slack') {
      toast({
        title: 'Slack Connected',
        description: 'Your Slack workspace has been connected successfully.',
      });
    } else if (success === 'notion') {
      toast({
        title: 'Notion Connected',
        description: 'Your Notion workspace has been connected successfully.',
      });
    } else if (success === 'github') {
      toast({
        title: 'GitHub Connected',
        description: 'Your GitHub account has been connected successfully.',
      });
    } else if (error) {
      const errorMessages: Record<string, string> = {
        slack_oauth_failed: 'Failed to connect Slack. Please try again.',
        slack_state_mismatch: 'Security validation failed. Please try again.',
        slack_callback_failed: 'Failed to complete Slack connection.',
        notion_oauth_failed: 'Failed to connect Notion. Please try again.',
        notion_state_mismatch: 'Security validation failed. Please try again.',
        notion_callback_failed: 'Failed to complete Notion connection.',
        github_oauth_failed: 'Failed to connect GitHub. Please try again.',
        github_state_mismatch: 'Security validation failed. Please try again.',
        github_callback_failed: 'Failed to complete GitHub connection.',
      };

      toast({
        title: 'Connection Failed',
        description: errorMessages[error] || 'An error occurred. Please try again.',
        variant: 'destructive',
      });
    }
  }, [searchParams, toast]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Content Sources</h1>
        <p className="text-muted-foreground">
          Connect and manage your knowledge sources. Content from these sources will appear in your feed and search.
        </p>
      </div>
      <ContentSourcesManager organizationId={organizationSlug} />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-48 bg-muted rounded animate-pulse" />
          <div className="h-4 w-96 bg-muted rounded animate-pulse mt-2" />
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="py-8">
              <div className="h-24 bg-muted rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function SourcesPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <SourcesPageContent />
    </Suspense>
  );
}
