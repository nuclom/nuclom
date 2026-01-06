'use client';

import { Loader2, Search, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { logger } from '@/lib/client-logger';
import type { SearchSuggestion } from '@/lib/types';

interface SearchInputProps {
  organizationId: string;
  organization: string;
  className?: string;
  autoFocus?: boolean;
}

export function SearchInput({ organizationId, organization, className, autoFocus }: SearchInputProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Fetch suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!query.trim()) {
        // Fetch recent searches when input is empty
        try {
          const response = await fetch(`/api/search/suggestions?organizationId=${organizationId}&q=`);
          if (response.ok) {
            const data = await response.json();
            setSuggestions(data);
          }
        } catch (error) {
          logger.error('Failed to fetch suggestions', error);
        }
        return;
      }

      try {
        const response = await fetch(
          `/api/search/suggestions?organizationId=${organizationId}&q=${encodeURIComponent(query)}&limit=8`,
        );
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data);
        }
      } catch (error) {
        logger.error('Failed to fetch suggestions', error);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 200);
    return () => clearTimeout(timeoutId);
  }, [query, organizationId]);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = useCallback(
    (searchQuery: string) => {
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (searchQuery.trim()) {
          params.set('q', searchQuery.trim());
        } else {
          params.delete('q');
        }
        params.delete('page'); // Reset pagination on new search
        router.push(`/${organization}/search?${params.toString()}`);
      });
      setShowSuggestions(false);
    },
    [router, organization, searchParams],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        const suggestion = suggestions[selectedIndex];
        if (suggestion.type === 'video' && suggestion.videoId) {
          router.push(`/${organization}/videos/${suggestion.videoId}`);
        } else {
          setQuery(suggestion.text);
          handleSearch(suggestion.text);
        }
      } else {
        handleSearch(query);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  };

  const handleClear = () => {
    setQuery('');
    handleSearch('');
    inputRef.current?.focus();
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search videos, transcripts, summaries..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowSuggestions(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          className="pl-10 pr-20"
          autoFocus={autoFocus}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {query && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleClear}>
              <X className="h-3 w-3" />
              <span className="sr-only">Clear search</span>
            </Button>
          )}
        </div>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-80 overflow-auto"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.type}-${suggestion.text}-${index}`}
              type="button"
              className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-accent ${
                index === selectedIndex ? 'bg-accent' : ''
              }`}
              onClick={() => {
                if (suggestion.type === 'video' && suggestion.videoId) {
                  router.push(`/${organization}/videos/${suggestion.videoId}`);
                } else {
                  setQuery(suggestion.text);
                  handleSearch(suggestion.text);
                }
              }}
            >
              {suggestion.type === 'recent' && <span className="text-muted-foreground text-xs">Recent</span>}
              {suggestion.type === 'video' && <span className="text-primary text-xs">Video</span>}
              <span className="truncate">{suggestion.text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
