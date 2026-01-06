'use client';

import { HardDrive, Sparkles, Users, Video, Wifi } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { UsageSummary } from '@/lib/effect/services/billing-repository';
import { cn } from '@/lib/utils';

interface UsageChartProps {
  usage: UsageSummary;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const formatLimit = (value: number): string => {
  if (value === -1) return 'Unlimited';
  return value.toLocaleString();
};

const _getProgressColor = (percentage: number): string => {
  if (percentage >= 90) return 'bg-destructive';
  if (percentage >= 75) return 'bg-orange-500';
  if (percentage >= 50) return 'bg-yellow-500';
  return 'bg-primary';
};

interface UsageItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  current: string | number;
  limit: string | number;
  percentage: number;
  unit?: string;
}

function UsageItem({ icon: Icon, label, current, limit, percentage, unit }: UsageItemProps) {
  const isUnlimited = limit === 'Unlimited' || limit === -1;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {typeof current === 'number' ? formatBytes(current) : current}
          {!isUnlimited && (
            <>
              {' / '}
              {typeof limit === 'number' ? formatBytes(limit) : limit}
            </>
          )}
          {unit && ` ${unit}`}
        </span>
      </div>
      {!isUnlimited && (
        <Progress value={percentage} className={cn('h-2', percentage >= 90 && '[&>div]:bg-destructive')} />
      )}
      {isUnlimited && (
        <div className="h-2 flex items-center">
          <span className="text-xs text-muted-foreground">Unlimited</span>
        </div>
      )}
    </div>
  );
}

export function UsageChart({ usage }: UsageChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage This Month</CardTitle>
        <CardDescription>Your current resource usage for this billing period</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <UsageItem
          icon={HardDrive}
          label="Storage"
          current={usage.storageUsed}
          limit={usage.limits.storage}
          percentage={usage.percentages.storage}
        />

        <UsageItem
          icon={Video}
          label="Videos Uploaded"
          current={usage.videosUploaded.toString()}
          limit={formatLimit(usage.limits.videos)}
          percentage={usage.percentages.videos}
        />

        <UsageItem
          icon={Wifi}
          label="Bandwidth"
          current={usage.bandwidthUsed}
          limit={usage.limits.bandwidth}
          percentage={usage.percentages.bandwidth}
        />

        <UsageItem
          icon={Sparkles}
          label="AI Requests"
          current={usage.aiRequests.toString()}
          limit="1,000"
          percentage={usage.percentages.aiRequests}
          unit="requests"
        />
      </CardContent>
    </Card>
  );
}

interface UsageOverviewProps {
  usage: UsageSummary;
}

export function UsageOverview({ usage }: UsageOverviewProps) {
  const usageItems = [
    {
      icon: HardDrive,
      label: 'Storage',
      value: formatBytes(usage.storageUsed),
      limit: usage.limits.storage === -1 ? 'Unlimited' : formatBytes(usage.limits.storage),
      percentage: usage.percentages.storage,
    },
    {
      icon: Video,
      label: 'Videos',
      value: usage.videosUploaded.toString(),
      limit: formatLimit(usage.limits.videos),
      percentage: usage.percentages.videos,
    },
    {
      icon: Users,
      label: 'Bandwidth',
      value: formatBytes(usage.bandwidthUsed),
      limit: usage.limits.bandwidth === -1 ? 'Unlimited' : formatBytes(usage.limits.bandwidth),
      percentage: usage.percentages.bandwidth,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {usageItems.map((item) => (
        <Card key={item.label}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
            <item.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{item.value}</div>
            <p className="text-xs text-muted-foreground">of {item.limit}</p>
            {item.limit !== 'Unlimited' && (
              <Progress
                value={item.percentage}
                className={cn('mt-2 h-1', item.percentage >= 90 && '[&>div]:bg-destructive')}
              />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
