'use client';

/**
 * Notion Tree View Component
 *
 * A recursive tree view component for displaying Notion page hierarchy.
 * Supports expandable nodes, checkboxes for selection, and visual differentiation
 * between pages and databases.
 */

import { cn } from '@nuclom/lib/utils';
import { Checkbox } from '@nuclom/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@nuclom/ui/collapsible';
import { ChevronRight, Database, FileText, Loader2 } from 'lucide-react';
import { useCallback, useState } from 'react';

// =============================================================================
// Types
// =============================================================================

export interface NotionPageTreeNode {
  id: string;
  pageId: string;
  title: string;
  type: 'page' | 'database';
  icon?: string;
  children?: NotionPageTreeNode[];
  isSelected: boolean;
  depth: number;
  isArchived: boolean;
}

export interface NotionTreeViewProps {
  nodes: NotionPageTreeNode[];
  selectedIds: Set<string>;
  onSelectionChange: (pageId: string, selected: boolean) => void;
  onSelectAll?: (pageIds: string[], selected: boolean) => void;
  expandedIds?: Set<string>;
  onExpandChange?: (pageId: string, expanded: boolean) => void;
  loading?: boolean;
  className?: string;
}

interface TreeNodeProps {
  node: NotionPageTreeNode;
  selectedIds: Set<string>;
  expandedIds: Set<string>;
  onSelectionChange: (pageId: string, selected: boolean) => void;
  onSelectAll?: (pageIds: string[], selected: boolean) => void;
  onExpandChange: (pageId: string, expanded: boolean) => void;
  level: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get all page IDs from a node and its descendants
 */
function getAllDescendantIds(node: NotionPageTreeNode): string[] {
  const ids = [node.pageId];
  if (node.children) {
    for (const child of node.children) {
      ids.push(...getAllDescendantIds(child));
    }
  }
  return ids;
}

/**
 * Check if all descendants are selected
 */
function areAllDescendantsSelected(node: NotionPageTreeNode, selectedIds: Set<string>): boolean {
  if (!selectedIds.has(node.pageId)) return false;
  if (node.children) {
    return node.children.every((child) => areAllDescendantsSelected(child, selectedIds));
  }
  return true;
}

/**
 * Check if some descendants are selected
 */
function areSomeDescendantsSelected(node: NotionPageTreeNode, selectedIds: Set<string>): boolean {
  if (selectedIds.has(node.pageId)) return true;
  if (node.children) {
    return node.children.some((child) => areSomeDescendantsSelected(child, selectedIds));
  }
  return false;
}

// =============================================================================
// Tree Node Component
// =============================================================================

function TreeNode({
  node,
  selectedIds,
  expandedIds,
  onSelectionChange,
  onSelectAll,
  onExpandChange,
  level,
}: TreeNodeProps) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedIds.has(node.pageId);
  const isSelected = selectedIds.has(node.pageId);
  const allChildrenSelected = hasChildren ? areAllDescendantsSelected(node, selectedIds) : isSelected;
  const someChildrenSelected = hasChildren ? areSomeDescendantsSelected(node, selectedIds) : false;
  const isIndeterminate = someChildrenSelected && !allChildrenSelected;

  const handleCheckChange = useCallback(
    (checked: boolean) => {
      if (hasChildren && onSelectAll) {
        // Select/deselect this node and all descendants
        const allIds = getAllDescendantIds(node);
        onSelectAll(allIds, checked);
      } else {
        onSelectionChange(node.pageId, checked);
      }
    },
    [node, hasChildren, onSelectionChange, onSelectAll],
  );

  const handleExpandToggle = useCallback(() => {
    onExpandChange(node.pageId, !isExpanded);
  }, [node.pageId, isExpanded, onExpandChange]);

  const Icon = node.type === 'database' ? Database : FileText;

  return (
    <div className={cn('select-none', node.isArchived && 'opacity-50')}>
      <Collapsible open={isExpanded} onOpenChange={(open) => onExpandChange(node.pageId, open)}>
        <div
          className={cn(
            'flex items-center gap-1 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors',
            isSelected && 'bg-primary/5',
          )}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
        >
          {hasChildren ? (
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="p-0.5 hover:bg-muted rounded transition-colors"
                onClick={handleExpandToggle}
              >
                <ChevronRight
                  className={cn('h-4 w-4 text-muted-foreground transition-transform', isExpanded && 'rotate-90')}
                />
              </button>
            </CollapsibleTrigger>
          ) : (
            <span className="w-5" />
          )}

          <Checkbox
            checked={isIndeterminate ? 'indeterminate' : allChildrenSelected || isSelected}
            onCheckedChange={handleCheckChange}
            className="mr-1"
          />

          <Icon
            className={cn('h-4 w-4 shrink-0', node.type === 'database' ? 'text-blue-500' : 'text-muted-foreground')}
          />

          <span className="text-sm truncate flex-1" title={node.title}>
            {node.title}
          </span>

          {node.type === 'database' && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Database</span>
          )}
        </div>

        {hasChildren && (
          <CollapsibleContent>
            <div className="border-l border-muted ml-4">
              {node.children?.map((child) => (
                <TreeNode
                  key={child.pageId}
                  node={child}
                  selectedIds={selectedIds}
                  expandedIds={expandedIds}
                  onSelectionChange={onSelectionChange}
                  onSelectAll={onSelectAll}
                  onExpandChange={onExpandChange}
                  level={level + 1}
                />
              ))}
            </div>
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function NotionTreeView({
  nodes,
  selectedIds,
  onSelectionChange,
  onSelectAll,
  expandedIds: controlledExpandedIds,
  onExpandChange: controlledOnExpandChange,
  loading,
  className,
}: NotionTreeViewProps) {
  // Internal expanded state if not controlled
  const [internalExpandedIds, setInternalExpandedIds] = useState<Set<string>>(new Set());

  const expandedIds = controlledExpandedIds ?? internalExpandedIds;
  const onExpandChange =
    controlledOnExpandChange ??
    ((pageId: string, expanded: boolean) => {
      setInternalExpandedIds((prev) => {
        const next = new Set(prev);
        if (expanded) {
          next.add(pageId);
        } else {
          next.delete(pageId);
        }
        return next;
      });
    });

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center py-8', className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading pages...</span>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-8 text-center', className)}>
        <FileText className="h-10 w-10 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">No pages found</p>
        <p className="text-xs text-muted-foreground mt-1">Try refreshing to load pages from Notion</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-0.5', className)}>
      {nodes.map((node) => (
        <TreeNode
          key={node.pageId}
          node={node}
          selectedIds={selectedIds}
          expandedIds={expandedIds}
          onSelectionChange={onSelectionChange}
          onSelectAll={onSelectAll}
          onExpandChange={onExpandChange}
          level={0}
        />
      ))}
    </div>
  );
}

export default NotionTreeView;
