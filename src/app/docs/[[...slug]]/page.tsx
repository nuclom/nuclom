import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/page";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsMarkdown } from "@/components/docs/docs-markdown";
import { getAllDocsPaths, getDocsContent } from "@/lib/docs/markdown";

interface PageProps {
  params: Promise<{
    slug?: string[];
  }>;
}

export async function generateStaticParams() {
  // Only generate public docs paths - internal docs are handled by their own layout
  const paths = getAllDocsPaths();
  const publicPaths = paths.filter((path) => path[0] !== "internal");
  return publicPaths.map((slug) => ({
    slug: slug.length === 0 ? undefined : slug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug = [] } = await params;
  const content = await getDocsContent(slug);

  if (!content) {
    return {
      title: "Not Found",
    };
  }

  return {
    title: content.title,
    description: content.description,
  };
}

export default async function Page({ params }: PageProps) {
  const { slug = [] } = await params;
  const content = await getDocsContent(slug);

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
