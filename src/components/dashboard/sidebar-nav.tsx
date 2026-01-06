'use client';

import {
  Clock,
  Folders,
  History,
  Home,
  ListVideo,
  PlayCircle,
  Plus,
  Settings,
  Share2,
  Trash2,
  Upload,
  Video,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

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
      title: 'Home',
      href: `/${organization}`,
      icon: Home,
    },
    {
      title: 'Videos',
      href: `/${organization}/videos`,
      icon: Video,
    },
    {
      title: 'Channels',
      href: `/${organization}/channels`,
      icon: Folders,
    },
    {
      title: 'Series',
      href: `/${organization}/series`,
      icon: ListVideo,
    },
  ];

  const libraryNavItems: NavItem[] = [
    {
      title: 'My Videos',
      href: `/${organization}/my-videos`,
      icon: PlayCircle,
    },
    {
      title: 'Watch Later',
      href: `/${organization}/watch-later`,
      icon: Clock,
    },
    {
      title: 'Watch History',
      href: `/${organization}/history`,
      icon: History,
    },
    {
      title: 'Shared with Me',
      href: `/${organization}/shared`,
      icon: Share2,
    },
    {
      title: 'Trash',
      href: `/${organization}/trash`,
      icon: Trash2,
    },
  ];

  const isActive = (href: string) => {
    if (href === `/${organization}`) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-64 border-r bg-card/50 flex flex-col h-[calc(100vh-4rem)]">
      <div className="p-4">
        <Button asChild className="w-full justify-start gap-2" size="lg">
          <Link href={`/${organization}/upload`}>
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

        <Separator className="my-4" />

        <div className="py-2">
          <div className="flex items-center justify-between px-3 mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Collections</h3>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <p className="px-3 py-2 text-sm text-muted-foreground">No collections yet</p>
        </div>
      </ScrollArea>

      <div className="p-4 border-t">
        <Link
          href={`/${organization}/settings`}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
