'use client';

import {
  Bell,
  BookOpen,
  Bot,
  Building2,
  ChevronDown,
  ChevronRight,
  Code2,
  ExternalLink,
  FileText,
  Folder,
  GitBranch,
  HelpCircle,
  Key,
  LayoutDashboard,
  type LucideIcon,
  MessageSquare,
  Play,
  Rocket,
  Settings,
  Users,
  Video,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';

// Icon mapping for navigation items
const iconMap: Record<string, LucideIcon> = {
  // Main sections
  overview: BookOpen,
  'getting-started': Rocket,
  quickstart: Play,
  introduction: BookOpen,

  // User Guides
  'organization-management': Building2,
  'video-organization': Folder,
  collaboration: MessageSquare,
  'team-management': Users,
  'settings-preferences': Settings,
  troubleshooting: HelpCircle,
  'workflow-templates': GitBranch,

  // API Reference
  api: Code2,
  authentication: Key,
  videos: Video,
  organizations: Building2,
  comments: MessageSquare,
  notifications: Bell,
  ai: Bot,
  errors: FileText,
  insights: Zap,
  knowledge: LayoutDashboard,
  embed: Code2,
};

interface NavItem {
  name: string;
  url: string;
  icon?: string;
  external?: boolean;
}

interface NavSection {
  title: string;
  defaultOpen?: boolean;
  items: NavItem[];
}

interface DocsSidebarProps {
  sections: NavSection[];
  className?: string;
}

function NavItemIcon({ iconKey, className }: { iconKey?: string; className?: string }) {
  const Icon = iconKey ? iconMap[iconKey] : FileText;
  return <Icon className={cn('h-4 w-4', className)} />;
}

function SidebarSection({ section }: { section: NavSection }) {
  const [isOpen, setIsOpen] = useState(section.defaultOpen ?? true);
  const pathname = usePathname();

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-start gap-2.5 px-2 py-1.5 text-left text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <span className="flex h-4 w-4 items-center justify-center shrink-0">
          {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </span>
        <span className="flex-1">{section.title}</span>
      </button>

      {isOpen && (
        <div className="space-y-1">
          {section.items.map((item) => {
            const isActive = pathname === item.url;
            const iconKey = item.icon || item.url.split('/').pop() || 'overview';

            return (
              <Link
                key={item.url}
                href={item.url}
                target={item.external ? '_blank' : undefined}
                rel={item.external ? 'noopener noreferrer' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <span className="flex h-4 w-4 items-center justify-center shrink-0">
                  <NavItemIcon iconKey={iconKey} className={isActive ? 'text-primary' : ''} />
                </span>
                <span className="flex-1">{item.name}</span>
                {item.external && <ExternalLink className="h-3 w-3 opacity-50" />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function DocsSidebar({ sections, className }: DocsSidebarProps) {
  return (
    <nav className={cn('space-y-4', className)}>
      {sections.map((section) => (
        <SidebarSection key={section.title} section={section} />
      ))}
    </nav>
  );
}
