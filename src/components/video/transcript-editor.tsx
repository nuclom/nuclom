"use client";

/**
 * Transcript Editor Component
 *
 * Allows users to edit and correct auto-generated transcripts.
 * Features:
 * - Edit individual segments
 * - Preview changes before saving
 * - Undo/redo support
 * - Split and merge segments
 * - Adjust timestamps
 */

import {
  Check,
  ChevronDown,
  ChevronUp,
  Edit3,
  FileText,
  Loader2,
  Merge,
  RotateCcw,
  RotateCw,
  Save,
  Scissors,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useReducer, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { TranscriptSegment } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

export interface TranscriptEditorProps {
  /** Video ID for saving changes */
  videoId: string;
  /** Initial transcript segments */
  segments: TranscriptSegment[];
  /** Callback when segments are saved */
  onSave?: (segments: TranscriptSegment[]) => Promise<void>;
  /** Whether to show save button (vs auto-save) */
  showSaveButton?: boolean;
  /** Maximum height for the editor */
  maxHeight?: string;
  /** Optional className */
  className?: string;
}

interface EditState {
  segments: TranscriptSegment[];
  history: TranscriptSegment[][];
  historyIndex: number;
  editingIndex: number | null;
  hasUnsavedChanges: boolean;
}

type EditAction =
  | { type: "SET_SEGMENTS"; segments: TranscriptSegment[] }
  | { type: "UPDATE_SEGMENT"; index: number; segment: TranscriptSegment }
  | { type: "DELETE_SEGMENT"; index: number }
  | { type: "SPLIT_SEGMENT"; index: number; splitPosition: number }
  | { type: "MERGE_SEGMENTS"; index: number }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "SET_EDITING"; index: number | null }
  | { type: "MARK_SAVED" };

// =============================================================================
// Reducer
// =============================================================================

function editReducer(state: EditState, action: EditAction): EditState {
  switch (action.type) {
    case "SET_SEGMENTS": {
      return {
        segments: action.segments,
        history: [action.segments],
        historyIndex: 0,
        editingIndex: null,
        hasUnsavedChanges: false,
      };
    }

    case "UPDATE_SEGMENT": {
      const newSegments = [...state.segments];
      newSegments[action.index] = action.segment;

      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(newSegments);

      return {
        ...state,
        segments: newSegments,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        hasUnsavedChanges: true,
      };
    }

    case "DELETE_SEGMENT": {
      const newSegments = state.segments.filter((_, i) => i !== action.index);

      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(newSegments);

      return {
        ...state,
        segments: newSegments,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        editingIndex: null,
        hasUnsavedChanges: true,
      };
    }

    case "SPLIT_SEGMENT": {
      const segment = state.segments[action.index];
      const text = segment.text;
      const midpoint = action.splitPosition || Math.floor(text.length / 2);

      // Find word boundary near midpoint
      let splitIndex = midpoint;
      while (splitIndex > 0 && text[splitIndex] !== " ") {
        splitIndex--;
      }
      if (splitIndex === 0) splitIndex = midpoint;

      const timeMidpoint = (segment.startTime + segment.endTime) / 2;

      const firstSegment: TranscriptSegment = {
        startTime: segment.startTime,
        endTime: timeMidpoint,
        text: text.slice(0, splitIndex).trim(),
        confidence: segment.confidence,
      };

      const secondSegment: TranscriptSegment = {
        startTime: timeMidpoint,
        endTime: segment.endTime,
        text: text.slice(splitIndex).trim(),
        confidence: segment.confidence,
      };

      const newSegments = [
        ...state.segments.slice(0, action.index),
        firstSegment,
        secondSegment,
        ...state.segments.slice(action.index + 1),
      ];

      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(newSegments);

      return {
        ...state,
        segments: newSegments,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        editingIndex: null,
        hasUnsavedChanges: true,
      };
    }

    case "MERGE_SEGMENTS": {
      if (action.index >= state.segments.length - 1) return state;

      const current = state.segments[action.index];
      const next = state.segments[action.index + 1];

      const mergedSegment: TranscriptSegment = {
        startTime: current.startTime,
        endTime: next.endTime,
        text: `${current.text} ${next.text}`,
        confidence:
          current.confidence && next.confidence
            ? (current.confidence + next.confidence) / 2
            : current.confidence || next.confidence,
      };

      const newSegments = [
        ...state.segments.slice(0, action.index),
        mergedSegment,
        ...state.segments.slice(action.index + 2),
      ];

      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(newSegments);

      return {
        ...state,
        segments: newSegments,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        editingIndex: null,
        hasUnsavedChanges: true,
      };
    }

    case "UNDO": {
      if (state.historyIndex <= 0) return state;

      const newIndex = state.historyIndex - 1;
      return {
        ...state,
        segments: state.history[newIndex],
        historyIndex: newIndex,
        editingIndex: null,
        hasUnsavedChanges: true,
      };
    }

    case "REDO": {
      if (state.historyIndex >= state.history.length - 1) return state;

      const newIndex = state.historyIndex + 1;
      return {
        ...state,
        segments: state.history[newIndex],
        historyIndex: newIndex,
        editingIndex: null,
        hasUnsavedChanges: true,
      };
    }

    case "SET_EDITING": {
      return {
        ...state,
        editingIndex: action.index,
      };
    }

    case "MARK_SAVED": {
      return {
        ...state,
        hasUnsavedChanges: false,
      };
    }

    default:
      return state;
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00.000";
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}

function parseTime(timeStr: string): number {
  const parts = timeStr.split(/[:.]/);
  if (parts.length === 3) {
    const mins = Number.parseInt(parts[0], 10) || 0;
    const secs = Number.parseInt(parts[1], 10) || 0;
    const ms = Number.parseInt(parts[2], 10) || 0;
    return mins * 60 + secs + ms / 1000;
  }
  return 0;
}

// =============================================================================
// Segment Editor Dialog
// =============================================================================

interface SegmentEditorDialogProps {
  segment: TranscriptSegment | null;
  index: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (segment: TranscriptSegment) => void;
  onDelete: () => void;
}

function SegmentEditorDialog({ segment, index, open, onOpenChange, onSave, onDelete }: SegmentEditorDialogProps) {
  const [text, setText] = useState(segment?.text || "");
  const [startTime, setStartTime] = useState(formatTime(segment?.startTime || 0));
  const [endTime, setEndTime] = useState(formatTime(segment?.endTime || 0));

  useEffect(() => {
    if (segment) {
      setText(segment.text);
      setStartTime(formatTime(segment.startTime));
      setEndTime(formatTime(segment.endTime));
    }
  }, [segment]);

  const handleSave = useCallback(() => {
    if (!segment) return;

    onSave({
      startTime: parseTime(startTime),
      endTime: parseTime(endTime),
      text: text.trim(),
      confidence: segment.confidence,
    });
    onOpenChange(false);
  }, [segment, text, startTime, endTime, onSave, onOpenChange]);

  const handleDelete = useCallback(() => {
    onDelete();
    onOpenChange(false);
  }, [onDelete, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Segment {index + 1}</DialogTitle>
          <DialogDescription>Correct the auto-generated transcript for this segment.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="text">Text</Label>
            <Textarea
              id="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className="resize-none"
              placeholder="Enter transcript text..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                placeholder="MM:SS.mmm"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                placeholder="MM:SS.mmm"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              <Check className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Segment Row Component
// =============================================================================

interface SegmentRowProps {
  segment: TranscriptSegment;
  index: number;
  isEditing: boolean;
  canMerge: boolean;
  onEdit: () => void;
  onSplit: () => void;
  onMerge: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

function SegmentRow({
  segment,
  index,
  isEditing,
  canMerge,
  onEdit,
  onSplit,
  onMerge,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: SegmentRowProps) {
  return (
    <div
      className={cn(
        "group flex items-start gap-3 p-3 rounded-lg border transition-colors",
        isEditing ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted/50",
      )}
    >
      {/* Index and timestamp */}
      <div className="flex-shrink-0 w-20 text-center">
        <div className="text-xs font-medium text-muted-foreground">#{index + 1}</div>
        <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
          {formatTime(segment.startTime).slice(0, -4)}
        </div>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-relaxed">{segment.text}</p>
        {segment.confidence !== undefined && segment.confidence < 0.8 && (
          <div className="text-[10px] text-yellow-600 dark:text-yellow-400 mt-1">
            Low confidence ({Math.round(segment.confidence * 100)}%)
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
                <Edit3 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit segment</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onSplit}>
                <Scissors className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Split segment</TooltipContent>
          </Tooltip>

          {canMerge && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMerge}>
                  <Merge className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Merge with next</TooltipContent>
            </Tooltip>
          )}

          <div className="flex flex-col -space-y-1">
            <Button variant="ghost" size="icon" className="h-5 w-7" onClick={onMoveUp} disabled={isFirst}>
              <ChevronUp className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-5 w-7" onClick={onMoveDown} disabled={isLast}>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function TranscriptEditor({
  videoId,
  segments: initialSegments,
  onSave,
  showSaveButton = true,
  maxHeight = "400px",
  className,
}: TranscriptEditorProps) {
  const [state, dispatch] = useReducer(editReducer, {
    segments: initialSegments,
    history: [initialSegments],
    historyIndex: 0,
    editingIndex: null,
    hasUnsavedChanges: false,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number>(-1);

  // Reset state when segments change externally
  useEffect(() => {
    dispatch({ type: "SET_SEGMENTS", segments: initialSegments });
  }, [initialSegments]);

  // Can undo/redo
  const canUndo = state.historyIndex > 0;
  const canRedo = state.historyIndex < state.history.length - 1;

  // Handle save
  const handleSave = useCallback(async () => {
    if (!onSave || !state.hasUnsavedChanges) return;

    setIsSaving(true);
    try {
      await onSave(state.segments);
      dispatch({ type: "MARK_SAVED" });
    } catch (error) {
      console.error("Failed to save transcript:", error);
    } finally {
      setIsSaving(false);
    }
  }, [onSave, state.segments, state.hasUnsavedChanges]);

  // Edit handlers
  const handleEditSegment = useCallback((index: number) => {
    setSelectedSegmentIndex(index);
    setEditDialogOpen(true);
  }, []);

  const handleSaveSegment = useCallback(
    (segment: TranscriptSegment) => {
      dispatch({ type: "UPDATE_SEGMENT", index: selectedSegmentIndex, segment });
    },
    [selectedSegmentIndex],
  );

  const handleDeleteSegment = useCallback(() => {
    dispatch({ type: "DELETE_SEGMENT", index: selectedSegmentIndex });
  }, [selectedSegmentIndex]);

  const handleSplitSegment = useCallback((index: number) => {
    dispatch({ type: "SPLIT_SEGMENT", index, splitPosition: 0 });
  }, []);

  const handleMergeSegments = useCallback((index: number) => {
    dispatch({ type: "MERGE_SEGMENTS", index });
  }, []);

  // Move segment up/down (swap with adjacent)
  const handleMoveUp = useCallback(
    (index: number) => {
      if (index <= 0) return;

      const segments = state.segments.map((s) => ({ ...s }));
      const current = segments[index];
      const prev = segments[index - 1];

      // Swap segments and adjust timestamps
      segments[index] = {
        ...prev,
        startTime: current.startTime,
        endTime: current.endTime,
      };
      segments[index - 1] = {
        ...current,
        startTime: prev.startTime,
        endTime: prev.endTime,
      };

      dispatch({ type: "SET_SEGMENTS", segments });
    },
    [state.segments],
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index >= state.segments.length - 1) return;

      const segments = state.segments.map((s) => ({ ...s }));
      const current = segments[index];
      const next = segments[index + 1];

      // Swap segments and adjust timestamps
      segments[index] = {
        ...next,
        startTime: current.startTime,
        endTime: current.endTime,
      };
      segments[index + 1] = {
        ...current,
        startTime: next.startTime,
        endTime: next.endTime,
      };

      dispatch({ type: "SET_SEGMENTS", segments });
    },
    [state.segments],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          dispatch({ type: "REDO" });
        } else {
          dispatch({ type: "UNDO" });
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave]);

  const selectedSegment = selectedSegmentIndex >= 0 ? state.segments[selectedSegmentIndex] : null;

  if (!initialSegments || initialSegments.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Transcript Editor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm text-center py-8">No transcript available to edit.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Transcript Editor
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Click on a segment to edit. Use Ctrl+Z to undo, Ctrl+Shift+Z to redo.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {/* Undo/Redo */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => dispatch({ type: "UNDO" })}
                    disabled={!canUndo}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => dispatch({ type: "REDO" })}
                    disabled={!canRedo}
                  >
                    <RotateCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Save button */}
            {showSaveButton && (
              <Button size="sm" onClick={handleSave} disabled={!state.hasUnsavedChanges || isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Changes
              </Button>
            )}
          </div>
        </div>

        {/* Unsaved changes indicator */}
        {state.hasUnsavedChanges && (
          <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">You have unsaved changes</div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        <ScrollArea style={{ maxHeight }} className="pr-4">
          <div className="space-y-1">
            {state.segments.map((segment, index) => (
              <SegmentRow
                key={`${segment.startTime}-${index}`}
                segment={segment}
                index={index}
                isEditing={state.editingIndex === index}
                canMerge={index < state.segments.length - 1}
                onEdit={() => handleEditSegment(index)}
                onSplit={() => handleSplitSegment(index)}
                onMerge={() => handleMergeSegments(index)}
                onMoveUp={() => handleMoveUp(index)}
                onMoveDown={() => handleMoveDown(index)}
                isFirst={index === 0}
                isLast={index === state.segments.length - 1}
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>

      {/* Edit dialog */}
      <SegmentEditorDialog
        segment={selectedSegment}
        index={selectedSegmentIndex}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={handleSaveSegment}
        onDelete={handleDeleteSegment}
      />
    </Card>
  );
}
