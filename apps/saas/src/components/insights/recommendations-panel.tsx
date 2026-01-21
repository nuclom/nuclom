'use client';

import { cn } from '@nuclom/lib/utils';
import { ChevronRight, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface Recommendation {
  recommendation: string;
  reasoning: string;
  impact: 'high' | 'medium' | 'low';
}

interface RecommendationsPanelProps {
  recommendations: Recommendation[] | undefined;
  isLoading: boolean;
}

const impactColors: Record<string, string> = {
  high: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  low: 'bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400',
};

export function RecommendationsPanel({ recommendations, isLoading }: RecommendationsPanelProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No recommendations yet</p>
        <p className="text-sm">Add more content sources to get personalized recommendations</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {recommendations.map((rec, index) => (
        <Card key={index} className="hover:bg-muted/50 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'shrink-0 rounded-full p-2',
                  rec.impact === 'high' && 'bg-green-100 dark:bg-green-900/30',
                  rec.impact === 'medium' && 'bg-yellow-100 dark:bg-yellow-900/30',
                  rec.impact === 'low' && 'bg-gray-100 dark:bg-gray-800/30',
                )}
              >
                <ChevronRight
                  className={cn(
                    'h-4 w-4',
                    rec.impact === 'high' && 'text-green-600 dark:text-green-400',
                    rec.impact === 'medium' && 'text-yellow-600 dark:text-yellow-400',
                    rec.impact === 'low' && 'text-gray-600 dark:text-gray-400',
                  )}
                />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{rec.recommendation}</p>
                  <Badge className={cn('shrink-0', impactColors[rec.impact])}>
                    {rec.impact.charAt(0).toUpperCase() + rec.impact.slice(1)} Impact
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{rec.reasoning}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
