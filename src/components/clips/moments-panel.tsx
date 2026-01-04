"use client";

import { CheckCircle, Clock, Lightbulb, Loader2, MessageSquare, Play, Plus, Share2, Target } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { MomentType } from "@/lib/db/schema";
import { copyToClipboard } from "@/lib/notifications";
import { cn } from "@/lib/utils";

interface Moment {
  id: string;
  title: string;
  description: string | null;
  startTime: number;
  endTime: number;
  momentType: MomentType;
  confidence: number;
  transcriptExcerpt: string | null;
}

interface MomentsPanelProps {
  videoId: string;
  onSeek?: (time: number) => void;
  onCreateClip?: (moment: Moment) => void;
}

const momentTypeConfig: Record<MomentType, { icon: React.ElementType; label: string; color: string }> = {
  decision: { icon: Target, label: "Decision", color: "bg-purple-500/10 text-purple-500" },
  action_item: { icon: CheckCircle, label: "Action Item", color: "bg-green-500/10 text-green-500" },
  question: { icon: MessageSquare, label: "Question", color: "bg-blue-500/10 text-blue-500" },
  answer: { icon: MessageSquare, label: "Answer", color: "bg-cyan-500/10 text-cyan-500" },
  emphasis: { icon: Lightbulb, label: "Key Point", color: "bg-yellow-500/10 text-yellow-500" },
  demonstration: { icon: Play, label: "Demo", color: "bg-orange-500/10 text-orange-500" },
  conclusion: { icon: CheckCircle, label: "Conclusion", color: "bg-indigo-500/10 text-indigo-500" },
  highlight: { icon: Lightbulb, label: "Highlight", color: "bg-pink-500/10 text-pink-500" },
};

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function MomentsPanel({ videoId, onSeek, onCreateClip }: MomentsPanelProps) {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMoments() {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/videos/${videoId}/moments?minConfidence=50`);
        if (!response.ok) {
          throw new Error("Failed to fetch moments");
        }
        const data = await response.json();
        setMoments(data.data?.moments || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load moments");
      } finally {
        setIsLoading(false);
      }
    }

    fetchMoments();
  }, [videoId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-center text-sm text-muted-foreground">{error}</div>;
  }

  if (moments.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No key moments detected yet. Moments will appear here after video processing completes.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold text-sm">Key Moments</h3>
        <Badge variant="secondary" className="text-xs">
          {moments.length} detected
        </Badge>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {moments.map((moment) => {
            const config = momentTypeConfig[moment.momentType];
            const Icon = config.icon;

            return (
              <button
                type="button"
                key={moment.id}
                className="group rounded-lg border bg-card p-3 hover:bg-accent/50 transition-colors cursor-pointer w-full text-left"
                onClick={() => onSeek?.(moment.startTime)}
              >
                <div className="flex items-start gap-2">
                  <div className={cn("p-1.5 rounded-md", config.color)}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(moment.startTime)} - {formatTime(moment.endTime)}
                      </span>
                      <Badge variant="outline" className="text-[10px] h-4 px-1">
                        {config.label}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium line-clamp-2">{moment.title}</p>
                    {moment.transcriptExcerpt && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">"{moment.transcriptExcerpt}"</p>
                    )}
                    <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSeek?.(moment.startTime);
                        }}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Preview
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCreateClip?.(moment);
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Clip
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          const url = new URL(window.location.href);
                          url.searchParams.set("t", String(Math.floor(moment.startTime)));
                          copyToClipboard(url.toString(), "Moment link copied");
                        }}
                      >
                        <Share2 className="h-3 w-3 mr-1" />
                        Share
                      </Button>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
