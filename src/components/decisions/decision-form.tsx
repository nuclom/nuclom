"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { DecisionWithSummary } from "@/lib/types";
import type { DecisionTag } from "@/lib/db/schema";

interface DecisionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  decision?: DecisionWithSummary | null;
  availableTags?: DecisionTag[];
  onSuccess?: () => void;
}

export function DecisionForm({
  open,
  onOpenChange,
  organizationId,
  decision,
  availableTags = [],
  onSuccess,
}: DecisionFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [summary, setSummary] = useState("");
  const [context, setContext] = useState("");
  const [source, setSource] = useState<"meeting" | "adhoc" | "manual">("manual");
  const [status, setStatus] = useState<"decided" | "proposed" | "superseded">("decided");
  const [decidedAt, setDecidedAt] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState("");

  const isEditing = !!decision;

  // Reset form when dialog opens/closes or decision changes
  useEffect(() => {
    if (open) {
      if (decision) {
        setSummary(decision.summary);
        setContext(decision.context || "");
        setSource(decision.source);
        setStatus(decision.status);
        setDecidedAt(
          decision.decidedAt
            ? new Date(decision.decidedAt).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0]
        );
        setSelectedTags(decision.tagAssignments?.map((ta) => ta.tag.id) || []);
      } else {
        setSummary("");
        setContext("");
        setSource("manual");
        setStatus("decided");
        setDecidedAt(new Date().toISOString().split("T")[0]);
        setSelectedTags([]);
      }
      setNewTagName("");
      setError(null);
    }
  }, [open, decision]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const url = isEditing ? `/api/decisions/${decision.id}` : "/api/decisions";
      const method = isEditing ? "PATCH" : "POST";

      const body: Record<string, unknown> = {
        summary,
        context: context || null,
        source,
        status,
        decidedAt: decidedAt ? new Date(decidedAt).toISOString() : null,
      };

      // Only include organizationId and tagIds for new decisions
      if (!isEditing) {
        body.organizationId = organizationId;
        body.tagIds = selectedTags;
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save decision");
      }

      onOpenChange(false);
      router.refresh();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddTag = async () => {
    if (!newTagName.trim()) return;

    try {
      const response = await fetch("/api/decisions/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          name: newTagName.trim(),
        }),
      });

      if (response.ok) {
        const newTag = await response.json();
        setSelectedTags((prev) => [...prev, newTag.id]);
        setNewTagName("");
        router.refresh();
      }
    } catch {
      // Ignore errors for tag creation
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Decision" : "Create Decision"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Summary */}
            <div className="grid gap-2">
              <Label htmlFor="summary">Summary *</Label>
              <Input
                id="summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Brief description of the decision"
                required
              />
            </div>

            {/* Context */}
            <div className="grid gap-2">
              <Label htmlFor="context">Context</Label>
              <Textarea
                id="context"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Full rationale and background for the decision..."
                rows={4}
              />
            </div>

            {/* Source and Status */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="source">Source</Label>
                <Select value={source} onValueChange={(v) => setSource(v as typeof source)}>
                  <SelectTrigger id="source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="adhoc">Ad-hoc</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="decided">Decided</SelectItem>
                    <SelectItem value="proposed">Proposed</SelectItem>
                    <SelectItem value="superseded">Superseded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Decided At */}
            <div className="grid gap-2">
              <Label htmlFor="decidedAt">Decision Date</Label>
              <Input
                id="decidedAt"
                type="date"
                value={decidedAt}
                onChange={(e) => setDecidedAt(e.target.value)}
              />
            </div>

            {/* Tags */}
            {!isEditing && (
              <div className="grid gap-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 p-3 border rounded-md min-h-[80px]">
                  {availableTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`px-2 py-1 text-sm rounded-full border transition-colors ${
                        selectedTags.includes(tag.id)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted hover:bg-muted/80 border-muted"
                      }`}
                      style={
                        tag.color && selectedTags.includes(tag.id)
                          ? { backgroundColor: tag.color, borderColor: tag.color }
                          : undefined
                      }
                    >
                      #{tag.name}
                    </button>
                  ))}
                  {availableTags.length === 0 && (
                    <span className="text-sm text-muted-foreground">No tags available</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="New tag name"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={handleAddTag}>
                    Add
                  </Button>
                </div>
              </div>
            )}

            {/* Error display */}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !summary.trim()}>
              {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Create Decision"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
