"use client";

import { Loader2, Quote } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface CreateQuoteCardDialogProps {
  videoId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: {
    quoteText?: string;
    speaker?: string;
    timestampSeconds?: number;
  };
  onSuccess?: () => void;
}

function formatTimeInput(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function parseTimeInput(timeStr: string): number | null {
  const parts = timeStr.split(":").map((p) => Number.parseInt(p, 10));
  if (parts.length === 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1]) && !Number.isNaN(parts[2])) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return null;
}

export function CreateQuoteCardDialog({
  videoId,
  open,
  onOpenChange,
  initialData,
  onSuccess,
}: CreateQuoteCardDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [quoteText, setQuoteText] = useState(initialData?.quoteText || "");
  const [speaker, setSpeaker] = useState(initialData?.speaker || "");
  const [timestampStr, setTimestampStr] = useState(
    initialData?.timestampSeconds !== undefined ? formatTimeInput(initialData.timestampSeconds) : "",
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!quoteText.trim()) {
      toast({
        title: "Quote text required",
        description: "Please enter the quote text",
        variant: "destructive",
      });
      return;
    }

    let timestampSeconds: number | undefined;
    if (timestampStr.trim()) {
      const parsed = parseTimeInput(timestampStr);
      if (parsed === null) {
        toast({
          title: "Invalid timestamp format",
          description: "Please use MM:SS or HH:MM:SS format",
          variant: "destructive",
        });
        return;
      }
      timestampSeconds = parsed;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/videos/${videoId}/quote-cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteText: quoteText.trim(),
          speaker: speaker.trim() || undefined,
          timestampSeconds,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create quote card");
      }

      toast({
        title: "Quote card created",
        description: "Your quote card has been created successfully.",
      });

      // Reset form
      setQuoteText("");
      setSpeaker("");
      setTimestampStr("");

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast({
        title: "Failed to create quote card",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Quote className="h-5 w-5" />
            Create Quote Card
          </DialogTitle>
          <DialogDescription>Create a shareable quote card from this video.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="quoteText">
                Quote Text <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="quoteText"
                value={quoteText}
                onChange={(e) => setQuoteText(e.target.value)}
                placeholder="Enter the quote..."
                maxLength={500}
                rows={4}
                required
              />
              <p className="text-xs text-muted-foreground">{quoteText.length}/500 characters</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="speaker">Speaker (optional)</Label>
              <Input
                id="speaker"
                value={speaker}
                onChange={(e) => setSpeaker(e.target.value)}
                placeholder="e.g., John Doe"
                maxLength={100}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="timestamp">Timestamp (optional)</Label>
              <Input
                id="timestamp"
                value={timestampStr}
                onChange={(e) => setTimestampStr(e.target.value)}
                placeholder="0:00 or 1:30:00"
              />
              <p className="text-xs text-muted-foreground">Format: MM:SS or HH:MM:SS</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Quote Card"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
