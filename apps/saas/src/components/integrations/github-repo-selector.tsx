'use client';

/**
 * GitHub Repository Selector Component
 *
 * A complete component for selecting which GitHub repositories to sync.
 * Fetches repository data via SWR and manages selection state.
 */

import { cn } from '@nuclom/lib/utils';
import { AlertCircle, Check, GitBranch, Lock, Loader2, RefreshCw, Search, Star } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

// =============================================================================
// Types
// =============================================================================

interface GitHubRepoNode {
  id: number;
  fullName: string;
  name: string;
  owner: string;
  description: string | null;
  isPrivate: boolean;
  defaultBranch: string;
  language: string | null;
  stargazersCount: number;
  updatedAt: string;
  isSelected: boolean;
  syncPRs: boolean;
  syncIssues: boolean;
  syncDiscussions: boolean;
}

interface GitHubReposResponse {
  repositories: GitHubRepoNode[];
  byOwner: Record<string, GitHubRepoNode[]>;
  totalCount: number;
  selectedCount: number;
}

export interface GitHubRepoSelectorProps {
  sourceId: string;
  onSelectionChange?: (selectedRepos: string[]) => void;
  onSave?: () => void;
  className?: string;
}

// =============================================================================
// Fetcher
// =============================================================================

const fetcher = async (url: string): Promise<GitHubReposResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch repositories');
  }
  return response.json();
};

// =============================================================================
// Component
// =============================================================================

export function GitHubRepoSelector({ sourceId, onSelectionChange, onSave, className }: GitHubRepoSelectorProps) {
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [initialSelectedRepos, setInitialSelectedRepos] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch repository data
  const { data, error, isLoading, mutate } = useSWR<GitHubReposResponse>(
    `/api/content/sources/${sourceId}/github/repositories`,
    fetcher,
    {
      revalidateOnFocus: false,
    },
  );

  // Refresh from GitHub API
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await mutate();
    } finally {
      setRefreshing(false);
    }
  }, [mutate]);

  // Initialize selected repos from data
  useEffect(() => {
    if (data?.repositories) {
      const initial = new Set(data.repositories.filter((r) => r.isSelected).map((r) => r.fullName));
      setSelectedRepos(initial);
      setInitialSelectedRepos(initial);
      setHasChanges(false);
    }
  }, [data?.repositories]);

  // Track changes
  useEffect(() => {
    const initialArray = Array.from(initialSelectedRepos).sort();
    const currentArray = Array.from(selectedRepos).sort();
    const changed =
      initialArray.length !== currentArray.length || initialArray.some((id, idx) => id !== currentArray[idx]);
    setHasChanges(changed);
  }, [selectedRepos, initialSelectedRepos]);

  // Handle selection change for single repo
  const handleSelectionChange = useCallback(
    (repoFullName: string, selected: boolean) => {
      setSelectedRepos((prev) => {
        const next = new Set(prev);
        if (selected) {
          next.add(repoFullName);
        } else {
          next.delete(repoFullName);
        }
        return next;
      });
      onSelectionChange?.(Array.from(selectedRepos));
    },
    [onSelectionChange, selectedRepos],
  );

  // Filter repos by search query
  const filteredRepos = useMemo(() => {
    if (!data?.repositories) return [];
    if (!searchQuery.trim()) return data.repositories;

    const query = searchQuery.toLowerCase();
    return data.repositories.filter(
      (repo) =>
        repo.fullName.toLowerCase().includes(query) ||
        repo.name.toLowerCase().includes(query) ||
        repo.description?.toLowerCase().includes(query) ||
        repo.language?.toLowerCase().includes(query),
    );
  }, [data?.repositories, searchQuery]);

  // Group filtered repos by owner
  const filteredByOwner = useMemo(() => {
    const byOwner: Record<string, GitHubRepoNode[]> = {};
    for (const repo of filteredRepos) {
      if (!byOwner[repo.owner]) {
        byOwner[repo.owner] = [];
      }
      byOwner[repo.owner].push(repo);
    }
    return byOwner;
  }, [filteredRepos]);

  // Select all / deselect all
  const allSelected = filteredRepos.length > 0 && filteredRepos.every((r) => selectedRepos.has(r.fullName));
  const noneSelected = selectedRepos.size === 0;

  const handleSelectAllClick = useCallback(() => {
    if (allSelected) {
      // Deselect all filtered repos
      setSelectedRepos((prev) => {
        const next = new Set(prev);
        for (const repo of filteredRepos) {
          next.delete(repo.fullName);
        }
        return next;
      });
    } else {
      // Select all filtered repos
      setSelectedRepos((prev) => {
        const next = new Set(prev);
        for (const repo of filteredRepos) {
          next.add(repo.fullName);
        }
        return next;
      });
    }
  }, [allSelected, filteredRepos]);

  // Save selection
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);

    try {
      const response = await fetch(`/api/content/sources/${sourceId}/github/repositories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedRepos: Array.from(selectedRepos),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save selection');
      }

      setInitialSelectedRepos(new Set(selectedRepos));
      setHasChanges(false);
      onSave?.();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [sourceId, selectedRepos, onSave]);

  // Error state
  if (error) {
    return (
      <div className={cn('border rounded-lg p-4', className)}>
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">Failed to load repositories</span>
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
          <h3 className="font-medium text-sm">Select Repositories to Sync</h3>
          {data && (
            <span className="text-xs text-muted-foreground">
              {selectedRepos.size} of {data.totalCount} selected
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleSelectAllClick} disabled={isLoading || refreshing}>
            {allSelected ? 'Deselect All' : 'Select All'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading || refreshing}>
            <RefreshCw className={cn('h-4 w-4 mr-2', refreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Repository List */}
      <ScrollArea className="h-80">
        <div className="p-2">
          {isLoading || refreshing ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading repositories...</span>
            </div>
          ) : filteredRepos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <GitBranch className="h-10 w-10 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'No repositories match your search' : 'No repositories found'}
              </p>
            </div>
          ) : (
            Object.entries(filteredByOwner).map(([owner, repos]) => (
              <div key={owner} className="mb-4 last:mb-0">
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {owner}
                </div>
                <div className="space-y-1">
                  {repos.map((repo) => (
                    <RepoItem
                      key={repo.id}
                      repo={repo}
                      isSelected={selectedRepos.has(repo.fullName)}
                      onSelect={(selected) => handleSelectionChange(repo.fullName, selected)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
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
          {!saveError && !hasChanges && selectedRepos.size > 0 && (
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

// =============================================================================
// Repo Item Component
// =============================================================================

interface RepoItemProps {
  repo: GitHubRepoNode;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
}

function RepoItem({ repo, isSelected, onSelect }: RepoItemProps) {
  // Language color mapping (subset of GitHub's colors)
  const languageColors: Record<string, string> = {
    TypeScript: 'bg-blue-500',
    JavaScript: 'bg-yellow-400',
    Python: 'bg-blue-600',
    Go: 'bg-cyan-500',
    Rust: 'bg-orange-600',
    Ruby: 'bg-red-500',
    Java: 'bg-orange-500',
    'C#': 'bg-purple-600',
    'C++': 'bg-pink-500',
    PHP: 'bg-purple-400',
    Swift: 'bg-orange-400',
    Kotlin: 'bg-purple-500',
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-md hover:bg-muted/50 transition-colors',
        isSelected && 'bg-primary/5',
      )}
    >
      <Checkbox checked={isSelected} onCheckedChange={onSelect} className="mt-0.5" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{repo.name}</span>
          {repo.isPrivate && <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
        </div>

        {repo.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{repo.description}</p>
        )}

        <div className="flex items-center gap-3 mt-1.5">
          {repo.language && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className={cn('w-2 h-2 rounded-full', languageColors[repo.language] || 'bg-gray-400')} />
              {repo.language}
            </div>
          )}

          {repo.stargazersCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="h-3 w-3" />
              {repo.stargazersCount.toLocaleString()}
            </div>
          )}

          <span className="text-xs text-muted-foreground">Updated {formatDate(repo.updatedAt)}</span>
        </div>
      </div>

      <Badge variant="outline" className="text-xs shrink-0">
        {repo.defaultBranch}
      </Badge>
    </div>
  );
}

export default GitHubRepoSelector;
