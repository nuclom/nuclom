import {
  Bot,
  Code2,
  Folder,
  GitBranch,
  Key,
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
import { cn } from '@/lib/utils';

const iconMap: Record<string, LucideIcon> = {
  rocket: Rocket,
  video: Video,
  users: Users,
  settings: Settings,
  code: Code2,
  key: Key,
  bot: Bot,
  zap: Zap,
  folder: Folder,
  branch: GitBranch,
  message: MessageSquare,
  play: Play,
};

interface FeatureCardProps {
  title: string;
  description: string;
  href: string;
  icon: keyof typeof iconMap;
  className?: string;
}

export function FeatureCard({ title, description, href, icon, className }: FeatureCardProps) {
  const Icon = iconMap[icon] || Rocket;

  return (
    <Link
      href={href}
      className={cn(
        'group relative flex flex-col gap-2 rounded-xl border bg-card p-5 transition-all hover:border-primary/50 hover:shadow-md',
        className,
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </Link>
  );
}

interface FeatureCardGridProps {
  children: React.ReactNode;
  className?: string;
}

export function FeatureCardGrid({ children, className }: FeatureCardGridProps) {
  return <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>{children}</div>;
}
