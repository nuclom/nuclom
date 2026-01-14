'use client';

import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

interface SearchItem {
  title: string;
  url: string;
  section: string;
}

// Static search index - in production, this could be generated at build time
const searchIndex: SearchItem[] = [
  // Getting Started
  { title: 'Introduction', url: '/docs', section: 'Getting Started' },
  { title: 'Getting Started', url: '/docs/guides/getting-started', section: 'User Guides' },
  { title: 'Organization Management', url: '/docs/guides/organization-management', section: 'User Guides' },
  { title: 'Video Organization', url: '/docs/guides/video-organization', section: 'User Guides' },
  { title: 'Collaboration', url: '/docs/guides/collaboration', section: 'User Guides' },
  { title: 'Team Management', url: '/docs/guides/team-management', section: 'User Guides' },
  { title: 'Settings & Preferences', url: '/docs/guides/settings-preferences', section: 'User Guides' },
  { title: 'Troubleshooting', url: '/docs/guides/troubleshooting', section: 'User Guides' },
  // API Reference
  { title: 'API Overview', url: '/docs/api', section: 'API Reference' },
  { title: 'Interactive API Reference', url: '/docs/api/reference', section: 'API Reference' },
  { title: 'Authentication', url: '/docs/api/authentication', section: 'API Reference' },
  { title: 'Videos API', url: '/docs/api/videos', section: 'API Reference' },
  { title: 'Organizations API', url: '/docs/api/organizations', section: 'API Reference' },
  { title: 'Comments API', url: '/docs/api/comments', section: 'API Reference' },
  { title: 'Notifications API', url: '/docs/api/notifications', section: 'API Reference' },
  { title: 'AI Integration', url: '/docs/api/ai', section: 'API Reference' },
  { title: 'Error Handling', url: '/docs/api/errors', section: 'API Reference' },
];

export function DocsSearch() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = useCallback((command: () => unknown) => {
    setOpen(false);
    command();
  }, []);

  // Group items by section
  const groupedItems = searchIndex.reduce(
    (acc, item) => {
      if (!acc[item.section]) {
        acc[item.section] = [];
      }
      acc[item.section].push(item);
      return acc;
    },
    {} as Record<string, SearchItem[]>,
  );

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-full justify-start rounded-lg bg-muted/50 text-sm font-normal text-muted-foreground shadow-none sm:pr-12"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        <span className="hidden lg:inline-flex">Search documentation...</span>
        <span className="inline-flex lg:hidden">Search...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search documentation..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {Object.entries(groupedItems).map(([section, items]) => (
            <CommandGroup key={section} heading={section}>
              {items.map((item) => (
                <CommandItem
                  key={item.url}
                  value={item.title}
                  onSelect={() => {
                    runCommand(() => router.push(item.url));
                  }}
                >
                  {item.title}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
