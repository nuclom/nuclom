'use client';

import { Link } from '@vercel/microfrontends/next/client';
import { Building, ClipboardList, CreditCard, Globe, Key, Lock, Plug, UserSquare2, Users } from 'lucide-react';
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

export function OrgSettingsSidebar({ organization }: { organization: string }) {
  const pathname = usePathname();

  const navSections: NavSection[] = [
    {
      title: 'Organization',
      items: [
        {
          href: `/org/${organization}/settings`,
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

  const isActive = (href: string) => {
    if (href === `/org/${organization}/settings`) {
      return pathname === `/org/${organization}/settings` || pathname === `/org/${organization}/settings/organization`;
    }
    return pathname === href;
  };

  return (
    <aside className="w-64 border-r bg-card/50 flex flex-col h-[calc(100vh-4rem)]">
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-4">Settings</h2>
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
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                        isActive(item.href)
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                      )}
                    >
                      <item.icon className="h-4 w-4" />
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
      </div>
    </aside>
  );
}
