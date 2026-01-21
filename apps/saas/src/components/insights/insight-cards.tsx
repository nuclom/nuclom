'use client';

import { cn } from '@nuclom/lib/utils';
import { AlertTriangle, ArrowUpRight, Lightbulb, Link2, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface ProactiveInsight {
  insight: string;
  type: 'trend' | 'opportunity' | 'risk' | 'connection';
  confidence: number;
  evidence: string[];
  actionItems: string[];
}

interface InsightCardsProps {
  insights: ProactiveInsight[] | undefined;
  isLoading: boolean;
}

const typeIcons: Record<string, React.ElementType> = {
  trend: TrendingUp,
  opportunity: ArrowUpRight,
  risk: AlertTriangle,
  connection: Link2,
};

const typeColors: Record<string, string> = {
  trend: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  opportunity: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  risk: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  connection: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

const typeLabels: Record<string, string> = {
  trend: 'Trend',
  opportunity: 'Opportunity',
  risk: 'Risk',
  connection: 'Connection',
};

export function InsightCards({ insights, isLoading }: InsightCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  if (!insights || insights.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No insights yet</p>
        <p className="text-sm">As your knowledge base grows, insights will appear here</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {insights.map((insight, index) => {
        const Icon = typeIcons[insight.type] || Lightbulb;
        const confidencePercent = Math.round(insight.confidence * 100);

        return (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge className={cn(typeColors[insight.type])}>
                    <Icon className="h-3 w-3 mr-1" />
                    {typeLabels[insight.type]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{confidencePercent}% confidence</span>
                </div>

                <p className="text-sm font-medium">{insight.insight}</p>

                {insight.evidence.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">Evidence:</p>
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {insight.evidence.slice(0, 3).map((e, i) => (
                        <li key={i} className="flex items-start gap-1">
                          <span className="shrink-0">•</span>
                          <span>{e}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {insight.actionItems.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">Action items:</p>
                    <ul className="text-xs space-y-0.5">
                      {insight.actionItems.slice(0, 2).map((item, i) => (
                        <li key={i} className="flex items-start gap-1">
                          <span className="shrink-0 text-primary">→</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
