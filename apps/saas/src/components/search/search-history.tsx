'use client';

import { logger } from '@nuclom/lib/client-logger';
import type { SearchHistoryWithUser } from '@nuclom/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { Clock, Search, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface SearchHistoryProps {
  history: SearchHistoryWithUser[];
  organizationId: string;
  organization: string;
  onRefresh: () => void;
}

export function SearchHistory({ history, organizationId, organization, onRefresh }: SearchHistoryProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const handleApplySearch = (query: string) => {
    startTransition(() => {
      router.push(`/org/${organization}/search?q=${encodeURIComponent(query)}`);
    });
  };

  const handleClearHistory = async () => {
    try {
      const response = await fetch(`/api/search/history?organizationId=${organizationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        onRefresh();
      }
    } catch (error) {
      logger.error('Failed to clear history', error);
    }
  };

  if (history.length === 0) {
    return null;
  }

  // Deduplicate and limit history
  const uniqueHistory = history
    .reduce<SearchHistoryWithUser[]>((acc, item) => {
      const exists = acc.find((h) => h.query.toLowerCase() === item.query.toLowerCase());
      if (!exists) {
        acc.push(item);
      }
      return acc;
    }, [])
    .slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Recent Searches</span>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear Search History</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to clear your search history? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleClearHistory}>Clear History</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="space-y-1">
        {uniqueHistory.map((item) => (
          <button
            key={item.id}
            type="button"
            className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-accent group text-left"
            onClick={() => handleApplySearch(item.query)}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm truncate">{item.query}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-muted-foreground">
                {item.resultsCount} result{item.resultsCount !== 1 ? 's' : ''}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
