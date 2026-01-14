import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import type React from 'react';
import { DocsLayoutWrapper } from '@/components/docs/docs-layout-wrapper';
import '@/app/docs/docs.css';

export const metadata: Metadata = {
  title: {
    template: '%s | Nuclom Docs',
    default: 'Nuclom Documentation',
  },
  description: 'Documentation for Nuclom video collaboration platform',
};

// Navigation sections with icons
const docsSections = [
  {
    title: 'Getting Started',
    defaultOpen: true,
    items: [
      { name: 'Overview', url: '/docs', icon: 'overview' },
      { name: 'Quickstart', url: '/docs/guides/getting-started', icon: 'getting-started' },
    ],
  },
  {
    title: 'User Guides',
    defaultOpen: true,
    items: [
      { name: 'Organization Management', url: '/docs/guides/organization-management', icon: 'organization-management' },
      { name: 'Video Organization', url: '/docs/guides/video-organization', icon: 'video-organization' },
      { name: 'Collaboration', url: '/docs/guides/collaboration', icon: 'collaboration' },
      { name: 'Team Management', url: '/docs/guides/team-management', icon: 'team-management' },
      { name: 'Settings & Preferences', url: '/docs/guides/settings-preferences', icon: 'settings-preferences' },
      { name: 'Workflow Templates', url: '/docs/guides/workflow-templates', icon: 'workflow-templates' },
      { name: 'Troubleshooting', url: '/docs/guides/troubleshooting', icon: 'troubleshooting' },
    ],
  },
  {
    title: 'API Reference',
    defaultOpen: false,
    items: [
      { name: 'API Overview', url: '/docs/api', icon: 'api' },
      { name: 'Interactive Reference', url: '/docs/api/reference', icon: 'api' },
      { name: 'Authentication', url: '/docs/api/authentication', icon: 'authentication' },
      { name: 'Videos', url: '/docs/api/videos', icon: 'videos' },
      { name: 'Organizations', url: '/docs/api/organizations', icon: 'organizations' },
      { name: 'Comments', url: '/docs/api/comments', icon: 'comments' },
      { name: 'Notifications', url: '/docs/api/notifications', icon: 'notifications' },
      { name: 'AI Integration', url: '/docs/api/ai', icon: 'ai' },
      { name: 'Error Handling', url: '/docs/api/errors', icon: 'errors' },
    ],
  },
];

export default function DocsRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <DocsLayoutWrapper sections={docsSections}>{children}</DocsLayoutWrapper>
    </ThemeProvider>
  );
}
