import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { DocsBreadcrumb } from '@/components/docs/docs-breadcrumb';
import { DocsCopyButton } from '@/components/docs/docs-copy-button';
import { DocsMarkdown } from '@/components/docs/docs-markdown';
import { getAllDocsPaths, getDocsContent } from '@/lib/docs/markdown';

interface PageProps {
  params: Promise<{
    slug?: string[];
  }>;
}

export async function generateStaticParams() {
  // Only generate public docs paths - internal docs are handled by their own layout
  const paths = getAllDocsPaths();
  const publicPaths = paths.filter((path) => path[0] !== 'internal');
  return publicPaths.map((slug) => ({
    slug: slug.length === 0 ? undefined : slug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug = [] } = await params;
  const content = await getDocsContent(slug);

  if (!content) {
    return {
      title: 'Not Found',
    };
  }

  return {
    title: content.title,
    description: content.description,
  };
}

function DocsContentSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-4 w-32 bg-muted rounded mb-4" />
      <div className="h-10 w-80 bg-muted rounded mb-2" />
      <div className="h-5 w-96 bg-muted rounded mb-8" />
      <div className="space-y-3">
        <div className="h-4 w-full bg-muted rounded" />
        <div className="h-4 w-full bg-muted rounded" />
        <div className="h-4 w-3/4 bg-muted rounded" />
        <div className="h-4 w-5/6 bg-muted rounded" />
      </div>
    </div>
  );
}

async function DocsContent({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params;
  const content = await getDocsContent(slug);

  if (!content) {
    notFound();
  }

  return (
    <article className="max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <DocsBreadcrumb />
          <DocsCopyButton />
        </div>

        <h1 className="docs-title">{content.title}</h1>

        {content.description && <p className="docs-description">{content.description}</p>}
      </div>

      {/* Content */}
      <div className="docs-content" data-docs-content>
        <DocsMarkdown content={content.content} />
      </div>
    </article>
  );
}

export default function Page({ params }: PageProps) {
  return (
    <Suspense fallback={<DocsContentSkeleton />}>
      <DocsContent params={params} />
    </Suspense>
  );
}
