"use client";

import {
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Eye,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  User,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth/auth-guard";
import { Badge } from "@/components/ui/badge";
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type AuditLog = {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  actorType: string;
  category: string;
  action: string;
  description: string | null;
  severity: "info" | "warning" | "error" | "critical";
  resourceType: string | null;
  resourceId: string | null;
  resourceName: string | null;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
};

type Stats = {
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  total: number;
  periodDays: number;
};

const CATEGORIES = [
  { value: "authentication", label: "Authentication" },
  { value: "authorization", label: "Authorization" },
  { value: "user_management", label: "User Management" },
  { value: "organization_management", label: "Organization" },
  { value: "content_management", label: "Content" },
  { value: "billing", label: "Billing" },
  { value: "security", label: "Security" },
  { value: "integration", label: "Integration" },
  { value: "system", label: "System" },
];

const SEVERITIES = [
  { value: "info", label: "Info", color: "bg-blue-500" },
  { value: "warning", label: "Warning", color: "bg-yellow-500" },
  { value: "error", label: "Error", color: "bg-red-500" },
  { value: "critical", label: "Critical", color: "bg-purple-500" },
];

function AuditLogsContent() {
  const params = useParams();
  const organizationId = params.organization as string;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [limit] = useState(25);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState("30");
  const [exportFormat, setExportFormat] = useState<"csv" | "json">("csv");

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const searchParams = new URLSearchParams();
      searchParams.set("limit", String(limit));
      searchParams.set("offset", String(page * limit));

      if (selectedCategories.length > 0) {
        searchParams.set("categories", selectedCategories.join(","));
      }
      if (selectedSeverities.length > 0) {
        searchParams.set("severity", selectedSeverities.join(","));
      }
      if (dateRange !== "all") {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(dateRange, 10));
        searchParams.set("startDate", startDate.toISOString());
      }

      const response = await fetch(`/api/organizations/${organizationId}/audit-logs?${searchParams}`);
      const data = await response.json();

      if (data.success) {
        setLogs(data.data.logs);
        setTotal(data.data.total);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error("Error loading audit logs:", error);
      toast({
        title: "Error",
        description: "Failed to load audit logs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [organizationId, page, limit, selectedCategories, selectedSeverities, dateRange, toast]);

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch(`/api/organizations/${organizationId}/audit-logs/stats?days=${dateRange}`);
      const data = await response.json();

      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  }, [organizationId, dateRange]);

  useEffect(() => {
    loadLogs();
    loadStats();
  }, [loadLogs, loadStats]);

  const handleExport = async () => {
    try {
      setExporting(true);

      const filters: Record<string, unknown> = {};
      if (selectedCategories.length > 0) {
        filters.categories = selectedCategories;
      }
      if (selectedSeverities.length > 0) {
        filters.severity = selectedSeverities;
      }
      if (dateRange !== "all") {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(dateRange, 10));
        filters.startDate = startDate.toISOString();
      }

      const response = await fetch(`/api/organizations/${organizationId}/audit-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: exportFormat, filters }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Export started",
          description: "Your audit log export is being processed. Check back shortly.",
        });
        setExportDialogOpen(false);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error("Error exporting:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start export",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getSeverityBadge = (severity: string) => {
    const severityConfig = SEVERITIES.find((s) => s.value === severity);
    return (
      <Badge variant="outline" className="gap-1.5">
        <div className={`w-2 h-2 rounded-full ${severityConfig?.color || "bg-gray-500"}`} />
        {severityConfig?.label || severity}
      </Badge>
    );
  };

  const getCategoryLabel = (category: string) => {
    return CATEGORIES.find((c) => c.value === category)?.label || category;
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Audit Logs
              </CardTitle>
              <CardDescription>Track and monitor all activity within your organization</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => loadLogs()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={() => setExportDialogOpen(true)}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
              <p className="text-sm text-muted-foreground">Total Events ({dateRange} days)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-yellow-500">
                {(stats.bySeverity.warning || 0).toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground">Warnings</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-500">{(stats.bySeverity.error || 0).toLocaleString()}</div>
              <p className="text-sm text-muted-foreground">Errors</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-purple-500">
                {(stats.bySeverity.critical || 0).toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground">Critical</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px] max-w-sm">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search actions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Filter className="h-4 w-4 mr-2" />
                  Categories
                  {selectedCategories.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {selectedCategories.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuLabel>Categories</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {CATEGORIES.map((category) => (
                  <DropdownMenuCheckboxItem
                    key={category.value}
                    checked={selectedCategories.includes(category.value)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedCategories([...selectedCategories, category.value]);
                      } else {
                        setSelectedCategories(selectedCategories.filter((c) => c !== category.value));
                      }
                      setPage(0);
                    }}
                  >
                    {category.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Severity
                  {selectedSeverities.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {selectedSeverities.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40">
                <DropdownMenuLabel>Severity</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {SEVERITIES.map((severity) => (
                  <DropdownMenuCheckboxItem
                    key={severity.value}
                    checked={selectedSeverities.includes(severity.value)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedSeverities([...selectedSeverities, severity.value]);
                      } else {
                        setSelectedSeverities(selectedSeverities.filter((s) => s !== severity.value));
                      }
                      setPage(0);
                    }}
                  >
                    <div className={`w-2 h-2 rounded-full ${severity.color} mr-2`} />
                    {severity.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Select
              value={dateRange}
              onValueChange={(v) => {
                setDateRange(v);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-40">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>

            {(selectedCategories.length > 0 || selectedSeverities.length > 0) && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSelectedCategories([]);
                  setSelectedSeverities([]);
                  setPage(0);
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No audit logs found</h3>
              <p className="text-sm text-muted-foreground">Try adjusting your filters or check back later.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="w-[120px]">Category</TableHead>
                  <TableHead className="w-[100px]">Severity</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead className="w-[100px]">IP Address</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedLog(log)}
                  >
                    <TableCell className="font-mono text-xs">{formatTimestamp(log.createdAt)}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{log.action}</p>
                        {log.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[300px]">{log.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getCategoryLabel(log.category)}</Badge>
                    </TableCell>
                    <TableCell>{getSeverityBadge(log.severity)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{log.actorEmail || log.actorType}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.ipAddress || "-"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t">
            <p className="text-sm text-muted-foreground">
              Showing {page * limit + 1} - {Math.min((page + 1) * limit, total)} of {total} events
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Log Details Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
            <DialogDescription>
              {selectedLog?.action} - {selectedLog && formatTimestamp(selectedLog.createdAt)}
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Action</Label>
                  <p className="font-medium">{selectedLog.action}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Category</Label>
                  <p className="font-medium">{getCategoryLabel(selectedLog.category)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Severity</Label>
                  <div className="mt-1">{getSeverityBadge(selectedLog.severity)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Actor</Label>
                  <p className="font-medium">{selectedLog.actorEmail || selectedLog.actorType}</p>
                </div>
              </div>

              {selectedLog.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="mt-1">{selectedLog.description}</p>
                </div>
              )}

              {selectedLog.resourceType && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Resource Type</Label>
                    <p className="font-medium">{selectedLog.resourceType}</p>
                  </div>
                  {selectedLog.resourceId && (
                    <div>
                      <Label className="text-muted-foreground">Resource ID</Label>
                      <p className="font-mono text-sm">{selectedLog.resourceId}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">IP Address</Label>
                  <p className="font-mono text-sm">{selectedLog.ipAddress || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">User Agent</Label>
                  <p className="text-sm truncate">{selectedLog.userAgent || "-"}</p>
                </div>
              </div>

              {(selectedLog.previousValue || selectedLog.newValue) && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedLog.previousValue && (
                    <div>
                      <Label className="text-muted-foreground">Previous Value</Label>
                      <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                        {JSON.stringify(selectedLog.previousValue, null, 2)}
                      </pre>
                    </div>
                  )}
                  {selectedLog.newValue && (
                    <div>
                      <Label className="text-muted-foreground">New Value</Label>
                      <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                        {JSON.stringify(selectedLog.newValue, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Additional Metadata</Label>
                  <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Audit Logs</DialogTitle>
            <DialogDescription>Download audit logs matching your current filters</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Export Format</Label>
              <RadioGroup value={exportFormat} onValueChange={(v) => setExportFormat(v as "csv" | "json")}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="csv" id="csv" />
                  <Label htmlFor="csv" className="font-normal">
                    CSV (Spreadsheet compatible)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="json" id="json" />
                  <Label htmlFor="json" className="font-normal">
                    JSON (Structured data)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Export will include:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Time range: {dateRange === "all" ? "All time" : `Last ${dateRange} days`}</li>
                {selectedCategories.length > 0 && (
                  <li>Categories: {selectedCategories.map(getCategoryLabel).join(", ")}</li>
                )}
                {selectedSeverities.length > 0 && <li>Severities: {selectedSeverities.join(", ")}</li>}
                {selectedCategories.length === 0 && selectedSeverities.length === 0 && (
                  <li>All categories and severities</li>
                )}
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AuditLogsSettingsPage() {
  return (
    <RequireAuth>
      <AuditLogsContent />
    </RequireAuth>
  );
}
