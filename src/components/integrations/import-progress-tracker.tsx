"use client";

import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileVideo,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ImportedMeeting {
  id: string;
  externalId: string;
  meetingTitle: string | null;
  meetingDate: string | null;
  duration: number | null;
  importStatus: "pending" | "downloading" | "processing" | "completed" | "failed";
  importError: string | null;
  importedAt: string | null;
  videoId: string | null;
  createdAt?: string;
}

interface ImportProgressTrackerProps {
  importedMeetings: ImportedMeeting[];
  onRefresh: () => void;
  organizationSlug: string;
}

export function ImportProgressTracker({ importedMeetings, onRefresh, organizationSlug }: ImportProgressTrackerProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "completed" | "failed">("all");

  // Auto-refresh when there are pending imports
  const hasPendingImports = importedMeetings.some(
    (m) => m.importStatus === "pending" || m.importStatus === "downloading" || m.importStatus === "processing"
  );

  useEffect(() => {
    if (!autoRefresh || !hasPendingImports) return;

    const interval = setInterval(() => {
      onRefresh();
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, hasPendingImports, onRefresh]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setTimeout(() => setRefreshing(false), 500);
  };

  const getStatusIcon = (status: ImportedMeeting["importStatus"]) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "downloading":
        return <Download className="h-4 w-4 text-blue-500 animate-pulse" />;
      case "processing":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: ImportedMeeting["importStatus"]) => {
    const variants: Record<ImportedMeeting["importStatus"], { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "secondary", label: "Pending" },
      downloading: { variant: "default", label: "Downloading" },
      processing: { variant: "default", label: "Processing" },
      completed: { variant: "outline", label: "Completed" },
      failed: { variant: "destructive", label: "Failed" },
    };

    const config = variants[status];
    return (
      <Badge variant={config.variant} className="gap-1">
        {getStatusIcon(status)}
        {config.label}
      </Badge>
    );
  };

  const getProgressValue = (status: ImportedMeeting["importStatus"]) => {
    switch (status) {
      case "pending":
        return 10;
      case "downloading":
        return 40;
      case "processing":
        return 70;
      case "completed":
        return 100;
      case "failed":
        return 0;
    }
  };

  const filteredMeetings = importedMeetings.filter((meeting) => {
    switch (activeFilter) {
      case "active":
        return ["pending", "downloading", "processing"].includes(meeting.importStatus);
      case "completed":
        return meeting.importStatus === "completed";
      case "failed":
        return meeting.importStatus === "failed";
      default:
        return true;
    }
  });

  const activeCounts = {
    all: importedMeetings.length,
    active: importedMeetings.filter((m) => ["pending", "downloading", "processing"].includes(m.importStatus)).length,
    completed: importedMeetings.filter((m) => m.importStatus === "completed").length,
    failed: importedMeetings.filter((m) => m.importStatus === "failed").length,
  };

  // Sort by status (active first) then by date
  const sortedMeetings = [...filteredMeetings].sort((a, b) => {
    const statusOrder = { pending: 0, downloading: 1, processing: 2, failed: 3, completed: 4 };
    const statusDiff = statusOrder[a.importStatus] - statusOrder[b.importStatus];
    if (statusDiff !== 0) return statusDiff;

    // Then by creation date (newest first)
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "Unknown duration";
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Import Activity</CardTitle>
            <CardDescription>Track your meeting recording imports</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {hasPendingImports && (
              <Badge variant="outline" className="gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                {activeCounts.active} active
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filter Tabs */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {(["all", "active", "completed", "failed"] as const).map((filter) => (
            <Button
              key={filter}
              variant={activeFilter === filter ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveFilter(filter)}
              className="gap-1"
            >
              {filter === "all" && "All"}
              {filter === "active" && (
                <>
                  <Loader2 className="h-3 w-3" />
                  Active
                </>
              )}
              {filter === "completed" && (
                <>
                  <CheckCircle2 className="h-3 w-3" />
                  Completed
                </>
              )}
              {filter === "failed" && (
                <>
                  <XCircle className="h-3 w-3" />
                  Failed
                </>
              )}
              <span className="text-muted-foreground">({activeCounts[filter]})</span>
            </Button>
          ))}
        </div>

        {/* Import List */}
        <ScrollArea className="h-[500px]">
          {sortedMeetings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileVideo className="h-12 w-12 mb-4" />
              {activeFilter === "all" ? (
                <>
                  <p className="text-lg font-medium">No imports yet</p>
                  <p className="text-sm">Import recordings from Zoom or Google Meet to see them here.</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-medium">No {activeFilter} imports</p>
                  <p className="text-sm">
                    {activeFilter === "active" && "No imports are currently in progress."}
                    {activeFilter === "completed" && "No imports have been completed yet."}
                    {activeFilter === "failed" && "No imports have failed."}
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {sortedMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className={`
                    p-4 rounded-lg border transition-colors
                    ${meeting.importStatus === "failed" ? "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30" : ""}
                    ${["pending", "downloading", "processing"].includes(meeting.importStatus) ? "border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30" : ""}
                    ${meeting.importStatus === "completed" ? "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/30" : ""}
                  `}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium truncate">{meeting.meetingTitle || "Untitled Recording"}</p>
                        {getStatusBadge(meeting.importStatus)}
                      </div>

                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        {meeting.meetingDate && (
                          <span>{formatDistanceToNow(new Date(meeting.meetingDate), { addSuffix: true })}</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(meeting.duration)}
                        </span>
                      </div>

                      {/* Progress bar for active imports */}
                      {["pending", "downloading", "processing"].includes(meeting.importStatus) && (
                        <div className="mt-3">
                          <Progress value={getProgressValue(meeting.importStatus)} className="h-1.5" />
                          <p className="text-xs text-muted-foreground mt-1">
                            {meeting.importStatus === "pending" && "Waiting to start..."}
                            {meeting.importStatus === "downloading" && "Downloading from provider..."}
                            {meeting.importStatus === "processing" && "Processing video..."}
                          </p>
                        </div>
                      )}

                      {/* Error message for failed imports */}
                      {meeting.importStatus === "failed" && meeting.importError && (
                        <div className="mt-2 flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                          <p>{meeting.importError}</p>
                        </div>
                      )}

                      {/* Success info for completed imports */}
                      {meeting.importStatus === "completed" && meeting.importedAt && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Imported {formatDistanceToNow(new Date(meeting.importedAt), { addSuffix: true })}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    {meeting.importStatus === "completed" && meeting.videoId && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/${organizationSlug}/videos/${meeting.videoId}`}>
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Auto-refresh toggle */}
        {hasPendingImports && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t text-sm text-muted-foreground">
            <span>Auto-refresh every 5 seconds</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={autoRefresh ? "text-green-600" : ""}
            >
              {autoRefresh ? "Enabled" : "Disabled"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
