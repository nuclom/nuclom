'use client';

import { Film, HelpCircle, Home, LogOut, Plus, Settings } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/use-auth';
import { authClient } from '@/lib/auth-client';
import { logger } from '@/lib/client-logger';
import { CommandBar } from './command-bar';
import { NotificationBell } from './notifications/notification-bell';
import { OrganizationSwitcher } from './organization-switcher';
import { ThemeToggle } from './theme-toggle';

interface TopNavProps {
  organization: string;
  organizationId?: string;
  children?: React.ReactNode;
}

export function TopNav({ organization, organizationId, children }: TopNavProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await authClient.signOut();
      router.push('/login');
      router.refresh();
    } catch (error) {
      logger.error('Logout failed', error);
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="grid grid-cols-[1fr_auto_1fr] h-16 items-center gap-4 px-4 md:px-6">
        {/* Left section - Mobile menu, Logo and Organization */}
        <div className="flex items-center gap-4">
          {/* Mobile sidebar trigger */}
          {children}

          <Link href={`/${organization}`} className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center group-hover:shadow-lg group-hover:shadow-primary/25 transition-shadow">
              <Film className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold hidden sm:inline-block bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              Nuclom
            </span>
          </Link>

          <div className="hidden md:block h-6 w-px bg-border" />

          <div className="hidden md:block">
            <OrganizationSwitcher currentOrganization={organization} />
          </div>
        </div>

        {/* Center section - Search */}
        <div className="w-full max-w-md lg:max-w-xl">
          <CommandBar organization={organization} organizationId={organizationId} />
        </div>

        {/* Right section - Actions */}
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" className="hidden sm:inline-flex gap-2 bg-primary hover:bg-primary/90" asChild>
            <Link href={`/${organization}/upload`}>
              <Plus className="h-4 w-4" />
              <span className="hidden md:inline">New Video</span>
            </Link>
          </Button>

          <ThemeToggle />

          <NotificationBell organization={organization} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9 ring-2 ring-border">
                  <AvatarImage src={user?.image || '/placeholder.svg?height=36&width=36'} alt={user?.name || 'User'} />
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {isLoading ? '...' : getInitials(user?.name)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1.5">
                  <p className="text-sm font-semibold leading-none">{user?.name || 'Loading...'}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user?.email || ''}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link href={`/${organization}/settings`} className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                    <DropdownMenuShortcut>S</DropdownMenuShortcut>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/home" className="cursor-pointer">
                  <Home className="mr-2 h-4 w-4" />
                  <span>Home Page</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/support" className="cursor-pointer">
                  <HelpCircle className="mr-2 h-4 w-4" />
                  <span>Help & Support</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
                <DropdownMenuShortcut>Q</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile organization switcher - visible below header on mobile */}
      <div className="px-4 pb-2 md:hidden border-t pt-2 bg-background/95 backdrop-blur">
        <OrganizationSwitcher currentOrganization={organization} />
      </div>
    </header>
  );
}
