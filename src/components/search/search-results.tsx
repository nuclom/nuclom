'use client';

import { ChevronLeft, ChevronRight, Loader2, SearchX } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import type { SearchResponse } from '@/lib/types';
import { SearchResultCard } from './search-result-card';

interface SearchResultsProps {
  results: SearchResponse;
  organization: string;
  isLoading?: boolean;
}

export function SearchResults({ results, organization, isLoading }: SearchResultsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentPage = results.pagination.page;
  const totalPages = results.pagination.totalPages;
  const totalResults = results.total;

  const handlePageChange = useCallback(
    (page: number) => {
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('page', String(page));
        router.push(`/${organization}/search?${params.toString()}`);
      });
    },
    [router, organization, searchParams],
  );

  if (isLoading || isPending) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (results.results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <SearchX className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No results found</h3>
        <p className="text-muted-foreground mt-1">
          {results.query
            ? `No videos match "${results.query}". Try different keywords or filters.`
            : 'No videos match your filters. Try adjusting your search criteria.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        {results.query ? (
          <>
            Found <span className="font-medium text-foreground">{totalResults}</span> result
            {totalResults !== 1 ? 's' : ''} for <span className="font-medium text-foreground">"{results.query}"</span>
          </>
        ) : (
          <>
            Showing <span className="font-medium text-foreground">{totalResults}</span> video
            {totalResults !== 1 ? 's' : ''}
          </>
        )}
      </div>

      {/* Results list */}
      <div className="space-y-4">
        {results.results.map((result) => (
          <SearchResultCard key={result.video.id} result={result} organization={organization} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={currentPage <= 1}
            onClick={() => handlePageChange(currentPage - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Previous page</span>
          </Button>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <Button
                  key={pageNum}
                  variant={pageNum === currentPage ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => handlePageChange(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="icon"
            disabled={currentPage >= totalPages}
            onClick={() => handlePageChange(currentPage + 1)}
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Next page</span>
          </Button>

          <span className="text-sm text-muted-foreground ml-2">
            Page {currentPage} of {totalPages}
          </span>
        </div>
      )}
    </div>
  );
}
