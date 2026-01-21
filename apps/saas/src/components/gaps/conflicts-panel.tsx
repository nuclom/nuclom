'use client';

import { cn } from '@nuclom/lib/utils';
import { GitCompare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface DecisionConflict {
  items: [
    { id: string; title: string; decidedAt: string | null },
    { id: string; title: string; decidedAt: string | null },
  ];
  conflictType: 'direct_contradiction' | 'supersession_unclear' | 'scope_overlap';
  confidence: number;
  explanation: string;
}

interface ConflictsPanelProps {
  conflicts: DecisionConflict[] | undefined;
  isLoading: boolean;
}

const conflictTypeLabels: Record<string, string> = {
  direct_contradiction: 'Contradiction',
  supersession_unclear: 'Supersession Unclear',
  scope_overlap: 'Scope Overlap',
};

const conflictTypeColors: Record<string, string> = {
  direct_contradiction: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  supersession_unclear: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  scope_overlap: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

export function ConflictsPanel({ conflicts, isLoading }: ConflictsPanelProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (!conflicts || conflicts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <GitCompare className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No conflicts detected</p>
        <p className="text-sm">Your decisions appear to be consistent</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {conflicts.map((conflict, index) => (
        <Card key={index}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-2">
                  <Badge className={cn(conflictTypeColors[conflict.conflictType])}>
                    {conflictTypeLabels[conflict.conflictType]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(conflict.confidence * 100)}% confidence
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Decision 1</p>
                    <p className="text-sm font-medium">{conflict.items[0].title}</p>
                    {conflict.items[0].decidedAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(conflict.items[0].decidedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Decision 2</p>
                    <p className="text-sm font-medium">{conflict.items[1].title}</p>
                    {conflict.items[1].decidedAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(conflict.items[1].decidedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">{conflict.explanation}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
