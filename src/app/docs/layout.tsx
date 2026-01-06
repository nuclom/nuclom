import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { RootProvider } from 'fumadocs-ui/provider/next';
import type { Metadata } from 'next';
import type React from 'react';
import 'fumadocs-ui/style.css';

export const metadata: Metadata = {
  title: {
    template: '%s | Nuclom Docs',
    default: 'Nuclom Documentation',
  },
  description: 'Documentation for Nuclom video collaboration platform',
};

// Public docs tree - visible in main navigation
const publicTree = {
  name: 'Docs',
  children: [
    {
      type: 'page' as const,
      name: 'Introduction',
      url: '/docs',
    },
    {
      type: 'folder' as const,
      name: 'User Guides',
      defaultOpen: true,
      children: [
        { type: 'page' as const, name: 'Getting Started', url: '/docs/guides/getting-started' },
        { type: 'page' as const, name: 'Organization Management', url: '/docs/guides/organization-management' },
        { type: 'page' as const, name: 'Video Organization', url: '/docs/guides/video-organization' },
        { type: 'page' as const, name: 'Collaboration', url: '/docs/guides/collaboration' },
        { type: 'page' as const, name: 'Team Management', url: '/docs/guides/team-management' },
        { type: 'page' as const, name: 'Settings & Preferences', url: '/docs/guides/settings-preferences' },
        { type: 'page' as const, name: 'Troubleshooting', url: '/docs/guides/troubleshooting' },
      ],
    },
    {
      type: 'folder' as const,
      name: 'API Reference',
      children: [
        { type: 'page' as const, name: 'API Overview', url: '/docs/api' },
        { type: 'page' as const, name: 'Interactive Reference', url: '/docs/api/reference' },
        { type: 'page' as const, name: 'Authentication', url: '/docs/api/authentication' },
        { type: 'page' as const, name: 'Videos', url: '/docs/api/videos' },
        { type: 'page' as const, name: 'Organizations', url: '/docs/api/organizations' },
        { type: 'page' as const, name: 'Comments', url: '/docs/api/comments' },
        { type: 'page' as const, name: 'Notifications', url: '/docs/api/notifications' },
        { type: 'page' as const, name: 'AI Integration', url: '/docs/api/ai' },
        { type: 'page' as const, name: 'Error Handling', url: '/docs/api/errors' },
      ],
    },
  ],
};

export default function DocsRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <RootProvider>
      <DocsLayout
        nav={{
          title: 'Nuclom Docs',
          url: '/docs',
        }}
        links={[
          {
            text: 'Home',
            url: '/',
          },
          {
            text: 'Guides',
            url: '/docs/guides/getting-started',
          },
          {
            text: 'API',
            url: '/docs/api',
          },
        ]}
        sidebar={{
          banner: (
            <div className="rounded-lg border bg-fd-card p-3 text-sm">
              <p className="font-medium">Welcome to Nuclom Docs</p>
              <p className="text-fd-muted-foreground">Learn how to use the platform effectively.</p>
            </div>
          ),
        }}
        tree={publicTree}
      >
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
