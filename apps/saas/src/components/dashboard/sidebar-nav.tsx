'use client';

import { cn } from '@nuclom/lib/utils';
import { Link } from '@vercel/microfrontends/next/client';
import {
  Building,
  CheckCircle,
  Clock,
  Database,
  Folders,
  History,
  Home,
  PlayCircle,
  Search,
  Share2,
  Tags,
  Trash2,
  Upload,
  Video,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface SidebarNavProps {
  organization: string;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
}

export function SidebarNav({ organization }: SidebarNavProps) {
  const pathname = usePathname();

  const mainNavItems: NavItem[] = [
    {
      title: 'Feed',
      href: `/org/${organization}`,
      icon: Home,
    },
    {
      title: 'Search',
      href: `/org/${organization}/search`,
      icon: Search,
    },
    {
      title: 'Videos',
      href: `/org/${organization}/videos`,
      icon: Video,
    },
    {
      title: 'Collections',
      href: `/org/${organization}/collections`,
      icon: Folders,
    },
  ];

  const knowledgeNavItems: NavItem[] = [
    {
      title: 'Sources',
      href: `/org/${organization}/sources`,
      icon: Database,
    },
    {
      title: 'Topics',
      href: `/org/${organization}/topics`,
      icon: Tags,
    },
    {
      title: 'Decisions',
      href: `/org/${organization}/decisions`,
      icon: CheckCircle,
    },
  ];

  const libraryNavItems: NavItem[] = [
    {
      title: 'My Videos',
      href: `/org/${organization}/my-videos`,
      icon: PlayCircle,
    },
    {
      title: 'Watch Later',
      href: `/org/${organization}/watch-later`,
      icon: Clock,
    },
    {
      title: 'Watch History',
      href: `/org/${organization}/history`,
      icon: History,
    },
    {
      title: 'Shared with Me',
      href: `/org/${organization}/shared`,
      icon: Share2,
    },
    {
      title: 'Trash',
      href: `/org/${organization}/trash`,
      icon: Trash2,
    },
  ];

  const isActive = (href: string) => {
    if (href === `/org/${organization}`) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-64 border-r bg-card/50 flex flex-col h-[calc(100vh-4rem)]">
      <div className="p-4">
        <Button asChild className="w-full gap-2" size="lg">
          <Link href={`/org/${organization}/upload`}>
            <Upload className="h-4 w-4" />
            Upload Video
          </Link>
        </Button>
      </div>

      <ScrollArea className="flex-1 px-3">
        <div className="space-y-1 py-2">
          {mainNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all hover:bg-accent',
                isActive(item.href)
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
              {item.badge !== undefined && item.badge > 0 && (
                <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </div>

        <Separator className="my-4" />

        <div className="py-2">
          <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Knowledge</h3>
          <div className="space-y-1">
            {knowledgeNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all hover:bg-accent',
                  isActive(item.href)
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </Link>
            ))}
          </div>
        </div>

        <Separator className="my-4" />

        <div className="py-2">
          <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Library</h3>
          <div className="space-y-1">
            {libraryNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all hover:bg-accent',
                  isActive(item.href)
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </Link>
            ))}
          </div>
        </div>
      </ScrollArea>

      <div className="p-4 border-t">
        <Link
          href={`/org/${organization}/settings/organization`}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all hover:bg-accent',
            pathname.startsWith(`/org/${organization}/settings`)
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Building className="h-4 w-4" />
          Organization Settings
        </Link>
      </div>
    </aside>
  );
}
