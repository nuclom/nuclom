"use client";

import { Calendar, Edit2, ExternalLink, MoreHorizontal, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { DecisionWithSummary } from "@/lib/types";

interface DecisionCardProps {
  decision: DecisionWithSummary;
  organization: string;
  onEdit?: (decision: DecisionWithSummary) => void;
  onDelete?: (id: string) => void;
}

const statusColors: Record<string, string> = {
  decided: "bg-green-500/10 text-green-600 border-green-500/20",
  proposed: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  superseded: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

const sourceLabels: Record<string, string> = {
  meeting: "Meeting",
  adhoc: "Ad-hoc",
  manual: "Manual",
};

export function DecisionCard({ decision, organization, onEdit, onDelete }: DecisionCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(decision.id);
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const formattedDate = new Date(decision.decidedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      <Card className="group relative bg-card hover:bg-accent/50 transition-colors">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <Link
              href={`/${organization}/decisions/${decision.id}`}
              className="flex-1 hover:underline"
            >
              <h3 className="font-semibold leading-tight line-clamp-2">{decision.summary}</h3>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(decision)}>
                    <Edit2 className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href={`/${organization}/decisions/${decision.id}`}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Details
                  </Link>
                </DropdownMenuItem>
                {onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setShowDeleteDialog(true)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-2 flex-wrap mt-2">
            <Badge variant="outline" className={cn("text-xs", statusColors[decision.status])}>
              {decision.status.charAt(0).toUpperCase() + decision.status.slice(1)}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {sourceLabels[decision.source] || decision.source}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {decision.context && (
            <p className="text-sm text-muted-foreground line-clamp-2">{decision.context}</p>
          )}

          {/* Tags */}
          {decision.tagAssignments.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {decision.tagAssignments.slice(0, 3).map((ta) => (
                <Badge
                  key={ta.tag.id}
                  variant="outline"
                  className="text-xs"
                  style={ta.tag.color ? { borderColor: ta.tag.color, color: ta.tag.color } : undefined}
                >
                  #{ta.tag.name}
                </Badge>
              ))}
              {decision.tagAssignments.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{decision.tagAssignments.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{formattedDate}</span>
            </div>

            {decision.participantCount > 0 && (
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>
                  {decision.participantCount} participant{decision.participantCount !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>

          {/* Video link indicator */}
          {decision.videoId && (
            <div className="text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 bg-blue-500 rounded-full" />
                Linked to video
                {decision.videoTimestamp !== undefined && decision.videoTimestamp !== null && (
                  <span> at {formatTimestamp(decision.videoTimestamp)}</span>
                )}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Decision</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this decision? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
