'use client';

import { logger } from '@nuclom/lib/client-logger';
import { formatFileSize } from '@nuclom/lib/format-utils';
import { format, formatDistanceToNow } from 'date-fns';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Download,
  FileVideo,
  Folder,
  FolderOpen,
  HardDrive,
  Home,
  Loader2,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdTime: string;
  modifiedTime: string;
  thumbnailLink?: string;
  webViewLink?: string;
  parentId?: string;
}

interface GoogleDriveFolder {
  id: string;
  name: string;
  parentId?: string;
  modifiedTime: string;
}

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface GoogleDrivePickerProps {
  open: boolean;
  onClose: () => void;
  onImport: (files: GoogleDriveFile[]) => Promise<void>;
}

export function GoogleDrivePicker({ open, onClose, onImport }: GoogleDrivePickerProps) {
  const { toast } = useToast();
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [folders, setFolders] = useState<GoogleDriveFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GoogleDriveFile[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const loadFolderContents = useCallback(
    async (folderId?: string, reset = false) => {
      try {
        setLoading(true);
        setConnectionError(null);

        const params = new URLSearchParams({
          action: 'list',
        });

        if (folderId) {
          params.set('folderId', folderId);
        }

        if (!reset && nextPageToken) {
          params.set('pageToken', nextPageToken);
        }

        const response = await fetch(`/api/integrations/google/drive?${params.toString()}`);
        const data = await response.json();

        if (!data.success) {
          if (response.status === 404) {
            setConnectionError(data.error || 'Google account not connected');
          }
          throw new Error(data.error || 'Failed to load Google Drive contents');
        }

        if (reset) {
          setFiles(data.data.files);
          setFolders(data.data.folders);
        } else {
          setFiles((prev) => [...prev, ...data.data.files]);
          // Folders are only loaded once per directory
        }
        setNextPageToken(data.data.nextPageToken);
      } catch (error) {
        logger.error('Failed to load Google Drive contents', error);
        if (!connectionError) {
          toast({
            title: 'Error',
            description: error instanceof Error ? error.message : 'Failed to load Google Drive contents',
            variant: 'destructive',
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [nextPageToken, toast, connectionError],
  );

  const handleSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSearchResults(null);
        return;
      }

      try {
        setSearchLoading(true);

        const params = new URLSearchParams({
          action: 'search',
          query: query.trim(),
        });

        const response = await fetch(`/api/integrations/google/drive?${params.toString()}`);
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Search failed');
        }

        setSearchResults(data.data.files);
      } catch (error) {
        logger.error('Search failed', error);
        toast({
          title: 'Search Error',
          description: error instanceof Error ? error.message : 'Search failed',
          variant: 'destructive',
        });
      } finally {
        setSearchLoading(false);
      }
    },
    [toast],
  );

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setFiles([]);
      setFolders([]);
      setSelected(new Set());
      setCurrentFolderId(undefined);
      setBreadcrumbs([]);
      setSearchQuery('');
      setSearchResults(null);
      setNextPageToken(undefined);
      setConnectionError(null);
      loadFolderContents(undefined, true);
    }
  }, [open, loadFolderContents]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const navigateToFolder = (folder: GoogleDriveFolder) => {
    setSelected(new Set());
    setSearchQuery('');
    setSearchResults(null);
    setCurrentFolderId(folder.id);
    setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
    setNextPageToken(undefined);
    loadFolderContents(folder.id, true);
  };

  const navigateToBreadcrumb = (index: number) => {
    const targetBreadcrumb = breadcrumbs[index];
    setSelected(new Set());
    setSearchQuery('');
    setSearchResults(null);

    if (index === -1) {
      // Go to root
      setCurrentFolderId(undefined);
      setBreadcrumbs([]);
      setNextPageToken(undefined);
      loadFolderContents(undefined, true);
    } else {
      setCurrentFolderId(targetBreadcrumb.id);
      setBreadcrumbs((prev) => prev.slice(0, index + 1));
      setNextPageToken(undefined);
      loadFolderContents(targetBreadcrumb.id, true);
    }
  };

  const navigateBack = () => {
    if (breadcrumbs.length === 0) return;

    const newBreadcrumbs = breadcrumbs.slice(0, -1);
    const parentId = newBreadcrumbs.length > 0 ? newBreadcrumbs[newBreadcrumbs.length - 1].id : undefined;

    setSelected(new Set());
    setSearchQuery('');
    setSearchResults(null);
    setCurrentFolderId(parentId);
    setBreadcrumbs(newBreadcrumbs);
    setNextPageToken(undefined);
    loadFolderContents(parentId, true);
  };

  const handleToggle = (fileId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  const displayedFiles = searchResults ?? files;

  const handleSelectAll = () => {
    if (selected.size === displayedFiles.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(displayedFiles.map((f) => f.id)));
    }
  };

  const handleImport = async () => {
    if (selected.size === 0) return;

    try {
      setImporting(true);

      const selectedFiles = displayedFiles.filter((f) => selected.has(f.id));
      await onImport(selectedFiles);

      toast({
        title: 'Import Started',
        description: `${selectedFiles.length} video${selectedFiles.length !== 1 ? 's' : ''} are being imported from Google Drive.`,
      });

      onClose();
    } catch (error) {
      logger.error('Failed to import from Google Drive', error);
      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Failed to import videos',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const getTotalSelectedSize = () => {
    const selectedFiles = displayedFiles.filter((f) => selected.has(f.id));
    const totalBytes = selectedFiles.reduce((sum, f) => sum + f.size, 0);
    return formatFileSize(totalBytes);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Import from Google Drive
          </DialogTitle>
          <DialogDescription>Browse and select videos to import from your Google Drive</DialogDescription>
        </DialogHeader>

        {connectionError ? (
          <div className="flex flex-col items-center justify-center py-12">
            <HardDrive className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">{connectionError}</p>
            <Button variant="outline" className="mt-4" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : (
          <>
            {/* Search and Navigation */}
            <div className="flex flex-col gap-3 py-2">
              <div className="flex items-center gap-2">
                {/* Back button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={navigateBack}
                  disabled={breadcrumbs.length === 0 || loading}
                  className="shrink-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>

                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search videos in Drive..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2"
                      onClick={() => setSearchQuery('')}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => loadFolderContents(currentFolderId, true)}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {/* Breadcrumbs */}
              {!searchQuery && (
                <div className="flex items-center gap-1 text-sm overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => navigateToBreadcrumb(-1)}
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted shrink-0"
                  >
                    <Home className="h-4 w-4" />
                    <span>My Drive</span>
                  </button>

                  {breadcrumbs.map((crumb, index) => (
                    <span key={crumb.id} className="flex items-center gap-1 shrink-0">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      <button
                        type="button"
                        onClick={() => navigateToBreadcrumb(index)}
                        className={`px-2 py-1 rounded-md transition-colors ${
                          index === breadcrumbs.length - 1
                            ? 'font-medium text-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                      >
                        {crumb.name}
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Selection Info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={displayedFiles.length > 0 && selected.size === displayedFiles.length}
                    onCheckedChange={handleSelectAll}
                    disabled={displayedFiles.length === 0 || loading}
                  />
                  <span className="text-sm text-muted-foreground">
                    {selected.size > 0 ? (
                      <>
                        {selected.size} selected
                        <span className="mx-2">·</span>
                        {getTotalSelectedSize()}
                      </>
                    ) : (
                      `${displayedFiles.length} video${displayedFiles.length !== 1 ? 's' : ''}`
                    )}
                  </span>
                </div>
                {searchQuery && searchResults && (
                  <Badge variant="secondary" className="gap-1">
                    <Search className="h-3 w-3" />
                    {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>

            <ScrollArea className="flex-1 -mx-6 px-6">
              {loading && files.length === 0 && folders.length === 0 ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={`skeleton-${i}-${currentFolderId}`} className="flex items-center gap-3 p-4">
                      <Skeleton className="h-5 w-5 rounded" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-48 mb-2" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : searchLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">Searching...</p>
                </div>
              ) : folders.length === 0 && displayedFiles.length === 0 ? (
                <div className="text-center py-12">
                  <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  {searchQuery ? (
                    <>
                      <p className="text-muted-foreground">No videos match your search</p>
                      <Button variant="link" className="mt-2" onClick={() => setSearchQuery('')}>
                        Clear search
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-muted-foreground">No videos in this folder</p>
                      <p className="text-sm text-muted-foreground mt-1">Navigate to a folder containing video files</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Folders (only shown when not searching) */}
                  {!searchQuery &&
                    folders.map((folder) => (
                      <div
                        key={folder.id}
                        role="button"
                        tabIndex={0}
                        className="group flex items-center gap-3 p-4 rounded-lg border hover:bg-muted/50 hover:border-muted-foreground/20 transition-all cursor-pointer"
                        onClick={() => navigateToFolder(folder)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            navigateToFolder(folder);
                          }
                        }}
                      >
                        <Folder className="h-5 w-5 text-blue-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate group-hover:text-primary transition-colors">
                            {folder.name}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                    ))}

                  {/* Files */}
                  {displayedFiles.map((file) => {
                    const isSelected = selected.has(file.id);

                    return (
                      <div
                        key={file.id}
                        role="button"
                        tabIndex={0}
                        className={`group flex items-start gap-3 p-4 rounded-lg border transition-all cursor-pointer hover:shadow-sm ${
                          isSelected
                            ? 'bg-primary/5 border-primary/50 shadow-sm'
                            : 'hover:bg-muted/50 hover:border-muted-foreground/20'
                        }`}
                        onClick={() => handleToggle(file.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleToggle(file.id);
                          }
                        }}
                      >
                        <div className="flex items-center justify-center pt-0.5">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggle(file.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                          />
                        </div>

                        {/* Thumbnail or icon */}
                        <div className="w-12 h-12 shrink-0 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                          {file.thumbnailLink ? (
                            <img
                              src={file.thumbnailLink}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                if (e.currentTarget.nextElementSibling) {
                                  (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                                }
                              }}
                            />
                          ) : null}
                          <FileVideo
                            className="h-6 w-6 text-muted-foreground"
                            style={{ display: file.thumbnailLink ? 'none' : 'block' }}
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate group-hover:text-primary transition-colors">
                                {file.name}
                              </p>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                  {format(new Date(file.modifiedTime), 'MMM d, yyyy')}
                                  <span className="text-muted-foreground/60">
                                    ({formatDistanceToNow(new Date(file.modifiedTime), { addSuffix: true })})
                                  </span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <Download className="h-3.5 w-3.5" />
                                  {formatFileSize(file.size)}
                                </span>
                              </div>
                            </div>

                            {isSelected && (
                              <Badge className="shrink-0 bg-primary">
                                <Check className="h-3 w-3 mr-1" />
                                Selected
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {nextPageToken && !searchQuery && (
                    <Button
                      variant="outline"
                      className="w-full mt-4"
                      onClick={() => loadFolderContents(currentFolderId)}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        'Load More Videos'
                      )}
                    </Button>
                  )}
                </div>
              )}
            </ScrollArea>

            <DialogFooter className="border-t pt-4 gap-2 sm:gap-0">
              <div className="flex-1 text-sm text-muted-foreground hidden sm:block">
                {selected.size > 0 && (
                  <span>
                    Ready to import {selected.size} video{selected.size !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <Button variant="outline" onClick={onClose} disabled={importing}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={selected.size === 0 || importing} className="gap-2">
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Import {selected.size > 0 ? `${selected.size} ` : ''}Video
                    {selected.size !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
