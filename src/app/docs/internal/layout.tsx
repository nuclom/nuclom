import { ThemeProvider } from 'next-themes';
import type React from 'react';
import { DocsLayoutWrapper } from '@/components/docs/docs-layout-wrapper';
import '@/app/docs/docs.css';

// Internal docs navigation sections
const internalDocsSections = [
  {
    title: 'Overview',
    defaultOpen: true,
    items: [{ name: 'Introduction', url: '/docs/internal', icon: 'overview' }],
  },
  {
    title: 'Architecture',
    defaultOpen: true,
    items: [
      { name: 'Overview', url: '/docs/internal/architecture', icon: 'overview' },
      { name: 'Summary', url: '/docs/internal/architecture/summary', icon: 'overview' },
      { name: 'Authentication', url: '/docs/internal/architecture/authentication', icon: 'authentication' },
      { name: 'Database', url: '/docs/internal/architecture/database', icon: 'overview' },
      { name: 'Frontend', url: '/docs/internal/architecture/frontend', icon: 'overview' },
      { name: 'Backend', url: '/docs/internal/architecture/backend', icon: 'api' },
      { name: 'Video Processing', url: '/docs/internal/architecture/video-processing', icon: 'videos' },
      { name: 'Workflows', url: '/docs/internal/architecture/workflows', icon: 'workflow-templates' },
      { name: 'Effect.js', url: '/docs/internal/architecture/effect-ts', icon: 'api' },
      { name: 'Integrations', url: '/docs/internal/architecture/integrations', icon: 'api' },
      { name: 'Accessibility', url: '/docs/internal/architecture/accessibility', icon: 'overview' },
      { name: 'Deployment', url: '/docs/internal/architecture/deployment', icon: 'overview' },
    ],
  },
  {
    title: 'Reference',
    defaultOpen: false,
    items: [
      { name: 'Overview', url: '/docs/internal/reference', icon: 'overview' },
      { name: 'Development Setup', url: '/docs/internal/reference/development-setup', icon: 'getting-started' },
      { name: 'Database Setup', url: '/docs/internal/reference/database-setup', icon: 'overview' },
      { name: 'Environment Config', url: '/docs/internal/reference/environment-config', icon: 'settings-preferences' },
      { name: 'Components', url: '/docs/internal/reference/components', icon: 'overview' },
      { name: 'Hooks', url: '/docs/internal/reference/hooks', icon: 'api' },
      { name: 'Styling', url: '/docs/internal/reference/styling', icon: 'overview' },
      { name: 'Testing', url: '/docs/internal/reference/testing', icon: 'overview' },
      { name: 'Migrations', url: '/docs/internal/reference/migrations', icon: 'overview' },
      { name: 'Data Integrity', url: '/docs/internal/reference/data-integrity', icon: 'overview' },
      { name: 'Contributing', url: '/docs/internal/reference/contributing', icon: 'team-management' },
    ],
  },
  {
    title: 'Business',
    defaultOpen: false,
    items: [{ name: 'Pricing Strategy', url: '/docs/internal/pricing', icon: 'overview' }],
  },
];

export default function InternalDocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <DocsLayoutWrapper sections={internalDocsSections}>
        {/* Internal docs warning banner */}
        <div className="mb-6 rounded-lg border border-amber-500/50 bg-amber-50 p-4 text-sm dark:bg-amber-950/20">
          <p className="font-medium text-amber-800 dark:text-amber-200">Internal Documentation</p>
          <p className="text-amber-700 dark:text-amber-300">For development purposes only. Do not share externally.</p>
        </div>
        {children}
      </DocsLayoutWrapper>
    </ThemeProvider>
  );
}
