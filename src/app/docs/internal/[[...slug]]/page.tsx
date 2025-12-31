import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsBody, DocsPage, DocsTitle, DocsDescription } from "fumadocs-ui/page";
import { getDocsContent, getAllDocsPaths } from "@/lib/docs/markdown";
import { DocsMarkdown } from "@/components/docs/docs-markdown";

interface PageProps {
  params: Promise<{
    slug?: string[];
  }>;
}

export async function generateStaticParams() {
  // Generate internal doc paths only
  const allPaths = getAllDocsPaths();
  const internalPaths = allPaths
    .filter((path) => path[0] === "internal")
    .map((path) => ({
      slug: path.slice(1).length === 0 ? undefined : path.slice(1),
    }));

  return internalPaths;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug = [] } = await params;
  const fullSlug = ["internal", ...slug];
  const content = await getDocsContent(fullSlug);

  if (!content) {
    return {
      title: "Not Found",
    };
  }

  return {
    title: `${content.title} | Internal Docs`,
    description: content.description,
  };
}

export default async function InternalDocsPage({ params }: PageProps) {
  const { slug = [] } = await params;
  const fullSlug = ["internal", ...slug];
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
