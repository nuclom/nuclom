'use client';

import { cn } from '@nuclom/lib/utils';
import { Button } from '@nuclom/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@nuclom/ui/toggle-group';

// =============================================================================
// Types
// =============================================================================

export type FeedFilterType = 'all' | 'content' | 'decisions' | 'topics';
export type SourceFilter = 'all' | 'slack' | 'notion' | 'github';

interface FeedFiltersProps {
  selectedType: FeedFilterType;
  selectedSource: SourceFilter;
  onTypeChange: (type: FeedFilterType) => void;
  onSourceChange: (source: SourceFilter) => void;
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export function FeedFilters({
  selectedType,
  selectedSource,
  onTypeChange,
  onSourceChange,
  className,
}: FeedFiltersProps) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      {/* Type filters */}
      <ToggleGroup
        type="single"
        value={selectedType}
        onValueChange={(value) => value && onTypeChange(value as FeedFilterType)}
        className="justify-start"
      >
        <ToggleGroupItem value="all" aria-label="All items">
          All
        </ToggleGroupItem>
        <ToggleGroupItem value="content" aria-label="Content items">
          Content
        </ToggleGroupItem>
        <ToggleGroupItem value="decisions" aria-label="Decisions">
          Decisions
        </ToggleGroupItem>
        <ToggleGroupItem value="topics" aria-label="Topics">
          Topics
        </ToggleGroupItem>
      </ToggleGroup>

      {/* Source filters - only show when content is selected or all */}
      {(selectedType === 'all' || selectedType === 'content') && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Source:</span>
          <div className="flex gap-1">
            <Button
              variant={selectedSource === 'all' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onSourceChange('all')}
            >
              All
            </Button>
            <Button
              variant={selectedSource === 'slack' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onSourceChange('slack')}
              className="text-purple-600 dark:text-purple-400"
            >
              Slack
            </Button>
            <Button
              variant={selectedSource === 'notion' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onSourceChange('notion')}
              className="text-amber-600 dark:text-amber-400"
            >
              Notion
            </Button>
            <Button
              variant={selectedSource === 'github' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onSourceChange('github')}
              className="text-slate-600 dark:text-slate-400"
            >
              GitHub
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
