'use client';

import { cn } from '@nuclom/lib/utils';
import { Loader2, RefreshCw } from 'lucide-react';
import { useCallback, useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DecisionCard, type DecisionData } from './decision-card';

// =============================================================================
// Types
// =============================================================================

interface DecisionDashboardProps {
  organizationId: string;
  className?: string;
}

interface DecisionsResponse {
  decisions: DecisionData[];
  page: number;
  limit: number;
  hasMore: boolean;
}

type StatusFilter = 'all' | 'proposed' | 'decided' | 'revisited' | 'superseded';

// =============================================================================
// Fetcher
// =============================================================================

const fetcher = async (url: string): Promise<DecisionsResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch decisions');
  }
  return response.json();
};

// =============================================================================
// Component
// =============================================================================

export function DecisionDashboard({ organizationId, className }: DecisionDashboardProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Build URL with filters - using useCallback for consistent SWR cache keys
  const buildUrl = useCallback(() => {
    const params = new URLSearchParams({ organizationId, limit: '50' });
    if (statusFilter !== 'all') {
      params.set('status', statusFilter);
    }
    return `/api/knowledge/decisions?${params.toString()}`;
  }, [organizationId, statusFilter]);

  const { data, error, isLoading, mutate } = useSWR<DecisionsResponse>(buildUrl(), fetcher);

  // Group decisions by status for the board view
  const proposedDecisions = data?.decisions.filter((d) => d.status === 'proposed') || [];
  const decidedDecisions = data?.decisions.filter((d) => d.status === 'decided') || [];
  const revisitedDecisions = data?.decisions.filter((d) => d.status === 'revisited') || [];
  const supersededDecisions = data?.decisions.filter((d) => d.status === 'superseded') || [];

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Decisions</h1>
          <p className="text-muted-foreground">Track and manage decisions made across your organization</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isLoading}>
          <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* View tabs */}
      <Tabs defaultValue="board" className="w-full">
        <TabsList>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
        </TabsList>

        {/* Board view - Kanban style */}
        <TabsContent value="board" className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-sm text-destructive">Failed to load decisions.</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => mutate()}>
                Retry
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Proposed column */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-yellow-600 dark:text-yellow-400">Proposed</h3>
                  <span className="text-sm text-muted-foreground">{proposedDecisions.length}</span>
                </div>
                <div className="space-y-3 min-h-[200px] p-3 rounded-lg bg-yellow-50/50 dark:bg-yellow-900/10">
                  {proposedDecisions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No proposed decisions</p>
                  ) : (
                    proposedDecisions.map((decision) => <DecisionCard key={decision.id} decision={decision} />)
                  )}
                </div>
              </div>

              {/* Decided column */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-green-600 dark:text-green-400">Decided</h3>
                  <span className="text-sm text-muted-foreground">{decidedDecisions.length}</span>
                </div>
                <div className="space-y-3 min-h-[200px] p-3 rounded-lg bg-green-50/50 dark:bg-green-900/10">
                  {decidedDecisions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No decided items</p>
                  ) : (
                    decidedDecisions.map((decision) => <DecisionCard key={decision.id} decision={decision} />)
                  )}
                </div>
              </div>

              {/* Revisited column */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-blue-600 dark:text-blue-400">Revisited</h3>
                  <span className="text-sm text-muted-foreground">{revisitedDecisions.length}</span>
                </div>
                <div className="space-y-3 min-h-[200px] p-3 rounded-lg bg-blue-50/50 dark:bg-blue-900/10">
                  {revisitedDecisions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No revisited items</p>
                  ) : (
                    revisitedDecisions.map((decision) => <DecisionCard key={decision.id} decision={decision} />)
                  )}
                </div>
              </div>

              {/* Superseded column */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-600 dark:text-gray-400">Superseded</h3>
                  <span className="text-sm text-muted-foreground">{supersededDecisions.length}</span>
                </div>
                <div className="space-y-3 min-h-[200px] p-3 rounded-lg bg-gray-50/50 dark:bg-gray-800/20">
                  {supersededDecisions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No superseded items</p>
                  ) : (
                    supersededDecisions.map((decision) => <DecisionCard key={decision.id} decision={decision} />)
                  )}
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* List view */}
        <TabsContent value="list" className="mt-6">
          {/* Filter tabs */}
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)} className="mb-6">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="proposed">Proposed</TabsTrigger>
              <TabsTrigger value="decided">Decided</TabsTrigger>
              <TabsTrigger value="revisited">Revisited</TabsTrigger>
              <TabsTrigger value="superseded">Superseded</TabsTrigger>
            </TabsList>
          </Tabs>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-sm text-destructive">Failed to load decisions.</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => mutate()}>
                Retry
              </Button>
            </div>
          ) : data?.decisions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No decisions found. Decisions will appear here as they're discovered from your content.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data?.decisions.map((decision) => (
                <DecisionCard key={decision.id} decision={decision} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
