"use client";

import { FolderKanban, Home, Loader2, Plus, Search, SearchIcon, Settings, Users, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import type { VideoWithAuthor } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CommandBarProps {
  organization: string;
  organizationId?: string;
}

export function CommandBar({ organization, organizationId }: CommandBarProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<VideoWithAuthor[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Search for videos when query changes
  React.useEffect(() => {
    if (!query.trim() || !organizationId) {
      setSearchResults([]);
      return;
    }

    const searchVideos = async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `/api/search/quick?q=${encodeURIComponent(query)}&organizationId=${organizationId}&limit=5`,
        );
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data);
        }
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(searchVideos, 200);
    return () => clearTimeout(timeoutId);
  }, [query, organizationId]);

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false);
    setQuery("");
    setSearchResults([]);
    command();
  }, []);

  const handleSearchSubmit = React.useCallback(() => {
    if (query.trim()) {
      runCommand(() => router.push(`/${organization}/search?q=${encodeURIComponent(query.trim())}`));
    }
  }, [query, router, organization, runCommand]);

  return (
    <>
      <Button
        variant="outline"
        className={cn(
          "relative h-9 w-full justify-start rounded-md text-sm text-muted-foreground sm:pr-12 md:w-40 lg:w-64",
        )}
        onClick={() => setOpen(true)}
      >
        <SearchIcon className="h-4 w-4 mr-2" />
        <span className="hidden lg:inline-flex">Search anything...</span>
        <span className="inline-flex lg:hidden">Search...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search videos or type a command..."
          value={query}
          onValueChange={setQuery}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim()) {
              e.preventDefault();
              handleSearchSubmit();
            }
          }}
        />
        <CommandList>
          <CommandEmpty>
            {isSearching ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Searching...
              </div>
            ) : query.trim() ? (
              <div className="text-center py-6">
                <p>No results found for "{query}"</p>
                <Button variant="link" className="mt-2" onClick={handleSearchSubmit}>
                  Search in all videos
                </Button>
              </div>
            ) : (
              "Type to search or select a command..."
            )}
          </CommandEmpty>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <>
              <CommandGroup heading="Videos">
                {searchResults.map((video) => (
                  <CommandItem
                    key={video.id}
                    onSelect={() => runCommand(() => router.push(`/${organization}/videos/${video.id}`))}
                  >
                    <Video className="mr-2 h-4 w-4" />
                    <div className="flex flex-col">
                      <span className="truncate">{video.title}</span>
                      <span className="text-xs text-muted-foreground">
                        by {video.author.name} • {video.duration}
                      </span>
                    </div>
                  </CommandItem>
                ))}
                {query.trim() && (
                  <CommandItem onSelect={handleSearchSubmit}>
                    <Search className="mr-2 h-4 w-4" />
                    <span>Search for "{query}"...</span>
                  </CommandItem>
                )}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {/* Show search option if query exists but no results yet */}
          {query.trim() && searchResults.length === 0 && !isSearching && (
            <>
              <CommandGroup heading="Search">
                <CommandItem onSelect={handleSearchSubmit}>
                  <Search className="mr-2 h-4 w-4" />
                  <span>Search for "{query}"</span>
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          <CommandGroup heading="Navigation">
            <CommandItem onSelect={() => runCommand(() => router.push(`/${organization}`))}>
              <Home className="mr-2 h-4 w-4" />
              <span>Home</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push(`/${organization}/my-videos`))}>
              <Video className="mr-2 h-4 w-4" />
              <span>My Videos</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push(`/${organization}/notebooks`))}>
              <FolderKanban className="mr-2 h-4 w-4" />
              <span>Notebooks</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push(`/${organization}/search`))}>
              <Search className="mr-2 h-4 w-4" />
              <span>Advanced Search</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => runCommand(() => router.push(`/${organization}/upload`))}>
              <Plus className="mr-2 h-4 w-4" />
              <span>New Video</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push(`/${organization}/notebooks/new`))}>
              <FolderKanban className="mr-2 h-4 w-4" />
              <span>New Notebook</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Settings">
            <CommandItem onSelect={() => runCommand(() => router.push(`/${organization}/settings/profile`))}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push(`/${organization}/settings/members`))}>
              <Users className="mr-2 h-4 w-4" />
              <span>Members</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
