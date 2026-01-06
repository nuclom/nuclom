'use client';

import {
  Bell,
  Building,
  ClipboardList,
  CreditCard,
  Globe,
  Key,
  Lock,
  Plug,
  Shield,
  User,
  UserCog,
  UserSquare2,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

export function SettingsSidebar({ organization }: { organization: string }) {
  const pathname = usePathname();

  const navSections: NavSection[] = [
    {
      title: 'Personal',
      items: [
        {
          href: `/${organization}/settings/profile`,
          label: 'Your Profile',
          icon: User,
        },
        {
          href: `/${organization}/settings/account`,
          label: 'Account',
          icon: UserCog,
        },
        {
          href: `/${organization}/settings/security`,
          label: 'Security',
          icon: Shield,
        },
        {
          href: `/${organization}/settings/notifications`,
          label: 'Notifications',
          icon: Bell,
        },
      ],
    },
    {
      title: 'Organization',
      items: [
        {
          href: `/${organization}/settings/organization`,
          label: 'General',
          icon: Building,
        },
        {
          href: `/${organization}/settings/members`,
          label: 'Members',
          icon: Users,
        },
        {
          href: `/${organization}/settings/roles`,
          label: 'Roles & Permissions',
          icon: UserSquare2,
        },
        {
          href: `/${organization}/settings/billing`,
          label: 'Billing',
          icon: CreditCard,
        },
      ],
    },
    {
      title: 'Enterprise',
      items: [
        {
          href: `/${organization}/settings/sso`,
          label: 'Single Sign-On',
          icon: Lock,
          badge: 'Enterprise',
        },
        {
          href: `/${organization}/settings/audit-logs`,
          label: 'Audit Logs',
          icon: ClipboardList,
          badge: 'Enterprise',
        },
      ],
    },
    {
      title: 'Developer',
      items: [
        {
          href: `/${organization}/settings/api-keys`,
          label: 'API Keys',
          icon: Key,
        },
        {
          href: `/${organization}/settings/oauth-apps`,
          label: 'OAuth Apps',
          icon: Globe,
        },
        {
          href: `/${organization}/settings/integrations`,
          label: 'Integrations',
          icon: Plug,
        },
      ],
    },
  ];

  return (
    <aside className="w-full md:w-56 flex-shrink-0">
      <h2 className="text-2xl font-bold mb-6">Settings</h2>
      <nav className="space-y-6">
        {navSections.map((section) => (
          <div key={section.title}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">
              {section.title}
            </h3>
            <ul className="space-y-1">
              {section.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      pathname === item.href
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
