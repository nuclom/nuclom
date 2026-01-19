'use client';

import { cn } from '@nuclom/lib/utils';
import { Link } from '@vercel/microfrontends/next/client';
import { Building, ClipboardList, CreditCard, Globe, Key, Lock, Plug, UserSquare2, Users } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Badge } from '@/components/ui/badge';

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
      title: 'Organization',
      items: [
        {
          href: `/org/${organization}/settings/organization`,
          label: 'General',
          icon: Building,
        },
        {
          href: `/org/${organization}/settings/members`,
          label: 'Members',
          icon: Users,
        },
        {
          href: `/org/${organization}/settings/roles`,
          label: 'Roles & Permissions',
          icon: UserSquare2,
        },
        {
          href: `/org/${organization}/settings/billing`,
          label: 'Billing',
          icon: CreditCard,
        },
      ],
    },
    {
      title: 'Enterprise',
      items: [
        {
          href: `/org/${organization}/settings/sso`,
          label: 'Single Sign-On',
          icon: Lock,
          badge: 'Enterprise',
        },
        {
          href: `/org/${organization}/settings/audit-logs`,
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
          href: `/org/${organization}/settings/api-keys`,
          label: 'API Keys',
          icon: Key,
        },
        {
          href: `/org/${organization}/settings/oauth-apps`,
          label: 'OAuth Apps',
          icon: Globe,
        },
        {
          href: `/org/${organization}/settings/integrations`,
          label: 'Integrations',
          icon: Plug,
        },
      ],
    },
  ];

  return (
    <aside className="w-full md:w-56 flex-shrink-0">
      <h2 className="text-2xl font-bold mb-6">Organization Settings</h2>
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
