'use client';

import type { Collection, User } from '@nuclom/lib/db/schema';
import { cn } from '@nuclom/lib/utils';
import { Badge } from '@nuclom/ui/badge';
import { Button } from '@nuclom/ui/button';
import { Calendar } from '@nuclom/ui/calendar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@nuclom/ui/collapsible';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@nuclom/ui/command';
import { Label } from '@nuclom/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@nuclom/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@nuclom/ui/select';
import { Switch } from '@nuclom/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@nuclom/ui/tooltip';
import { format } from 'date-fns';
import { CalendarIcon, Check, ChevronsUpDown, Filter, HelpCircle, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';

function FilterHelp({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex ml-1">
          <HelpCircle className="h-3 w-3 text-muted-foreground/60 hover:text-muted-foreground transition-colors" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[220px] text-xs">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

interface SearchFiltersProps {
  organization: string;
  authors?: User[];
  collections?: Collection[];
}

export function SearchFilters({ organization, authors = [], collections = [] }: SearchFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Get current filter values
  const authorId = searchParams.get('authorId') || '';
  const collectionId = searchParams.get('collectionId') || '';
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const hasTranscript = searchParams.get('hasTranscript') === 'true';
  const hasAiSummary = searchParams.get('hasAiSummary') === 'true';
  const sortBy = searchParams.get('sortBy') || 'relevance';
  const sortOrder = searchParams.get('sortOrder') || 'desc';

  const hasActiveFilters = authorId || collectionId || dateFrom || dateTo || hasTranscript || hasAiSummary;

  const updateFilter = useCallback(
    (key: string, value: string | boolean) => {
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (value === '' || value === false) {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
        params.delete('page'); // Reset pagination on filter change
        router.push(`/org/${organization}/search?${params.toString()}`);
      });
    },
    [router, organization, searchParams],
  );

  const clearAllFilters = useCallback(() => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('authorId');
      params.delete('collectionId');
      params.delete('dateFrom');
      params.delete('dateTo');
      params.delete('hasTranscript');
      params.delete('hasAiSummary');
      params.delete('page');
      router.push(`/org/${organization}/search?${params.toString()}`);
    });
  }, [router, organization, searchParams]);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters</span>
            <FilterHelp>
              Use filters to narrow down search results by author, collection, date, or content type.
            </FilterHelp>
            {hasActiveFilters && (
              <Badge variant="secondary" className="text-xs">
                Active
              </Badge>
            )}
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters} disabled={isPending}>
              <X className="h-3 w-3 mr-1" />
              Clear all
            </Button>
          )}
        </div>

        <div className="space-y-4">
          {/* Sort options */}
          <div className="flex items-center gap-2">
            <Select value={sortBy} onValueChange={(value) => updateFilter('sortBy', value)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relevance">Relevance</SelectItem>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="title">Title</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortOrder} onValueChange={(value) => updateFilter('sortOrder', value)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Descending</SelectItem>
                <SelectItem value="asc">Ascending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Author filter */}
          {authors.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center">
                <Label className="text-xs text-muted-foreground">Author</Label>
                <FilterHelp>Filter by who created or uploaded the video.</FilterHelp>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {authorId ? authors.find((a) => a.id === authorId)?.name || 'Select author' : 'All authors'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                  <Command>
                    <CommandInput placeholder="Search authors..." />
                    <CommandList>
                      <CommandEmpty>No author found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem onSelect={() => updateFilter('authorId', '')}>
                          <Check className={cn('mr-2 h-4 w-4', !authorId ? 'opacity-100' : 'opacity-0')} />
                          All authors
                        </CommandItem>
                        {authors.map((author) => (
                          <CommandItem key={author.id} onSelect={() => updateFilter('authorId', author.id)}>
                            <Check
                              className={cn('mr-2 h-4 w-4', authorId === author.id ? 'opacity-100' : 'opacity-0')}
                            />
                            {author.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Collection filter */}
          {collections.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center">
                <Label className="text-xs text-muted-foreground">Collection</Label>
                <FilterHelp>Collections group related videos together by topic or project.</FilterHelp>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {collectionId
                      ? collections.find((c) => c.id === collectionId)?.name || 'Select collection'
                      : 'All collections'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                  <Command>
                    <CommandInput placeholder="Search collections..." />
                    <CommandList>
                      <CommandEmpty>No collection found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem onSelect={() => updateFilter('collectionId', '')}>
                          <Check className={cn('mr-2 h-4 w-4', !collectionId ? 'opacity-100' : 'opacity-0')} />
                          All collections
                        </CommandItem>
                        {collections.map((collection) => (
                          <CommandItem key={collection.id} onSelect={() => updateFilter('collectionId', collection.id)}>
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                collectionId === collection.id ? 'opacity-100' : 'opacity-0',
                              )}
                            />
                            {collection.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Date range */}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                <Label className="text-xs text-muted-foreground cursor-pointer">Date Range</Label>
                <ChevronsUpDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn('w-full justify-start text-left font-normal', !dateFrom && 'text-muted-foreground')}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(new Date(dateFrom), 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom ? new Date(dateFrom) : undefined}
                      onSelect={(date) => updateFilter('dateFrom', date ? date.toISOString() : '')}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn('w-full justify-start text-left font-normal', !dateTo && 'text-muted-foreground')}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(new Date(dateTo), 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo ? new Date(dateTo) : undefined}
                      onSelect={(date) => updateFilter('dateTo', date ? date.toISOString() : '')}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Content filters */}
          <div className="space-y-3">
            <div className="flex items-center">
              <Label className="text-xs text-muted-foreground">Content</Label>
              <FilterHelp>Filter by what content is available for each video.</FilterHelp>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="hasTranscript" className="text-sm cursor-pointer">
                Has transcript
              </Label>
              <Switch
                id="hasTranscript"
                checked={hasTranscript}
                onCheckedChange={(checked) => updateFilter('hasTranscript', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="hasAiSummary" className="text-sm cursor-pointer">
                Has AI summary
              </Label>
              <Switch
                id="hasAiSummary"
                checked={hasAiSummary}
                onCheckedChange={(checked) => updateFilter('hasAiSummary', checked)}
              />
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
