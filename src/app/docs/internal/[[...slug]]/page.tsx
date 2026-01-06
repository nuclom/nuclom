import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/page';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { DocsMarkdown } from '@/components/docs/docs-markdown';
import { getAllDocsPaths, getDocsContent } from '@/lib/docs/markdown';

interface PageProps {
  params: Promise<{
    slug?: string[];
  }>;
}

export async function generateStaticParams() {
  // Generate internal doc paths only
  const allPaths = getAllDocsPaths();
  const internalPaths = allPaths
    .filter((path) => path[0] === 'internal')
    .map((path) => ({
      slug: path.slice(1).length === 0 ? undefined : path.slice(1),
    }));

  return internalPaths;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug = [] } = await params;
  const fullSlug = ['internal', ...slug];
  const content = await getDocsContent(fullSlug);

  if (!content) {
    return {
      title: 'Not Found',
    };
  }

  return {
    title: `${content.title} | Internal Docs`,
    description: content.description,
  };
}

function DocsContentSkeleton() {
  return (
    <DocsPage>
      <div className="h-8 w-64 bg-muted animate-pulse rounded mb-4" />
      <div className="h-4 w-96 bg-muted animate-pulse rounded mb-8" />
      <div className="space-y-3">
        <div className="h-4 w-full bg-muted animate-pulse rounded" />
        <div className="h-4 w-full bg-muted animate-pulse rounded" />
        <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
      </div>
    </DocsPage>
  );
}

async function InternalDocsContent({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params;
  const fullSlug = ['internal', ...slug];
  const content = await getDocsContent(fullSlug);

  if (!content) {
    notFound();
  }

  return (
    <DocsPage>
      <DocsTitle>{content.title}</DocsTitle>
      {content.description && <DocsDescription>{content.description}</DocsDescription>}
      <DocsBody>
        <DocsMarkdown content={content.content} />
      </DocsBody>
    </DocsPage>
  );
}

export default function InternalDocsPage({ params }: PageProps) {
  return (
    <Suspense fallback={<DocsContentSkeleton />}>
      <InternalDocsContent params={params} />
    </Suspense>
  );
}
