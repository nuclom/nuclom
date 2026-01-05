"use client";

import { Bookmark, BookmarkPlus, Loader2, MoreHorizontal, Pencil, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clientLogger } from "@/lib/client-logger";
import type { SearchFilters } from "@/lib/db/schema";
import type { SavedSearchWithUser } from "@/lib/types";

interface SavedSearchesProps {
  savedSearches: SavedSearchWithUser[];
  organizationId: string;
  organization: string;
  currentQuery: string;
  currentFilters?: SearchFilters;
  onRefresh: () => void;
}

export function SavedSearches({
  savedSearches,
  organizationId,
  organization,
  currentQuery,
  currentFilters,
  onRefresh,
}: SavedSearchesProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [editingSearch, setEditingSearch] = useState<SavedSearchWithUser | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleApplySavedSearch = (savedSearch: SavedSearchWithUser) => {
    startTransition(() => {
      const params = new URLSearchParams();
      params.set("q", savedSearch.query);
      if (savedSearch.filters) {
        Object.entries(savedSearch.filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            params.set(key, String(value));
          }
        });
      }
      router.push(`/${organization}/search?${params.toString()}`);
    });
  };

  const handleSaveSearch = async () => {
    if (!searchName.trim() || !currentQuery.trim()) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/search/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: searchName.trim(),
          query: currentQuery,
          organizationId,
          filters: currentFilters,
        }),
      });

      if (response.ok) {
        setSaveDialogOpen(false);
        setSearchName("");
        onRefresh();
      }
    } catch (error) {
      clientLogger.error("Failed to save search", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateSearch = async () => {
    if (!editingSearch || !searchName.trim()) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/search/saved/${editingSearch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: searchName.trim(),
        }),
      });

      if (response.ok) {
        setEditDialogOpen(false);
        setEditingSearch(null);
        setSearchName("");
        onRefresh();
      }
    } catch (error) {
      clientLogger.error("Failed to update search", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSearch = async (id: string) => {
    try {
      const response = await fetch(`/api/search/saved/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        onRefresh();
      }
    } catch (error) {
      clientLogger.error("Failed to delete search", error);
    }
  };

  const openEditDialog = (savedSearch: SavedSearchWithUser) => {
    setEditingSearch(savedSearch);
    setSearchName(savedSearch.name);
    setEditDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Saved Searches</span>
        </div>

        {/* Save current search button */}
        {currentQuery.trim() && (
          <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <BookmarkPlus className="h-4 w-4 mr-1" />
                Save
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Search</DialogTitle>
                <DialogDescription>Save the current search to quickly access it later.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    placeholder="e.g., Recent tutorials"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Query</Label>
                  <div className="text-sm p-2 bg-muted rounded">{currentQuery}</div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveSearch} disabled={!searchName.trim() || isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Search
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Saved searches list */}
      {savedSearches.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No saved searches yet. Search for something and save it!
        </p>
      ) : (
        <div className="space-y-2">
          {savedSearches.map((savedSearch) => (
            <div
              key={savedSearch.id}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-accent group"
            >
              <button
                type="button"
                className="flex-1 flex items-center gap-2 text-left"
                onClick={() => handleApplySavedSearch(savedSearch)}
              >
                <Search className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm truncate">{savedSearch.name}</span>
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEditDialog(savedSearch)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteSearch(savedSearch.id)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Saved Search</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input id="edit-name" value={searchName} onChange={(e) => setSearchName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateSearch} disabled={!searchName.trim() || isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
