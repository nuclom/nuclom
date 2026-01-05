"use client";

import { CircleDot, File, Folder, GitCommit, GitPullRequest, Link2, Loader2 } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CreateCodeLinkInput } from "@/hooks/use-code-links";
import type { CodeLinkType } from "@/lib/db/schema";

// =============================================================================
// Link Type Options
// =============================================================================

const LINK_TYPE_OPTIONS: Array<{
  value: CodeLinkType;
  label: string;
  icon: typeof GitPullRequest;
  description: string;
}> = [
  {
    value: "pr",
    label: "Pull Request",
    icon: GitPullRequest,
    description: "Link to a GitHub pull request",
  },
  {
    value: "issue",
    label: "Issue",
    icon: CircleDot,
    description: "Link to a GitHub issue",
  },
  {
    value: "commit",
    label: "Commit",
    icon: GitCommit,
    description: "Link to a specific commit",
  },
  {
    value: "file",
    label: "File",
    icon: File,
    description: "Link to a specific file",
  },
  {
    value: "directory",
    label: "Directory",
    icon: Folder,
    description: "Link to a directory",
  },
];

// =============================================================================
// Time Input Helpers
// =============================================================================

function formatTimeInput(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function parseTimeInput(timeStr: string): number | null {
  if (!timeStr.trim()) return null;

  const parts = timeStr.split(":").map((p) => Number.parseInt(p, 10));
  if (parts.length === 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1]) && !Number.isNaN(parts[2])) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return null;
}

// =============================================================================
// Add Code Link Dialog Component
// =============================================================================

interface AddCodeLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateCodeLinkInput) => Promise<void>;
  initialTimestamp?: number;
}

export function AddCodeLinkDialog({ open, onOpenChange, onSubmit, initialTimestamp }: AddCodeLinkDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [type, setType] = useState<CodeLinkType>("pr");
  const [repo, setRepo] = useState("");
  const [ref, setRef] = useState("");
  const [context, setContext] = useState("");
  const [timestampStr, setTimestampStr] = useState(
    initialTimestamp !== undefined ? formatTimeInput(initialTimestamp) : "",
  );
  const [timestampEndStr, setTimestampEndStr] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setType("pr");
    setRepo("");
    setRef("");
    setContext("");
    setTimestampStr(initialTimestamp !== undefined ? formatTimeInput(initialTimestamp) : "");
    setTimestampEndStr("");
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate repo format (owner/repo)
    const repoPattern = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
    if (!repo.trim()) {
      newErrors.repo = "Repository is required";
    } else if (!repoPattern.test(repo)) {
      newErrors.repo = "Invalid format. Use owner/repo (e.g., facebook/react)";
    }

    // Validate ref
    if (!ref.trim()) {
      newErrors.ref = "Reference is required";
    }

    // Validate timestamps if provided
    if (timestampStr.trim()) {
      const timestamp = parseTimeInput(timestampStr);
      if (timestamp === null) {
        newErrors.timestamp = "Invalid time format. Use MM:SS or HH:MM:SS";
      }
    }

    if (timestampEndStr.trim()) {
      const timestampEnd = parseTimeInput(timestampEndStr);
      if (timestampEnd === null) {
        newErrors.timestampEnd = "Invalid time format. Use MM:SS or HH:MM:SS";
      } else if (timestampStr.trim()) {
        const timestamp = parseTimeInput(timestampStr);
        if (timestamp !== null && timestampEnd <= timestamp) {
          newErrors.timestampEnd = "End time must be after start time";
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const timestamp = timestampStr.trim() ? parseTimeInput(timestampStr) : undefined;
      const timestampEnd = timestampEndStr.trim() ? parseTimeInput(timestampEndStr) : undefined;

      await onSubmit({
        type,
        repo: repo.trim(),
        ref: ref.trim(),
        context: context.trim() || undefined,
        timestamp: timestamp ?? undefined,
        timestampEnd: timestampEnd ?? undefined,
      });

      resetForm();
      onOpenChange(false);
    } catch {
      // Error is handled by the hook's toast
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTypeOption = LINK_TYPE_OPTIONS.find((opt) => opt.value === type);
  const TypeIcon = selectedTypeOption?.icon || Link2;

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen) {
          resetForm();
        }
        onOpenChange(newOpen);
      }}
    >
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Add GitHub Code Link
          </DialogTitle>
          <DialogDescription>Link a GitHub PR, issue, commit, file, or directory to this video.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Type Selector */}
            <div className="grid gap-2">
              <Label htmlFor="type">Type</Label>
              <Select value={type} onValueChange={(value) => setType(value as CodeLinkType)}>
                <SelectTrigger id="type">
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <TypeIcon className="h-4 w-4" />
                      <span>{selectedTypeOption?.label}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {LINK_TYPE_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <div>
                            <div className="font-medium">{option.label}</div>
                            <div className="text-xs text-muted-foreground">{option.description}</div>
                          </div>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Repository */}
            <div className="grid gap-2">
              <Label htmlFor="repo">
                Repository <span className="text-destructive">*</span>
              </Label>
              <Input
                id="repo"
                placeholder="owner/repo (e.g., facebook/react)"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                className={errors.repo ? "border-destructive" : ""}
              />
              {errors.repo && <p className="text-xs text-destructive">{errors.repo}</p>}
            </div>

            {/* Reference */}
            <div className="grid gap-2">
              <Label htmlFor="ref">
                Reference <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ref"
                placeholder={
                  type === "pr"
                    ? "PR number (e.g., 123)"
                    : type === "issue"
                      ? "Issue number (e.g., 456)"
                      : type === "commit"
                        ? "Commit hash (e.g., abc123)"
                        : "File or directory path"
                }
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                className={errors.ref ? "border-destructive" : ""}
              />
              {errors.ref && <p className="text-xs text-destructive">{errors.ref}</p>}
            </div>

            {/* Context */}
            <div className="grid gap-2">
              <Label htmlFor="context">Context (optional)</Label>
              <Textarea
                id="context"
                placeholder="Add notes or context about this code link..."
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={3}
              />
            </div>

            {/* Timestamps */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="timestamp">Start Time (optional)</Label>
                <Input
                  id="timestamp"
                  placeholder="MM:SS"
                  value={timestampStr}
                  onChange={(e) => setTimestampStr(e.target.value)}
                  className={errors.timestamp ? "border-destructive" : ""}
                />
                {errors.timestamp && <p className="text-xs text-destructive">{errors.timestamp}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="timestampEnd">End Time (optional)</Label>
                <Input
                  id="timestampEnd"
                  placeholder="MM:SS"
                  value={timestampEndStr}
                  onChange={(e) => setTimestampEndStr(e.target.value)}
                  className={errors.timestampEnd ? "border-destructive" : ""}
                />
                {errors.timestampEnd && <p className="text-xs text-destructive">{errors.timestampEnd}</p>}
              </div>
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
                  Adding...
                </>
              ) : (
                "Add Link"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
