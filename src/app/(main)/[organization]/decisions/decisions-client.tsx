"use client";

import { Download, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { DecisionCard, DecisionFilters, DecisionForm } from "@/components/decisions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import type { DecisionTag } from "@/lib/db/schema";
import type { DecisionFilters as DecisionFiltersType, DecisionWithSummary, PaginatedResponse } from "@/lib/types";

interface DecisionRegistryClientProps {
  organization: string;
  organizationId: string;
  initialDecisions: PaginatedResponse<DecisionWithSummary>;
  initialTags: DecisionTag[];
  initialFilters?: DecisionFiltersType;
  initialPage?: number;
}

export function DecisionRegistryClient({
  organization,
  organizationId,
  initialDecisions,
  initialTags,
  initialFilters,
  initialPage = 1,
}: DecisionRegistryClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [decisions, setDecisions] = useState<DecisionWithSummary[]>(initialDecisions.data);
  const [pagination, setPagination] = useState(initialDecisions.pagination);
  const [tags, setTags] = useState<DecisionTag[]>(initialTags);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDecision, setEditingDecision] = useState<DecisionWithSummary | null>(null);

  // Fetch decisions when filters change
  const fetchDecisions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams(searchParams.toString());
      params.set("organizationId", organizationId);

      const response = await fetch(`/api/decisions?${params.toString()}`);
      if (response.ok) {
        const data: PaginatedResponse<DecisionWithSummary> = await response.json();
        setDecisions(data.data);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Failed to fetch decisions:", error);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, searchParams]);

  // Fetch tags
  const fetchTags = useCallback(async () => {
    try {
      const response = await fetch(`/api/decisions/tags?organizationId=${organizationId}`);
      if (response.ok) {
        const data = await response.json();
        setTags(data);
      }
    } catch (error) {
      console.error("Failed to fetch tags:", error);
    }
  }, [organizationId]);

  // Load data on mount and when params change
  useEffect(() => {
    fetchDecisions();
    fetchTags();
  }, [fetchDecisions, fetchTags]);

  const handleEdit = (decision: DecisionWithSummary) => {
    setEditingDecision(decision);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/decisions/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchDecisions();
      }
    } catch (error) {
      console.error("Failed to delete decision:", error);
    }
  };

  const handleFormClose = (open: boolean) => {
    if (!open) {
      setEditingDecision(null);
    }
    setIsFormOpen(open);
  };

  const handleFormSuccess = () => {
    fetchDecisions();
    fetchTags();
  };

  const handleExport = async (format: "json" | "markdown" | "csv") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("organizationId", organizationId);
    params.set("format", format);

    try {
      const response = await fetch(`/api/decisions/export?${params.toString()}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `decisions.${format === "markdown" ? "md" : format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Failed to export decisions:", error);
    }
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    router.push(`/${organization}/decisions?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Decision Registry</h1>
          <p className="text-muted-foreground mt-1">Track and manage team decisions</p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("json")}>Export as JSON</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("markdown")}>Export as Markdown</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("csv")}>Export as CSV</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Decision
          </Button>
        </div>
      </div>

      {/* Filters */}
      <DecisionFilters organization={organization} tags={tags} />

      {/* Decisions Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-[200px] w-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : decisions.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium">No decisions found</h3>
          <p className="text-muted-foreground mt-1">
            {searchParams.toString() ? "Try adjusting your filters" : "Start by creating your first decision"}
          </p>
          {!searchParams.toString() && (
            <Button className="mt-4" onClick={() => setIsFormOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Decision
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {decisions.map((decision) => (
              <DecisionCard
                key={decision.id}
                decision={decision}
                organization={organization}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Decision Form */}
      <DecisionForm
        open={isFormOpen}
        onOpenChange={handleFormClose}
        organizationId={organizationId}
        decision={editingDecision}
        availableTags={tags}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}
