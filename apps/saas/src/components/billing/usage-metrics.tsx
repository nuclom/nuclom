'use client';

import type { UsageSummary } from '@nuclom/lib/effect/services/billing-repository';
import { cn } from '@nuclom/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@nuclom/ui/alert';
import { Badge } from '@nuclom/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nuclom/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@nuclom/ui/tooltip';
import { AlertTriangle, HardDrive, Sparkles, TrendingUp, Video, Wifi } from 'lucide-react';

interface UsageMetricsProps {
  usage: UsageSummary;
  className?: string;
}

// =============================================================================
// Utility Functions
// =============================================================================

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const formatNumber = (value: number): string => {
  return value.toLocaleString();
};

const formatCurrency = (cents: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
};

// =============================================================================
// Segmented Usage Bar Component
// =============================================================================

interface UsageBarProps {
  used: number;
  limit: number;
  overage: number;
  formatValue: (value: number) => string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

function UsageBar({ used, limit, overage, formatValue, label, icon: Icon }: UsageBarProps) {
  const isUnlimited = limit === -1;

  if (isUnlimited) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{label}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{formatValue(used)}</span>
            <Badge variant="secondary" className="text-xs">
              Unlimited
            </Badge>
          </div>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary/30 w-full" />
        </div>
      </div>
    );
  }

  // Calculate percentages for the segmented bar
  const usedWithinLimit = Math.min(used, limit);
  const usedPercentage = Math.min((usedWithinLimit / limit) * 100, 100);
  const overagePercentage = overage > 0 ? Math.min((overage / limit) * 30, 30) : 0; // Cap overage visual at 30%
  const remainingPercentage = Math.max(100 - usedPercentage, 0);

  // Determine status
  const totalUsedPercentage = (used / limit) * 100;
  const hasOverage = overage > 0;
  const isNearLimit = totalUsedPercentage >= 80 && !hasOverage;
  const isAtLimit = totalUsedPercentage >= 100 && !hasOverage;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm">
            <span className="font-semibold">{formatValue(used)}</span>
            <span className="text-muted-foreground"> / {formatValue(limit)}</span>
          </span>
          {hasOverage && (
            <Badge variant="destructive" className="text-xs">
              +{formatValue(overage)} overage
            </Badge>
          )}
          {isAtLimit && !hasOverage && (
            <Badge variant="outline" className="text-xs border-orange-500 text-orange-500">
              At limit
            </Badge>
          )}
          {isNearLimit && !isAtLimit && (
            <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-500">
              {Math.round(totalUsedPercentage)}%
            </Badge>
          )}
        </div>
      </div>

      {/* Segmented Bar */}
      <TooltipProvider>
        <div className="relative h-3 rounded-full bg-muted overflow-hidden flex">
          {/* Used portion (within limit) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'h-full transition-all duration-300',
                  hasOverage
                    ? 'bg-primary'
                    : isAtLimit
                      ? 'bg-orange-500'
                      : isNearLimit
                        ? 'bg-yellow-500'
                        : 'bg-primary',
                )}
                style={{ width: `${usedPercentage}%` }}
              />
            </TooltipTrigger>
            <TooltipContent>
              <p>
                Used: {formatValue(usedWithinLimit)} ({Math.round(usedPercentage)}%)
              </p>
            </TooltipContent>
          </Tooltip>

          {/* Overage portion */}
          {hasOverage && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="h-full bg-destructive transition-all duration-300"
                  style={{ width: `${overagePercentage}%` }}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>Overage: {formatValue(overage)}</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Remaining portion */}
          {remainingPercentage > 0 && !hasOverage && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="h-full bg-muted transition-all duration-300"
                  style={{ width: `${remainingPercentage}%` }}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>Remaining: {formatValue(limit - usedWithinLimit)}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </TooltipProvider>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span>Used</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-muted border" />
          <span>Remaining</span>
        </div>
        {hasOverage && (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-destructive" />
            <span>Overage</span>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Main Usage Metrics Component
// =============================================================================

export function UsageMetrics({ usage, className }: UsageMetricsProps) {
  const metrics = [
    {
      label: 'Storage',
      icon: HardDrive,
      used: usage.storageUsed,
      limit: usage.limits.storage,
      overage: usage.overage.storage,
      formatValue: formatBytes,
    },
    {
      label: 'Videos Uploaded',
      icon: Video,
      used: usage.videosUploaded,
      limit: usage.limits.videos,
      overage: usage.overage.videos,
      formatValue: formatNumber,
    },
    {
      label: 'Bandwidth',
      icon: Wifi,
      used: usage.bandwidthUsed,
      limit: usage.limits.bandwidth,
      overage: usage.overage.bandwidth,
      formatValue: formatBytes,
    },
    {
      label: 'AI Requests',
      icon: Sparkles,
      used: usage.aiRequests,
      limit: 1000, // Default AI request limit
      overage: usage.overage.aiRequests,
      formatValue: formatNumber,
    },
  ];

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Usage This Month
            </CardTitle>
            <CardDescription>Track your resource consumption and overage charges</CardDescription>
          </div>
          {usage.hasOverage && usage.overageCharges > 0 && (
            <Badge variant="destructive" className="text-sm">
              {formatCurrency(usage.overageCharges)} overage
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overage Alert */}
        {usage.hasOverage && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Overage Charges</AlertTitle>
            <AlertDescription>
              You have exceeded your plan limits. Additional charges of {formatCurrency(usage.overageCharges)} will be
              added to your next invoice.
            </AlertDescription>
          </Alert>
        )}

        {/* Usage Bars */}
        {metrics.map((metric) => (
          <UsageBar
            key={metric.label}
            label={metric.label}
            icon={metric.icon}
            used={metric.used}
            limit={metric.limit}
            overage={metric.overage}
            formatValue={metric.formatValue}
          />
        ))}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Compact Usage Cards (for dashboard overview)
// =============================================================================

interface UsageCardsProps {
  usage: UsageSummary;
  className?: string;
}

export function UsageCards({ usage, className }: UsageCardsProps) {
  const cards = [
    {
      label: 'Storage',
      icon: HardDrive,
      used: usage.storageUsed,
      limit: usage.limits.storage,
      overage: usage.overage.storage,
      formatValue: formatBytes,
      percentage: usage.percentages.storage,
    },
    {
      label: 'Videos',
      icon: Video,
      used: usage.videosUploaded,
      limit: usage.limits.videos,
      overage: usage.overage.videos,
      formatValue: formatNumber,
      percentage: usage.percentages.videos,
    },
    {
      label: 'Bandwidth',
      icon: Wifi,
      used: usage.bandwidthUsed,
      limit: usage.limits.bandwidth,
      overage: usage.overage.bandwidth,
      formatValue: formatBytes,
      percentage: usage.percentages.bandwidth,
    },
    {
      label: 'AI Requests',
      icon: Sparkles,
      used: usage.aiRequests,
      limit: 1000,
      overage: usage.overage.aiRequests,
      formatValue: formatNumber,
      percentage: usage.percentages.aiRequests,
    },
  ];

  return (
    <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-4', className)}>
      {cards.map((card) => {
        const isUnlimited = card.limit === -1;
        const hasOverage = card.overage > 0;
        const isNearLimit = card.percentage >= 80 && !hasOverage;

        return (
          <Card key={card.label} className={cn(hasOverage && 'border-destructive')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
              <card.icon className={cn('h-4 w-4', hasOverage ? 'text-destructive' : 'text-muted-foreground')} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.formatValue(card.used)}</div>
              <p className="text-xs text-muted-foreground">
                {isUnlimited ? 'Unlimited' : `of ${card.formatValue(card.limit)}`}
              </p>

              {/* Mini progress bar */}
              {!isUnlimited && (
                <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden flex">
                  <div
                    className={cn(
                      'h-full transition-all',
                      hasOverage ? 'bg-primary' : isNearLimit ? 'bg-orange-500' : 'bg-primary',
                    )}
                    style={{ width: `${Math.min(card.percentage, 100)}%` }}
                  />
                  {hasOverage && (
                    <div
                      className="h-full bg-destructive"
                      style={{ width: `${Math.min((card.overage / card.limit) * 20, 20)}%` }}
                    />
                  )}
                </div>
              )}

              {/* Overage indicator */}
              {hasOverage && (
                <p className="mt-1 text-xs text-destructive font-medium">+{card.formatValue(card.overage)} overage</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
