'use client';

import { cn } from '@nuclom/lib/utils';
import { Link } from '@vercel/microfrontends/next/client';
import { Bell, Link2, Search, Shield, User, UserCog, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';

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
        item.keywords.some((kw) => kw.includes(query))
    );
  }, [searchQuery]);

  // Reset selected index when filtered items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems.length]);

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
    [filteredItems, selectedIndex, router]
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
        <nav className="space-y-1" role="navigation" aria-label="Settings navigation">
          {filteredItems.length > 0 ? (
            filteredItems.map((item, index) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive(item.href)
                    ? 'bg-accent text-accent-foreground'
                    : searchQuery && index === selectedIndex
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
                onClick={() => setSearchQuery('')}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="block truncate">{item.label}</span>
                  {searchQuery && (
                    <span className="block text-xs text-muted-foreground truncate mt-0.5">
                      {item.description}
                    </span>
                  )}
                </div>
              </Link>
            ))
          ) : (
            <div className="px-3 py-8 text-center">
              <Search className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No settings found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try searching for "password" or "notifications"
              </p>
            </div>
          )}
        </nav>
      </div>
    </aside>
  );
}
