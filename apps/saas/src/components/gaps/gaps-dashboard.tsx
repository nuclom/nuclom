'use client';

import { cn } from '@nuclom/lib/utils';
import { AlertTriangle, GitCompare, LayoutGrid } from 'lucide-react';
import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConflictsPanel } from './conflicts-panel';
import { CoverageAnalysis } from './coverage-analysis';
import { UndocumentedDecisionsTable } from './undocumented-decisions-table';

interface GapsDashboardProps {
  organizationId: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function GapsDashboard({ organizationId }: GapsDashboardProps) {
  const [activeTab, setActiveTab] = useState('gaps');

  const { data: gaps, isLoading: gapsLoading } = useSWR(`/api/ai/gaps?organizationId=${organizationId}`, fetcher);

  const { data: conflicts, isLoading: conflictsLoading } = useSWR(
    `/api/ai/gaps/conflicts?organizationId=${organizationId}`,
    fetcher,
  );

  const { data: coverage, isLoading: coverageLoading } = useSWR(
    `/api/ai/gaps/coverage?organizationId=${organizationId}`,
    fetcher,
  );

  const highSeverityCount = Array.isArray(gaps)
    ? gaps.filter((g: { severity: string }) => g.severity === 'high').length
    : 0;
  const conflictCount = Array.isArray(conflicts) ? conflicts.length : 0;
  const lowCoverageCount = Array.isArray(coverage)
    ? coverage.filter((c: { coverageScore: number }) => c.coverageScore < 0.5).length
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Knowledge Gaps</h1>
        <p className="text-muted-foreground">Identify undocumented decisions, conflicts, and areas needing attention</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          className={cn('cursor-pointer transition-colors hover:bg-muted/50', activeTab === 'gaps' && 'border-primary')}
          onClick={() => setActiveTab('gaps')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Undocumented Decisions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{gapsLoading ? '-' : Array.isArray(gaps) ? gaps.length : 0}</div>
            {highSeverityCount > 0 && <p className="text-xs text-destructive">{highSeverityCount} high severity</p>}
          </CardContent>
        </Card>

        <Card
          className={cn(
            'cursor-pointer transition-colors hover:bg-muted/50',
            activeTab === 'conflicts' && 'border-primary',
          )}
          onClick={() => setActiveTab('conflicts')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <GitCompare className="h-4 w-4 text-orange-500" />
              Decision Conflicts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conflictsLoading ? '-' : conflictCount}</div>
            <p className="text-xs text-muted-foreground">Potential contradictions</p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            'cursor-pointer transition-colors hover:bg-muted/50',
            activeTab === 'coverage' && 'border-primary',
          )}
          onClick={() => setActiveTab('coverage')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-blue-500" />
              Topic Coverage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{coverageLoading ? '-' : lowCoverageCount}</div>
            <p className="text-xs text-muted-foreground">Topics with low coverage</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="gaps">Undocumented</TabsTrigger>
          <TabsTrigger value="conflicts">Conflicts</TabsTrigger>
          <TabsTrigger value="coverage">Coverage</TabsTrigger>
        </TabsList>

        <TabsContent value="gaps" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Undocumented Decisions</CardTitle>
              <CardDescription>
                Decisions that lack proper documentation, implementation evidence, or supporting context
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UndocumentedDecisionsTable gaps={gaps} isLoading={gapsLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conflicts" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Decision Conflicts</CardTitle>
              <CardDescription>
                Potential contradictions or overlaps between decisions that may need resolution
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConflictsPanel conflicts={conflicts} isLoading={conflictsLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="coverage" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Topic Coverage Analysis</CardTitle>
              <CardDescription>
                Topics that have limited content coverage and may need more documentation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CoverageAnalysis coverage={coverage} isLoading={coverageLoading} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
