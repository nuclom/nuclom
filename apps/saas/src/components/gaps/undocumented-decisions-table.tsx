'use client';

import { cn } from '@nuclom/lib/utils';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface UndocumentedDecision {
  decision: {
    id: string;
    title: string;
    status: string;
    decidedAt: string | null;
  };
  gapType: 'no_documentation' | 'no_implementation' | 'no_evidence' | 'stale';
  severity: 'high' | 'medium' | 'low';
  suggestion: string;
}

interface UndocumentedDecisionsTableProps {
  gaps: UndocumentedDecision[] | undefined;
  isLoading: boolean;
}

const gapTypeLabels: Record<string, string> = {
  no_documentation: 'No Documentation',
  no_implementation: 'No Implementation',
  no_evidence: 'No Evidence',
  stale: 'Stale',
};

const severityIcons: Record<string, React.ElementType> = {
  high: AlertCircle,
  medium: AlertTriangle,
  low: Info,
};

const severityColors: Record<string, string> = {
  high: 'text-destructive',
  medium: 'text-yellow-500',
  low: 'text-blue-500',
};

export function UndocumentedDecisionsTable({ gaps, isLoading }: UndocumentedDecisionsTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!gaps || gaps.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No knowledge gaps detected</p>
        <p className="text-sm">All decisions appear to be well documented</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Severity</TableHead>
          <TableHead>Decision</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Gap Type</TableHead>
          <TableHead className="hidden md:table-cell">Suggestion</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {gaps.map((gap) => {
          const Icon = severityIcons[gap.severity];
          return (
            <TableRow key={gap.decision.id}>
              <TableCell>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Icon className={cn('h-5 w-5', severityColors[gap.severity])} />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="capitalize">{gap.severity} severity</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableCell>
              <TableCell className="font-medium max-w-[200px] truncate">{gap.decision.title}</TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">
                  {gap.decision.status}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{gapTypeLabels[gap.gapType]}</Badge>
              </TableCell>
              <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[300px] truncate">
                {gap.suggestion}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
