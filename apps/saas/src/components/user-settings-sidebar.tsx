'use client';

import { cn } from '@nuclom/lib/utils';
import { Link } from '@vercel/microfrontends/next/client';
import { Bell, ChevronRight, Link2, Search, Shield, User, UserCog, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
  description: string;
};

const navItems: NavItem[] = [
  {
    href: '/settings',
    label: 'Your Profile',
    icon: User,
    keywords: ['profile', 'name', 'avatar', 'photo', 'picture', 'personal', 'info'],
    description: 'Update your name, photo, and personal info',
  },
  {
    href: '/settings/account',
    label: 'Account',
    icon: UserCog,
    keywords: ['account', 'email', 'delete', 'export', 'data', 'privacy'],
    description: 'Email, data export, and account deletion',
  },
  {
    href: '/settings/linked-accounts',
    label: 'Linked Accounts',
    icon: Link2,
    keywords: ['linked', 'accounts', 'oauth', 'google', 'github', 'social', 'login', 'connect'],
    description: 'Connect Google, GitHub, and other providers',
  },
  {
    href: '/settings/security',
    label: 'Security',
    icon: Shield,
    keywords: ['security', 'password', '2fa', 'two-factor', 'passkey', 'sessions', 'devices'],
    description: 'Password, 2FA, passkeys, and active sessions',
  },
  {
    href: '/settings/notifications',
    label: 'Notifications',
    icon: Bell,
    keywords: ['notifications', 'email', 'alerts', 'digest', 'updates', 'push'],
    description: 'Email and push notification preferences',
  },
];

// Nav item with hover preview tooltip
function NavItemWithPreview({
  item,
  isActive,
  isSelected,
  showDescription,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  isSelected: boolean;
  showDescription: boolean;
  onClick: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  const content = (
    <Link
      href={item.href}
      className={cn(
        'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
        isActive
          ? 'bg-accent text-accent-foreground shadow-sm'
          : isSelected
            ? 'bg-muted text-foreground'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
      )}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Icon with animation */}
      <div
        className={cn(
          'flex items-center justify-center w-8 h-8 rounded-md transition-all duration-200',
          isActive ? 'bg-primary/10 text-primary' : isHovered ? 'bg-muted text-foreground' : 'text-muted-foreground',
        )}
      >
        <item.icon className="h-4 w-4" />
      </div>

      {/* Label and description */}
      <div className="flex-1 min-w-0">
        <span className="block truncate">{item.label}</span>
        {showDescription && (
          <span className="block text-xs text-muted-foreground truncate mt-0.5">{item.description}</span>
        )}
      </div>

      {/* Active indicator / Arrow */}
      <ChevronRight
        className={cn(
          'h-4 w-4 transition-all duration-200',
          isActive ? 'opacity-100 text-primary' : isHovered ? 'opacity-100 translate-x-0.5' : 'opacity-0',
        )}
      />
    </Link>
  );

  // Only show tooltip when not searching (showDescription is false)
  if (showDescription) {
    return content;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8} className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium text-sm">{item.label}</p>
            <p className="text-xs text-muted-foreground">{item.description}</p>
            <div className="flex flex-wrap gap-1 pt-1">
              {item.keywords.slice(0, 4).map((keyword) => (
                <span
                  key={keyword}
                  className="inline-flex px-1.5 py-0.5 bg-muted rounded text-[10px] text-muted-foreground"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function UserSettingsSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isActive = (href: string) => {
    if (href === '/settings') {
      return pathname === '/settings' || pathname === '/settings/profile';
    }
    return pathname === href;
  };

  // Filter nav items based on search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return navItems;

    const query = searchQuery.toLowerCase();
    return navItems.filter(
      (item) =>
        item.label.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.keywords.some((kw) => kw.includes(query)),
    );
  }, [searchQuery]);

  // Reset selected index when search query changes
  const currentSearchQuery = searchQuery;
  useEffect(() => {
    if (currentSearchQuery !== undefined) {
      setSelectedIndex(0);
    }
  }, [currentSearchQuery]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (filteredItems.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredItems[selectedIndex]) {
            router.push(filteredItems[selectedIndex].href);
            setSearchQuery('');
            searchInputRef.current?.blur();
          }
          break;
        case 'Escape':
          e.preventDefault();
          setSearchQuery('');
          searchInputRef.current?.blur();
          break;
      }
    },
    [filteredItems, selectedIndex, router],
  );

  // Global keyboard shortcut to focus search
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // / to focus search (when not in an input)
      if (e.key === '/' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  return (
    <aside className="w-64 border-r bg-card/50 flex flex-col h-[calc(100vh-4rem)]">
      <div className="p-4 space-y-4">
        <h2 className="text-lg font-semibold">Settings</h2>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search settings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 150)}
            onKeyDown={handleKeyDown}
            className="pl-9 pr-9 h-9 text-sm"
            aria-label="Search settings"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {!searchQuery && !isSearchFocused && (
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono text-muted-foreground pointer-events-none">
              /
            </kbd>
          )}
        </div>

        {/* Navigation */}
        <nav className="space-y-1" aria-label="Settings navigation">
          {filteredItems.length > 0 ? (
            filteredItems.map((item, index) => (
              <NavItemWithPreview
                key={item.href}
                item={item}
                isActive={isActive(item.href)}
                isSelected={searchQuery.length > 0 && index === selectedIndex}
                showDescription={searchQuery.length > 0}
                onClick={() => setSearchQuery('')}
              />
            ))
          ) : (
            <div className="px-3 py-8 text-center">
              <Search className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No settings found</p>
              <p className="text-xs text-muted-foreground mt-1">Try searching for "password" or "notifications"</p>
            </div>
          )}
        </nav>
      </div>
    </aside>
  );
}
