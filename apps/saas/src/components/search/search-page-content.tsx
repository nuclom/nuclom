'use client';

import { logger } from '@nuclom/lib/client-logger';
import type { Collection, SearchFilters as SearchFiltersType, User } from '@nuclom/lib/db/schema';
import type { SavedSearchWithUser, SearchHistoryWithUser, SearchResponse } from '@nuclom/lib/types';
import { Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SavedSearches } from './saved-searches';
import { SearchFilters } from './search-filters';
import { SearchHistory } from './search-history';
import { SearchInput } from './search-input';
import { SearchResults } from './search-results';

interface SearchPageContentProps {
  organizationId: string;
  organization: string;
  authors: User[];
  collections: Collection[];
}

export function SearchPageContent({ organizationId, organization, authors, collections }: SearchPageContentProps) {
  const searchParams = useSearchParams();
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [savedSearches, setSavedSearches] = useState<SavedSearchWithUser[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Get current search parameters
  const query = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);

  // Build filters from search params - memoized to avoid unnecessary rerenders
  const currentFilters: SearchFiltersType = useMemo(
    () => ({
      authorId: searchParams.get('authorId') || undefined,
      collectionId: searchParams.get('collectionId') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      hasTranscript: searchParams.get('hasTranscript') === 'true' || undefined,
      hasAiSummary: searchParams.get('hasAiSummary') === 'true' || undefined,
      sortBy: (searchParams.get('sortBy') as SearchFiltersType['sortBy']) || undefined,
      sortOrder: (searchParams.get('sortOrder') as SearchFiltersType['sortOrder']) || undefined,
    }),
    [searchParams],
  );

  // Fetch search results
  const fetchSearchResults = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('organizationId', organizationId);
      params.set('page', String(page));
      if (query) params.set('q', query);

      // Add filters
      Object.entries(currentFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.set(key, String(value));
        }
      });

      const response = await fetch(`/api/search?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data);
      }
    } catch (error) {
      logger.error('Failed to fetch search results', error);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, query, page, currentFilters]);

  // Fetch saved searches and history
  const fetchSavedData = useCallback(async () => {
    try {
      const [savedRes, historyRes] = await Promise.all([
        fetch(`/api/search/saved?organizationId=${organizationId}`),
        fetch(`/api/search/history?organizationId=${organizationId}&limit=20`),
      ]);

      if (savedRes.ok) {
        const savedData = await savedRes.json();
        setSavedSearches(savedData);
      }

      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setSearchHistory(historyData);
      }
    } catch (error) {
      logger.error('Failed to fetch saved data', error);
    }
  }, [organizationId]);

  // Load data when search params change
  useEffect(() => {
    fetchSearchResults();
    fetchSavedData();
  }, [fetchSearchResults, fetchSavedData]);

  return (
    <div className="space-y-6">
      {/* Search input */}
      <SearchInput organizationId={organizationId} organization={organization} className="max-w-2xl" autoFocus />

      <div className="flex gap-8">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : searchResults ? (
            <SearchResults results={searchResults} organization={organization} />
          ) : null}
        </div>

        {/* Sidebar */}
        <aside className="w-72 flex-shrink-0 space-y-8">
          {/* Filters */}
          <SearchFilters organization={organization} authors={authors} collections={collections} />

          {/* Saved searches */}
          <SavedSearches
            savedSearches={savedSearches}
            organizationId={organizationId}
            organization={organization}
            currentQuery={query}
            currentFilters={Object.keys(currentFilters).length > 0 ? currentFilters : undefined}
            onRefresh={fetchSavedData}
          />

          {/* Search history */}
          {!query && (
            <SearchHistory
              history={searchHistory}
              organizationId={organizationId}
              organization={organization}
              onRefresh={fetchSavedData}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
