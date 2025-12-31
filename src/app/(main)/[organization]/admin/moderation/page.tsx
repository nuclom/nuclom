"use client";

import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter,
  Loader2,
  MessageSquare,
  Shield,
  User,
  Video,
  X,
  XCircle,
} from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth/auth-guard";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { ReportCategory, ReportResolution, ReportResourceType, ReportStatus } from "@/lib/db/schema";

interface Reporter {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface Report {
  id: string;
  reporterId: string | null;
  resourceType: ReportResourceType;
  resourceId: string;
  category: ReportCategory;
  description: string | null;
  status: ReportStatus;
  resolution: ReportResolution | null;
  resolvedById: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  createdAt: string;
  reporter: Reporter | null;
}

interface ReportsResponse {
  reports: Report[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const statusColors: Record<ReportStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  reviewing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  dismissed: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

const categoryLabels: Record<ReportCategory, string> = {
  inappropriate: "Inappropriate",
  spam: "Spam",
  copyright: "Copyright",
  harassment: "Harassment",
  other: "Other",
};

const resourceTypeIcons: Record<ReportResourceType, React.ReactNode> = {
  video: <Video className="h-4 w-4" />,
  comment: <MessageSquare className="h-4 w-4" />,
  user: <User className="h-4 w-4" />,
};

function ModerationDashboard() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const organization = params.organization as string;

  const [reports, setReports] = useState<Report[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState<"dismiss" | "remove" | "warn" | "suspend" | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "all">(
    (searchParams.get("status") as ReportStatus) || "pending",
  );
  const [categoryFilter, setCategoryFilter] = useState<ReportCategory | "all">(
    (searchParams.get("category") as ReportCategory) || "all",
  );
  const [resourceTypeFilter, setResourceTypeFilter] = useState<ReportResourceType | "all">(
    (searchParams.get("resourceType") as ReportResourceType) || "all",
  );

  // Fetch reports
  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (resourceTypeFilter !== "all") params.set("resourceType", resourceTypeFilter);
      params.set("page", pagination.page.toString());
      params.set("limit", "20");

      const response = await fetch(`/api/reports?${params.toString()}`);

      if (response.status === 403) {
        toast({
          title: "Access Denied",
          description: "You don't have permission to access the moderation dashboard.",
          variant: "destructive",
        });
        router.push(`/${organization}`);
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch reports");
      }

      const data: ReportsResponse = await response.json();
      setReports(data.reports);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Fetch reports error:", error);
      toast({
        title: "Error",
        description: "Failed to load reports. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, categoryFilter, resourceTypeFilter, pagination.page, toast, router, organization]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Handle action
  const handleAction = useCallback((report: Report, action: "dismiss" | "remove" | "warn" | "suspend") => {
    setSelectedReport(report);
    setActionType(action);
    setResolutionNotes("");
    setShowActionDialog(true);
  }, []);

  const submitAction = useCallback(async () => {
    if (!selectedReport || !actionType) return;

    setIsSubmitting(true);

    try {
      let status: ReportStatus;
      let resolution: ReportResolution;

      switch (actionType) {
        case "dismiss":
          status = "dismissed";
          resolution = "no_action";
          break;
        case "remove":
          status = "resolved";
          resolution = "content_removed";
          break;
        case "warn":
          status = "resolved";
          resolution = "user_warned";
          break;
        case "suspend":
          status = "resolved";
          resolution = "user_suspended";
          break;
      }

      const response = await fetch("/api/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: selectedReport.id,
          status,
          resolution,
          resolutionNotes: resolutionNotes.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update report");
      }

      toast({
        title: "Report updated",
        description: `Report has been ${actionType === "dismiss" ? "dismissed" : "resolved"}.`,
      });

      // Refresh reports
      fetchReports();
    } catch (error) {
      console.error("Action error:", error);
      toast({
        title: "Error",
        description: "Failed to update report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setShowActionDialog(false);
      setSelectedReport(null);
      setActionType(null);
    }
  }, [selectedReport, actionType, resolutionNotes, toast, fetchReports]);

  const getActionDescription = () => {
    switch (actionType) {
      case "dismiss":
        return "Dismiss this report without taking action. The content will remain visible.";
      case "remove":
        return "Remove the reported content. The user will be notified.";
      case "warn":
        return "Send a warning to the user about their content. The content will be removed.";
      case "suspend":
        return "Suspend the user's account and remove the content.";
      default:
        return "";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8" />
          Content Moderation
        </h1>
        <p className="text-muted-foreground mt-1">Review and take action on reported content.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
                <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pagination.total}</p>
                <p className="text-sm text-muted-foreground">Pending Reports</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="w-40">
              <Label className="text-xs mb-1.5 block">Status</Label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ReportStatus | "all")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="reviewing">Reviewing</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-40">
              <Label className="text-xs mb-1.5 block">Category</Label>
              <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as ReportCategory | "all")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="inappropriate">Inappropriate</SelectItem>
                  <SelectItem value="spam">Spam</SelectItem>
                  <SelectItem value="copyright">Copyright</SelectItem>
                  <SelectItem value="harassment">Harassment</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-40">
              <Label className="text-xs mb-1.5 block">Content Type</Label>
              <Select
                value={resourceTypeFilter}
                onValueChange={(v) => setResourceTypeFilter(v as ReportResourceType | "all")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="video">Videos</SelectItem>
                  <SelectItem value="comment">Comments</SelectItem>
                  <SelectItem value="user">Users</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reports List */}
      <Card>
        <CardHeader>
          <CardTitle>Reports</CardTitle>
          <CardDescription>
            {pagination.total} report{pagination.total !== 1 ? "s" : ""} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <h3 className="text-lg font-medium">All clear!</h3>
              <p className="text-muted-foreground">No reports match your filters.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <div key={report.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Report Header */}
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center gap-1.5">
                          {resourceTypeIcons[report.resourceType]}
                          <span className="text-sm font-medium capitalize">{report.resourceType}</span>
                        </div>
                        <Badge className={statusColors[report.status]}>{report.status}</Badge>
                        <Badge variant="outline">{categoryLabels[report.category]}</Badge>
                      </div>

                      {/* Reporter Info */}
                      {report.reporter && (
                        <div className="flex items-center gap-2 mb-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={report.reporter.image || undefined} />
                            <AvatarFallback className="text-xs">{report.reporter.name?.[0] || "U"}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-muted-foreground">
                            Reported by <strong>{report.reporter.name || report.reporter.email}</strong>
                          </span>
                        </div>
                      )}

                      {/* Description */}
                      {report.description && (
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">"{report.description}"</p>
                      )}

                      {/* Timestamp */}
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}
                      </p>
                    </div>

                    {/* Actions */}
                    {report.status === "pending" || report.status === "reviewing" ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            Take Action
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Moderation Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleAction(report, "dismiss")}>
                            <X className="h-4 w-4 mr-2" />
                            Dismiss Report
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAction(report, "remove")}>
                            <XCircle className="h-4 w-4 mr-2" />
                            Remove Content
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAction(report, "warn")}>
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            Warn User
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleAction(report, "suspend")}
                            className="text-destructive focus:text-destructive"
                          >
                            <Shield className="h-4 w-4 mr-2" />
                            Suspend User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        {report.resolution && (
                          <Badge variant="outline" className="capitalize">
                            {report.resolution.replace("_", " ")}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === 1}
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === pagination.totalPages}
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <AlertDialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "dismiss"
                ? "Dismiss Report"
                : actionType === "remove"
                  ? "Remove Content"
                  : actionType === "warn"
                    ? "Warn User"
                    : "Suspend User"}
            </AlertDialogTitle>
            <AlertDialogDescription>{getActionDescription()}</AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Resolution Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about this action..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={submitAction}
              disabled={isSubmitting}
              className={
                actionType === "suspend" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""
              }
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Confirm"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function ModerationPage() {
  return (
    <RequireAuth>
      <ModerationDashboard />
    </RequireAuth>
  );
}
