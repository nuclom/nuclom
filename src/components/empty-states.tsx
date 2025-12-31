"use client";

import { Folder, FolderVideo, History, Search, Share2, Upload, Video } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ElementType;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  description,
  icon: Icon = Folder,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-6">
        <Icon className="w-10 h-10 text-muted-foreground/50" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-sm mb-6">{description}</p>
      {(actionLabel && actionHref) && (
        <Button asChild>
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
      {(actionLabel && onAction) && (
        <Button onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  );
}

// Pre-configured empty states for common scenarios

export function EmptyVideos({ organization }: { organization: string }) {
  return (
    <EmptyState
      icon={Video}
      title="No videos yet"
      description="Upload your first video to start building your team's video library."
      actionLabel="Upload Video"
      actionHref={`/${organization}/upload`}
    />
  );
}

export function EmptyChannels({ organization }: { organization: string }) {
  return (
    <EmptyState
      icon={FolderVideo}
      title="No channels yet"
      description="Create channels to organize your videos by topic, team, or project."
      actionLabel="Create Channel"
      actionHref={`/${organization}/channels/new`}
    />
  );
}

export function EmptySearch({ query }: { query?: string }) {
  return (
    <EmptyState
      icon={Search}
      title="No results found"
      description={
        query
          ? `We couldn't find anything matching "${query}". Try a different search term.`
          : "Start typing to search for videos, channels, or team members."
      }
    />
  );
}

export function EmptyHistory() {
  return (
    <EmptyState
      icon={History}
      title="No watch history"
      description="Videos you watch will appear here so you can easily find them again."
    />
  );
}

export function EmptyShared() {
  return (
    <EmptyState
      icon={Share2}
      title="Nothing shared with you"
      description="When teammates share videos with you, they'll appear here."
    />
  );
}

export function EmptyWatchLater({ organization }: { organization: string }) {
  return (
    <EmptyState
      icon={Video}
      title="Watch later is empty"
      description="Save videos to watch later by clicking the bookmark icon on any video."
      actionLabel="Browse Videos"
      actionHref={`/${organization}/videos`}
    />
  );
}
