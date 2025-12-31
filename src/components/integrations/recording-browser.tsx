"use client";

import { format } from "date-fns";
import { Calendar, Check, Clock, Download, FileVideo, Loader2, RefreshCw, Video } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
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

export function RecordingBrowser({ provider, open, onClose, organizationSlug }: RecordingBrowserProps) {
  const { toast } = useToast();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();

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
    [provider, nextPageToken, toast],
  );

  useEffect(() => {
    if (open) {
      setRecordings([]);
      setSelected(new Set());
      setNextPageToken(undefined);
      loadRecordings(true);
    }
  }, [open, loadRecordings]);

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
    if (selected.size === recordings.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(recordings.map((r) => r.id)));
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

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            {providerName} Recordings
          </DialogTitle>
          <DialogDescription>Select recordings to import into your organization</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={recordings.length > 0 && selected.size === recordings.length}
              onCheckedChange={handleSelectAll}
              disabled={recordings.length === 0 || loading}
            />
            <span className="text-sm text-muted-foreground">
              {selected.size > 0 ? `${selected.size} selected` : `${recordings.length} recordings`}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => loadRecordings(true)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {loading && recordings.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : recordings.length === 0 ? (
            <div className="text-center py-12">
              <FileVideo className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No recordings found</p>
              <p className="text-sm text-muted-foreground mt-1">Recordings from the last 30 days will appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recordings.map((recording) => {
                const date = recording.startTime || recording.createdTime;
                const title = recording.topic || recording.meetingTitle || recording.name || "Meeting Recording";

                return (
                  <div
                    key={recording.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer hover:bg-muted/50 ${
                      selected.has(recording.id) ? "bg-muted border-primary" : ""
                    }`}
                    onClick={() => handleToggle(recording.id)}
                  >
                    <Checkbox
                      checked={selected.has(recording.id)}
                      onCheckedChange={() => handleToggle(recording.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{title}</p>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        {date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(date), "MMM d, yyyy")}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(recording.duration)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Download className="h-3 w-3" />
                          {formatFileSize(recording.fileSize)}
                        </span>
                      </div>
                    </div>
                    {selected.has(recording.id) && (
                      <Badge variant="secondary">
                        <Check className="h-3 w-3" />
                      </Badge>
                    )}
                  </div>
                );
              })}

              {nextPageToken && (
                <Button variant="ghost" className="w-full" onClick={() => loadRecordings()} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Load More
                </Button>
              )}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={importing}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={selected.size === 0 || importing}>
            {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Import {selected.size > 0 ? `${selected.size} ` : ""}Recording
            {selected.size !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
