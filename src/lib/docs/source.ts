// Type for our documentation page structure
export interface DocPage {
  slug: string[];
  title: string;
  description?: string;
  url: string;
}

// Documentation structure for navigation
export const docsStructure = {
  public: {
    guides: [
      { slug: "getting-started", title: "Getting Started" },
      { slug: "organization-management", title: "Organization Management" },
      { slug: "video-organization", title: "Video Organization" },
      { slug: "collaboration", title: "Collaboration" },
      { slug: "team-management", title: "Team Management" },
      { slug: "settings-preferences", title: "Settings & Preferences" },
      { slug: "troubleshooting", title: "Troubleshooting" },
    ],
    api: [
      { slug: "README", title: "API Overview" },
      { slug: "authentication", title: "Authentication" },
      { slug: "videos", title: "Videos" },
      { slug: "organizations", title: "Organizations" },
      { slug: "comments", title: "Comments" },
      { slug: "notifications", title: "Notifications" },
      { slug: "ai", title: "AI Integration" },
      { slug: "errors", title: "Error Handling" },
    ],
  },
  internal: {
    architecture: [
      { slug: "README", title: "Architecture Overview" },
      { slug: "authentication", title: "Authentication System" },
      { slug: "database", title: "Database Design" },
      { slug: "frontend", title: "Frontend Architecture" },
      { slug: "backend", title: "Backend Architecture" },
      { slug: "video-processing", title: "Video Processing" },
      { slug: "effect-ts", title: "Effect.js Integration" },
      { slug: "accessibility", title: "Accessibility" },
      { slug: "deployment", title: "Deployment" },
    ],
    reference: [
      { slug: "README", title: "Reference Overview" },
      { slug: "development-setup", title: "Development Setup" },
      { slug: "database-setup", title: "Database Setup" },
      { slug: "environment-config", title: "Environment Config" },
      { slug: "components", title: "Components" },
      { slug: "hooks", title: "Hooks" },
      { slug: "styling", title: "Styling" },
      { slug: "testing", title: "Testing" },
      { slug: "migrations", title: "Migrations" },
      { slug: "data-integrity", title: "Data Integrity" },
      { slug: "contributing", title: "Contributing" },
    ],
  },
};

// Get all public documentation pages for navigation
export function getPublicDocsNavigation() {
  return [
    {
      title: "Getting Started",
      url: "/docs",
    },
    {
      title: "User Guides",
      items: docsStructure.public.guides.map((doc) => ({
        title: doc.title,
        url: `/docs/guides/${doc.slug}`,
      })),
    },
    {
      title: "API Reference",
      items: docsStructure.public.api.map((doc) => ({
        title: doc.title,
        url: `/docs/api/${doc.slug === "README" ? "" : doc.slug}`,
      })),
    },
  ];
}

// Get internal docs navigation (hidden from main menu)
export function getInternalDocsNavigation() {
  return [
    {
      title: "Architecture",
      items: docsStructure.internal.architecture.map((doc) => ({
        title: doc.title,
        url: `/docs/internal/architecture/${doc.slug === "README" ? "" : doc.slug}`,
      })),
    },
    {
      title: "Reference",
      items: docsStructure.internal.reference.map((doc) => ({
        title: doc.title,
        url: `/docs/internal/reference/${doc.slug === "README" ? "" : doc.slug}`,
      })),
    },
  ];
}

// Check if a path is internal docs
export function isInternalDocs(pathname: string): boolean {
  return pathname.startsWith("/docs/internal");
}
