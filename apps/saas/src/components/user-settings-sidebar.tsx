'use client';

import { cn } from '@nuclom/lib/utils';
import { Link } from '@vercel/microfrontends/next/client';
import { Bell, Link2, Shield, User, UserCog } from 'lucide-react';
import { usePathname } from 'next/navigation';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  {
    href: '/settings',
    label: 'Your Profile',
    icon: User,
  },
  {
    href: '/settings/account',
    label: 'Account',
    icon: UserCog,
  },
  {
    href: '/settings/linked-accounts',
    label: 'Linked Accounts',
    icon: Link2,
  },
  {
    href: '/settings/security',
    label: 'Security',
    icon: Shield,
  },
  {
    href: '/settings/notifications',
    label: 'Notifications',
    icon: Bell,
  },
];

export function UserSettingsSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/settings') {
      return pathname === '/settings' || pathname === '/settings/profile';
    }
    return pathname === href;
  };

  return (
    <aside className="w-64 border-r bg-card/50 flex flex-col h-[calc(100vh-4rem)]">
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-4">Settings</h2>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive(item.href)
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}
