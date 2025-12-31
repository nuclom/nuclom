import type React from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/next";

// Internal docs tree - only shown when viewing internal docs
const internalTree = {
  name: "Internal Docs",
  children: [
    {
      type: "page" as const,
      name: "Overview",
      url: "/docs/internal",
    },
    {
      type: "folder" as const,
      name: "Architecture",
      defaultOpen: true,
      children: [
        { type: "page" as const, name: "Overview", url: "/docs/internal/architecture" },
        { type: "page" as const, name: "Authentication", url: "/docs/internal/architecture/authentication" },
        { type: "page" as const, name: "Database", url: "/docs/internal/architecture/database" },
        { type: "page" as const, name: "Frontend", url: "/docs/internal/architecture/frontend" },
        { type: "page" as const, name: "Backend", url: "/docs/internal/architecture/backend" },
        { type: "page" as const, name: "Video Processing", url: "/docs/internal/architecture/video-processing" },
        { type: "page" as const, name: "Effect.js", url: "/docs/internal/architecture/effect-ts" },
        { type: "page" as const, name: "Accessibility", url: "/docs/internal/architecture/accessibility" },
        { type: "page" as const, name: "Deployment", url: "/docs/internal/architecture/deployment" },
      ],
    },
    {
      type: "folder" as const,
      name: "Reference",
      children: [
        { type: "page" as const, name: "Overview", url: "/docs/internal/reference" },
        { type: "page" as const, name: "Development Setup", url: "/docs/internal/reference/development-setup" },
        { type: "page" as const, name: "Database Setup", url: "/docs/internal/reference/database-setup" },
        { type: "page" as const, name: "Environment Config", url: "/docs/internal/reference/environment-config" },
        { type: "page" as const, name: "Components", url: "/docs/internal/reference/components" },
        { type: "page" as const, name: "Hooks", url: "/docs/internal/reference/hooks" },
        { type: "page" as const, name: "Styling", url: "/docs/internal/reference/styling" },
        { type: "page" as const, name: "Testing", url: "/docs/internal/reference/testing" },
        { type: "page" as const, name: "Migrations", url: "/docs/internal/reference/migrations" },
        { type: "page" as const, name: "Data Integrity", url: "/docs/internal/reference/data-integrity" },
        { type: "page" as const, name: "Contributing", url: "/docs/internal/reference/contributing" },
      ],
    },
  ],
};

export default function InternalDocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <RootProvider>
      <DocsLayout
        nav={{
          title: "Internal Docs",
          url: "/docs/internal",
        }}
        links={[
          {
            text: "Home",
            url: "/",
          },
          {
            text: "Public Docs",
            url: "/docs",
          },
          {
            text: "Architecture",
            url: "/docs/internal/architecture",
          },
          {
            text: "Reference",
            url: "/docs/internal/reference",
          },
        ]}
        sidebar={{
          banner: (
            <div className="rounded-lg border border-amber-500/50 bg-amber-50 p-3 text-sm dark:bg-amber-950/20">
              <p className="font-medium text-amber-800 dark:text-amber-200">Internal Documentation</p>
              <p className="text-amber-700 dark:text-amber-300">For development purposes only.</p>
            </div>
          ),
        }}
        tree={internalTree}
      >
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
