'use client';

/**
 * Notion Page Selector Component
 *
 * A complete component for selecting which Notion pages and databases to sync.
 * Fetches hierarchy data via SWR and manages selection state.
 */

import { cn } from '@nuclom/lib/utils';
import { Button } from '@nuclom/ui/button';
import { ScrollArea } from '@nuclom/ui/scroll-area';
import { AlertCircle, Check, Loader2, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { type NotionPageTreeNode, NotionTreeView } from './notion-tree-view';

// =============================================================================
// Types
// =============================================================================

interface NotionHierarchyResponse {
  tree: NotionPageTreeNode[];
  totalCount: number;
  selectedCount: number;
}

export interface NotionPageSelectorProps {
  sourceId: string;
  onSelectionChange?: (selectedPageIds: string[]) => void;
  onSave?: () => void;
  className?: string;
}

// =============================================================================
// Fetcher
// =============================================================================

const fetcher = async (url: string): Promise<NotionHierarchyResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch hierarchy');
  }
  return response.json();
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get all page IDs from the tree
 */
function getAllPageIds(nodes: NotionPageTreeNode[]): string[] {
  const ids: string[] = [];
  const traverse = (node: NotionPageTreeNode) => {
    ids.push(node.pageId);
    if (node.children) {
      node.children.forEach(traverse);
    }
  };
  nodes.forEach(traverse);
  return ids;
}

/**
 * Get initially selected page IDs from the tree
 */
function getInitialSelectedIds(nodes: NotionPageTreeNode[]): Set<string> {
  const ids = new Set<string>();
  const traverse = (node: NotionPageTreeNode) => {
    if (node.isSelected) {
      ids.add(node.pageId);
    }
    if (node.children) {
      node.children.forEach(traverse);
    }
  };
  nodes.forEach(traverse);
  return ids;
}

// =============================================================================
// Component
// =============================================================================

export function NotionPageSelector({ sourceId, onSelectionChange, onSave, className }: NotionPageSelectorProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [initialSelectedIds, setInitialSelectedIds] = useState<Set<string>>(new Set());

  // Fetch hierarchy data
  const { data, error, isLoading, mutate } = useSWR<NotionHierarchyResponse>(
    `/api/content/sources/${sourceId}/notion/hierarchy`,
    fetcher,
    {
      revalidateOnFocus: false,
    },
  );

  // Refresh from Notion API
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await mutate(fetcher(`/api/content/sources/${sourceId}/notion/hierarchy?refresh=true`), { revalidate: false });
    } finally {
      setRefreshing(false);
    }
  }, [sourceId, mutate]);

  // Initialize selected IDs from data
  useEffect(() => {
    if (data?.tree) {
      const initial = getInitialSelectedIds(data.tree);
      setSelectedIds(initial);
      setInitialSelectedIds(initial);
      setHasChanges(false);
    }
  }, [data?.tree]);

  // Track changes
  useEffect(() => {
    if (initialSelectedIds.size > 0 || selectedIds.size > 0) {
      const initialArray = Array.from(initialSelectedIds).sort();
      const currentArray = Array.from(selectedIds).sort();
      const changed =
        initialArray.length !== currentArray.length || initialArray.some((id, idx) => id !== currentArray[idx]);
      setHasChanges(changed);
    }
  }, [selectedIds, initialSelectedIds]);

  // Handle selection change for single item
  const handleSelectionChange = useCallback(
    (pageId: string, selected: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (selected) {
          next.add(pageId);
        } else {
          next.delete(pageId);
        }
        return next;
      });
      onSelectionChange?.(Array.from(selectedIds));
    },
    [onSelectionChange, selectedIds],
  );

  // Handle selection change for multiple items
  const handleSelectAll = useCallback((pageIds: string[], selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of pageIds) {
        if (selected) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }
      return next;
    });
  }, []);

  // Handle expand change
  const handleExpandChange = useCallback((pageId: string, expanded: boolean) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (expanded) {
        next.add(pageId);
      } else {
        next.delete(pageId);
      }
      return next;
    });
  }, []);

  // Select all / deselect all
  const allPageIds = useMemo(() => (data?.tree ? getAllPageIds(data.tree) : []), [data?.tree]);
  const allSelected = selectedIds.size === allPageIds.length && allPageIds.length > 0;
  const noneSelected = selectedIds.size === 0;

  const handleSelectAllClick = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allPageIds));
    }
  }, [allSelected, allPageIds]);

  // Expand all / collapse all
  const handleExpandAllClick = useCallback(() => {
    if (expandedIds.size > 0) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(new Set(allPageIds));
    }
  }, [expandedIds.size, allPageIds]);

  // Save selection
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);

    try {
      const response = await fetch(`/api/content/sources/${sourceId}/notion/hierarchy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedPageIds: Array.from(selectedIds),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save selection');
      }

      setInitialSelectedIds(new Set(selectedIds));
      setHasChanges(false);
      onSave?.();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [sourceId, selectedIds, onSave]);

  // Error state
  if (error) {
    return (
      <div className={cn('border rounded-lg p-4', className)}>
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">Failed to load Notion pages</span>
        </div>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => mutate()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <h3 className="font-medium text-sm">Select Pages to Sync</h3>
          {data && (
            <span className="text-xs text-muted-foreground">
              {selectedIds.size} of {data.totalCount} selected
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleExpandAllClick} disabled={isLoading || refreshing}>
            {expandedIds.size > 0 ? 'Collapse All' : 'Expand All'}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleSelectAllClick} disabled={isLoading || refreshing}>
            {allSelected ? 'Deselect All' : 'Select All'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading || refreshing}>
            <RefreshCw className={cn('h-4 w-4 mr-2', refreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tree View */}
      <ScrollArea className="h-80">
        <div className="p-2">
          <NotionTreeView
            nodes={data?.tree || []}
            selectedIds={selectedIds}
            expandedIds={expandedIds}
            onSelectionChange={handleSelectionChange}
            onSelectAll={handleSelectAll}
            onExpandChange={handleExpandChange}
            loading={isLoading || refreshing}
          />
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
        <div className="flex items-center gap-2">
          {saveError && (
            <div className="flex items-center gap-1 text-destructive text-xs">
              <AlertCircle className="h-3 w-3" />
              {saveError}
            </div>
          )}
          {!saveError && hasChanges && <span className="text-xs text-muted-foreground">You have unsaved changes</span>}
          {!saveError && !hasChanges && selectedIds.size > 0 && (
            <div className="flex items-center gap-1 text-green-600 text-xs">
              <Check className="h-3 w-3" />
              Selection saved
            </div>
          )}
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges || noneSelected}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Selection'
          )}
        </Button>
      </div>
    </div>
  );
}

export default NotionPageSelector;
