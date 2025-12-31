"use client";

import { format, formatDistanceToNow, subDays } from "date-fns";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Calendar,
  CalendarDays,
  Check,
  Clock,
  Download,
  FileVideo,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  SortAsc,
  Video,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

interface Recording {
  id: string;
  meetingId?: string;
  topic?: string;
  name?: string;
  meetingTitle?: string;
  startTime?: Date;
  createdTime?: Date;
  duration: number;
  fileSize: number;
  downloadUrl: string;
  fileType?: string;
}

interface RecordingBrowserProps {
  provider: "zoom" | "google_meet";
  open: boolean;
  onClose: () => void;
  organizationSlug: string;
}

type SortField = "date" | "name" | "duration" | "size";
type SortOrder = "asc" | "desc";
type DateRange = "7" | "30" | "90" | "all";

export function RecordingBrowser({ provider, open, onClose, organizationSlug }: RecordingBrowserProps) {
  const { toast } = useToast();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [dateRange, setDateRange] = useState<DateRange>("30");
  const [minDuration, setMinDuration] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const providerName = provider === "zoom" ? "Zoom" : "Google Meet";

  const loadRecordings = useCallback(
    async (reset = false) => {
      try {
        setLoading(true);

        const endpoint =
          provider === "zoom" ? "/api/integrations/zoom/recordings" : "/api/integrations/google/recordings";

        const params = new URLSearchParams();
        if (!reset && nextPageToken) {
          params.set("pageToken", nextPageToken);
        }

        // Add date range filter
        if (dateRange !== "all") {
          const fromDate = subDays(new Date(), Number.parseInt(dateRange));
          params.set("from", fromDate.toISOString().split("T")[0]);
          params.set("to", new Date().toISOString().split("T")[0]);
        }

        const response = await fetch(`${endpoint}?${params.toString()}`);
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to load recordings");
        }

        if (reset) {
          setRecordings(data.data.recordings);
        } else {
          setRecordings((prev) => [...prev, ...data.data.recordings]);
        }
        setNextPageToken(data.data.nextPageToken);
      } catch (error) {
        console.error("Failed to load recordings:", error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to load recordings",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [provider, nextPageToken, toast, dateRange]
  );

  useEffect(() => {
    if (open) {
      setRecordings([]);
      setSelected(new Set());
      setNextPageToken(undefined);
      setSearchQuery("");
      loadRecordings(true);
    }
  }, [open, loadRecordings]);

  // Filter and sort recordings
  const filteredRecordings = useMemo(() => {
    let result = [...recordings];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((r) => {
        const title = r.topic || r.meetingTitle || r.name || "";
        return title.toLowerCase().includes(query);
      });
    }

    // Apply duration filter
    if (minDuration !== null) {
      result = result.filter((r) => r.duration >= minDuration);
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "date": {
          const dateA = a.startTime || a.createdTime;
          const dateB = b.startTime || b.createdTime;
          comparison = (dateA ? new Date(dateA).getTime() : 0) - (dateB ? new Date(dateB).getTime() : 0);
          break;
        }
        case "name": {
          const nameA = (a.topic || a.meetingTitle || a.name || "").toLowerCase();
          const nameB = (b.topic || b.meetingTitle || b.name || "").toLowerCase();
          comparison = nameA.localeCompare(nameB);
          break;
        }
        case "duration":
          comparison = a.duration - b.duration;
          break;
        case "size":
          comparison = a.fileSize - b.fileSize;
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [recordings, searchQuery, sortField, sortOrder, minDuration]);

  const handleToggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selected.size === filteredRecordings.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredRecordings.map((r) => r.id)));
    }
  };

  const handleImport = async () => {
    if (selected.size === 0) return;

    try {
      setImporting(true);

      const selectedRecordings = recordings.filter((r) => selected.has(r.id));
      const recordingsToImport = selectedRecordings.map((r) => ({
        externalId: r.id,
        downloadUrl: r.downloadUrl,
        title: r.topic || r.meetingTitle || r.name || "Meeting Recording",
        duration: r.duration,
        fileSize: r.fileSize,
        meetingDate: (r.startTime || r.createdTime)?.toISOString(),
      }));

      const response = await fetch("/api/integrations/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider,
          recordings: recordingsToImport,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to import recordings");
      }

      toast({
        title: "Import Started",
        description: `${data.data.imported} recording${data.data.imported !== 1 ? "s" : ""} are being imported. You'll find them in your videos once complete.`,
      });

      onClose();
    } catch (error) {
      console.error("Failed to import recordings:", error);
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import recordings",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "Unknown size";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getTotalSelectedSize = () => {
    const selectedRecordings = recordings.filter((r) => selected.has(r.id));
    const totalBytes = selectedRecordings.reduce((sum, r) => sum + r.fileSize, 0);
    return formatFileSize(totalBytes);
  };

  const getTotalSelectedDuration = () => {
    const selectedRecordings = recordings.filter((r) => selected.has(r.id));
    const totalMinutes = selectedRecordings.reduce((sum, r) => sum + r.duration, 0);
    return formatDuration(totalMinutes);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            {providerName} Recordings
          </DialogTitle>
          <DialogDescription>Select recordings to import into your organization</DialogDescription>
        </DialogHeader>

        {/* Search and Filter Bar */}
        <div className="flex flex-col gap-3 py-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search recordings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* Date Range Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <CalendarDays className="h-4 w-4" />
                  {dateRange === "all"
                    ? "All time"
                    : dateRange === "7"
                      ? "Last 7 days"
                      : dateRange === "30"
                        ? "Last 30 days"
                        : "Last 90 days"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Date Range</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
                  <DropdownMenuRadioItem value="7">Last 7 days</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="30">Last 30 days</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="90">Last 90 days</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="all">All time</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  {sortOrder === "asc" ? <ArrowUpAZ className="h-4 w-4" /> : <ArrowDownAZ className="h-4 w-4" />}
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
                  <DropdownMenuRadioItem value="date">Date</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="duration">Duration</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="size">Size</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Order</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={sortOrder} onValueChange={(v) => setSortOrder(v as SortOrder)}>
                  <DropdownMenuRadioItem value="desc">Newest first</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="asc">Oldest first</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Filter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Minimum Duration</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={minDuration?.toString() || "none"}
                  onValueChange={(v) => setMinDuration(v === "none" ? null : Number.parseInt(v))}
                >
                  <DropdownMenuRadioItem value="none">No minimum</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="5">5+ minutes</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="15">15+ minutes</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="30">30+ minutes</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="60">1+ hour</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="icon" onClick={() => loadRecordings(true)} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {/* Selection Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={filteredRecordings.length > 0 && selected.size === filteredRecordings.length}
                onCheckedChange={handleSelectAll}
                disabled={filteredRecordings.length === 0 || loading}
              />
              <span className="text-sm text-muted-foreground">
                {selected.size > 0 ? (
                  <>
                    {selected.size} selected
                    <span className="mx-2">·</span>
                    {getTotalSelectedDuration()}
                    <span className="mx-2">·</span>
                    {getTotalSelectedSize()}
                  </>
                ) : (
                  `${filteredRecordings.length} recording${filteredRecordings.length !== 1 ? "s" : ""}`
                )}
              </span>
            </div>
            {searchQuery && (
              <Badge variant="secondary" className="gap-1">
                <Search className="h-3 w-3" />
                {filteredRecordings.length} result{filteredRecordings.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {loading && recordings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Loading recordings...</p>
            </div>
          ) : filteredRecordings.length === 0 ? (
            <div className="text-center py-12">
              <FileVideo className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              {searchQuery ? (
                <>
                  <p className="text-muted-foreground">No recordings match your search</p>
                  <Button variant="link" className="mt-2" onClick={() => setSearchQuery("")}>
                    Clear search
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground">No recordings found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Recordings from the last {dateRange === "all" ? "" : dateRange + " days"} will appear here
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRecordings.map((recording) => {
                const date = recording.startTime || recording.createdTime;
                const title = recording.topic || recording.meetingTitle || recording.name || "Meeting Recording";
                const isSelected = selected.has(recording.id);

                return (
                  <div
                    key={recording.id}
                    className={`group flex items-start gap-3 p-4 rounded-lg border transition-all cursor-pointer hover:shadow-sm ${
                      isSelected
                        ? "bg-primary/5 border-primary/50 shadow-sm"
                        : "hover:bg-muted/50 hover:border-muted-foreground/20"
                    }`}
                    onClick={() => handleToggle(recording.id)}
                  >
                    <div className="flex items-center justify-center pt-0.5">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleToggle(recording.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate group-hover:text-primary transition-colors">{title}</p>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-muted-foreground">
                            {date && (
                              <span className="flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5" />
                                <span>{format(new Date(date), "MMM d, yyyy")}</span>
                                <span className="text-muted-foreground/60">
                                  ({formatDistanceToNow(new Date(date), { addSuffix: true })})
                                </span>
                              </span>
                            )}
                            <span className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5" />
                              {formatDuration(recording.duration)}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Download className="h-3.5 w-3.5" />
                              {formatFileSize(recording.fileSize)}
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

              {nextPageToken && (
                <Button variant="outline" className="w-full mt-4" onClick={() => loadRecordings()} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Load More Recordings"
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
                Ready to import {selected.size} recording{selected.size !== 1 ? "s" : ""}
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
                Import {selected.size > 0 ? `${selected.size} ` : ""}Recording
                {selected.size !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
