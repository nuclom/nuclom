'use client';

import { cn } from '@nuclom/lib/utils';
import { Card, CardContent } from '@nuclom/ui/card';
import { Progress } from '@nuclom/ui/progress';
import { Skeleton } from '@nuclom/ui/skeleton';
import { LayoutGrid } from 'lucide-react';

interface TopicCoverageGap {
  topic: {
    id: string;
    name: string;
    contentCount: number;
  };
  coverageScore: number;
  gaps: string[];
  recommendation: string;
}

interface CoverageAnalysisProps {
  coverage: TopicCoverageGap[] | undefined;
  isLoading: boolean;
}

export function CoverageAnalysis({ coverage, isLoading }: CoverageAnalysisProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!coverage || coverage.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <LayoutGrid className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>All topics have good coverage</p>
        <p className="text-sm">No topics with low documentation coverage detected</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {coverage.map((item) => {
        const percentage = Math.round(item.coverageScore * 100);
        return (
          <Card key={item.topic.id}>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{item.topic.name}</h4>
                    <p className="text-xs text-muted-foreground">{item.topic.contentCount} content items</p>
                  </div>
                  <span
                    className={cn(
                      'text-sm font-medium',
                      percentage >= 70 && 'text-green-600 dark:text-green-400',
                      percentage >= 40 && percentage < 70 && 'text-yellow-600 dark:text-yellow-400',
                      percentage < 40 && 'text-red-600 dark:text-red-400',
                    )}
                  >
                    {percentage}%
                  </span>
                </div>

                <Progress
                  value={percentage}
                  className={cn(
                    'h-2',
                    percentage >= 70 && '[&>div]:bg-green-500',
                    percentage >= 40 && percentage < 70 && '[&>div]:bg-yellow-500',
                    percentage < 40 && '[&>div]:bg-red-500',
                  )}
                />

                {item.gaps.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Gaps:</span> {item.gaps.join(', ')}
                  </div>
                )}

                <p className="text-sm text-muted-foreground">{item.recommendation}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
