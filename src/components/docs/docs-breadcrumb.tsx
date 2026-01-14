'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface BreadcrumbItem {
  label: string;
  href: string;
}

const pathLabels: Record<string, string> = {
  docs: 'Documentation',
  guides: 'User Guides',
  api: 'API Reference',
  internal: 'Internal',
  architecture: 'Architecture',
  reference: 'Reference',
  'getting-started': 'Getting Started',
  'organization-management': 'Organization Management',
  'video-organization': 'Video Organization',
  collaboration: 'Collaboration',
  'team-management': 'Team Management',
  'settings-preferences': 'Settings & Preferences',
  troubleshooting: 'Troubleshooting',
  'workflow-templates': 'Workflow Templates',
  authentication: 'Authentication',
  videos: 'Videos',
  organizations: 'Organizations',
  comments: 'Comments',
  notifications: 'Notifications',
  ai: 'AI Integration',
  errors: 'Error Handling',
};

export function DocsBreadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  // Build breadcrumb items
  const items: BreadcrumbItem[] = [];
  let currentPath = '';

  for (const segment of segments) {
    currentPath += `/${segment}`;
    const label = pathLabels[segment] || segment.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    items.push({ label, href: currentPath });
  }

  // Only show last 2-3 items for cleaner display
  const displayItems = items.slice(-3);

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
      {displayItems.map((item, index) => (
        <div key={item.href} className="flex items-center gap-1">
          {index > 0 && <ChevronRight className="h-4 w-4" />}
          {index === displayItems.length - 1 ? (
            <span className="text-primary font-medium">{item.label}</span>
          ) : (
            <Link href={item.href} className="hover:text-foreground transition-colors">
              {item.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}
