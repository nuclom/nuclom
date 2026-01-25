'use client';

import { cn } from '@nuclom/lib/utils';
import { Card, CardContent } from '@nuclom/ui/card';
import { Skeleton } from '@nuclom/ui/skeleton';
import { ArrowDown, ArrowRight, ArrowUp, TrendingUp } from 'lucide-react';

interface TrendAnalysis {
  topic: string;
  direction: 'increasing' | 'decreasing' | 'stable';
  changePercentage: number;
  period: string;
}

interface TrendsSectionProps {
  trends: TrendAnalysis[] | undefined;
  isLoading: boolean;
}

const directionIcons: Record<string, React.ElementType> = {
  increasing: ArrowUp,
  decreasing: ArrowDown,
  stable: ArrowRight,
};

const directionColors: Record<string, string> = {
  increasing: 'text-green-600 dark:text-green-400',
  decreasing: 'text-red-600 dark:text-red-400',
  stable: 'text-gray-600 dark:text-gray-400',
};

const directionBgColors: Record<string, string> = {
  increasing: 'bg-green-100 dark:bg-green-900/30',
  decreasing: 'bg-red-100 dark:bg-red-900/30',
  stable: 'bg-gray-100 dark:bg-gray-800/30',
};

export function TrendsSection({ trends, isLoading }: TrendsSectionProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!trends || trends.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No trends available</p>
        <p className="text-sm">Trends will appear as your knowledge base accumulates history</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {trends.map((trend, index) => {
        const Icon = directionIcons[trend.direction];
        return (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn('rounded-full p-2', directionBgColors[trend.direction])}>
                  <Icon className={cn('h-4 w-4', directionColors[trend.direction])} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{trend.topic}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={cn('font-medium', directionColors[trend.direction])}>
                      {trend.direction === 'increasing' && '+'}
                      {trend.direction === 'decreasing' && '-'}
                      {Math.abs(trend.changePercentage)}%
                    </span>
                    <span>•</span>
                    <span>{trend.period}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
