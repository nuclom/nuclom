'use client';

import { Link } from '@vercel/microfrontends/next/client';
import {
  Clock,
  Folders,
  History,
  Home,
  ListVideo,
  Menu,
  PlayCircle,
  Plus,
  Settings,
  Share2,
  Trash2,
  Upload,
  Video,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface MobileSidebarProps {
  organization: string;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
}

export function MobileSidebar({ organization }: MobileSidebarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const mainNavItems: NavItem[] = [
    {
      title: 'Home',
      href: `/org/${organization}`,
      icon: Home,
    },
    {
      title: 'Videos',
      href: `/org/${organization}/videos`,
      icon: Video,
    },
    {
      title: 'Channels',
      href: `/org/${organization}/channels`,
      icon: Folders,
    },
    {
      title: 'Series',
      href: `/org/${organization}/series`,
      icon: ListVideo,
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

  const handleNavClick = () => {
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden h-9 w-9">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="text-left">Navigation</SheetTitle>
        </SheetHeader>

        <div className="p-4">
          <Button asChild className="w-full justify-start gap-2" size="lg" onClick={handleNavClick}>
            <Link href={`/org/${organization}/upload`}>
              <Upload className="h-4 w-4" />
              Upload Video
            </Link>
          </Button>
        </div>

        <ScrollArea className="flex-1 h-[calc(100vh-12rem)]">
          <div className="px-3 space-y-1 py-2">
            {mainNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavClick}
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

          <Separator className="my-4 mx-3" />

          <div className="px-3 py-2">
            <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Library</h3>
            <div className="space-y-1">
              {libraryNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={handleNavClick}
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

          <Separator className="my-4 mx-3" />

          <div className="px-3 py-2">
            <div className="flex items-center justify-between px-3 mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Collections</h3>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="px-3 py-2 text-sm text-muted-foreground">No collections yet</p>
          </div>
        </ScrollArea>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background">
          <Link
            href={`/org/${organization}/settings`}
            onClick={handleNavClick}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
