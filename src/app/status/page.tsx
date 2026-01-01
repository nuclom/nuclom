"use client";

import { Activity, CheckCircle2, Clock, Database, HardDrive, Server, Sparkles, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingHeader } from "@/components/marketing-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ServiceStatus {
  service: "database" | "storage" | "ai" | "overall";
  status: "healthy" | "degraded" | "unhealthy" | "not_configured";
  latencyMs: number;
  lastChecked: string;
  uptimePercent: number;
}

interface StatusResponse {
  status: "operational" | "degraded" | "outage";
  services: ServiceStatus[];
  lastUpdated: string;
  history: {
    date: string;
    status: "operational" | "degraded" | "outage";
  }[];
}

const serviceIcons = {
  database: Database,
  storage: HardDrive,
  ai: Sparkles,
  overall: Server,
};

const serviceNames = {
  database: "Database",
  storage: "Cloud Storage (R2)",
  ai: "AI Services",
  overall: "Overall",
};

function StatusBadge({ status }: { status: ServiceStatus["status"] }) {
  if (status === "healthy" || status === "not_configured") {
    return (
      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        {status === "not_configured" ? "Not Configured" : "Operational"}
      </Badge>
    );
  }

  if (status === "degraded") {
    return (
      <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
        <Activity className="w-3 h-3 mr-1" />
        Degraded
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
      <XCircle className="w-3 h-3 mr-1" />
      Outage
    </Badge>
  );
}

function OverallStatusBanner({ status }: { status: StatusResponse["status"] }) {
  if (status === "operational") {
    return (
      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6 text-center">
        <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
        <h2 className="text-2xl font-semibold text-green-600">All Systems Operational</h2>
        <p className="text-muted-foreground mt-2">All services are running smoothly</p>
      </div>
    );
  }

  if (status === "degraded") {
    return (
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-6 text-center">
        <Activity className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
        <h2 className="text-2xl font-semibold text-yellow-600">Degraded Performance</h2>
        <p className="text-muted-foreground mt-2">Some services are experiencing issues</p>
      </div>
    );
  }

  return (
    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 text-center">
      <XCircle className="w-12 h-12 text-red-600 mx-auto mb-3" />
      <h2 className="text-2xl font-semibold text-red-600">Service Outage</h2>
      <p className="text-muted-foreground mt-2">One or more services are currently unavailable</p>
    </div>
  );
}

function ServiceCard({ service }: { service: ServiceStatus }) {
  const Icon = serviceIcons[service.service];
  const name = serviceNames[service.service];

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{name}</CardTitle>
              <CardDescription className="flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3" />
                {formatTimeAgo(service.lastChecked)}
              </CardDescription>
            </div>
          </div>
          <StatusBadge status={service.status} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm">
          <div>
            <span className="text-muted-foreground">Response time</span>
            <p className="font-medium">{service.latencyMs}ms</p>
          </div>
          <div className="text-right">
            <span className="text-muted-foreground">Uptime (24h)</span>
            <p
              className={cn(
                "font-medium",
                service.uptimePercent >= 99
                  ? "text-green-600"
                  : service.uptimePercent >= 95
                    ? "text-yellow-600"
                    : "text-red-600",
              )}
            >
              {service.uptimePercent}%
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function UptimeChart({ history }: { history: StatusResponse["history"] }) {
  // Show last 90 days, most recent on the right
  const days = [...history].reverse().slice(-90);

  // Pad to 90 days if needed
  while (days.length < 90) {
    days.unshift({ date: "", status: "operational" as const });
  }

  const getColorClass = (status: "operational" | "degraded" | "outage") => {
    switch (status) {
      case "operational":
        return "bg-green-500";
      case "degraded":
        return "bg-yellow-500";
      case "outage":
        return "bg-red-500";
    }
  };

  // Calculate overall uptime percentage
  const operationalDays = days.filter((d) => d.status === "operational").length;
  const uptimePercent = Math.round((operationalDays / days.length) * 100 * 100) / 100;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>90-Day Uptime</CardTitle>
            <CardDescription>Historical availability across all services</CardDescription>
          </div>
          <div className="text-right">
            <span
              className={cn(
                "text-2xl font-bold",
                uptimePercent >= 99.9 ? "text-green-600" : uptimePercent >= 99 ? "text-yellow-600" : "text-red-600",
              )}
            >
              {uptimePercent}%
            </span>
            <p className="text-sm text-muted-foreground">uptime</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-0.5">
          {days.map((day, i) => (
            <div
              key={i}
              className={cn(
                "h-8 flex-1 rounded-sm transition-all hover:ring-2 hover:ring-offset-2 hover:ring-offset-background",
                day.date ? getColorClass(day.status) : "bg-muted",
              )}
              title={day.date ? `${day.date}: ${day.status}` : "No data"}
            />
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>90 days ago</span>
          <span>Today</span>
        </div>
        <div className="flex items-center gap-4 mt-4 text-sm">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-green-500" />
            <span>Operational</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-yellow-500" />
            <span>Degraded</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-red-500" />
            <span>Outage</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function StatusPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const response = await fetch("/api/status");
        if (!response.ok) {
          throw new Error("Failed to fetch status");
        }
        const data = await response.json();
        setStatus(data);
        setError(null);
      } catch {
        setError("Unable to load status information");
      } finally {
        setLoading(false);
      }
    }

    fetchStatus();

    // Refresh every 60 seconds
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const formatLastUpdated = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <MarketingHeader />

      <main className="flex-1 py-12">
        <div className="container max-w-4xl mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold tracking-tight mb-2">System Status</h1>
            <p className="text-muted-foreground">Current status and uptime for Nuclom services</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : error ? (
            <Card className="bg-red-500/10 border-red-500/20">
              <CardContent className="p-6 text-center">
                <XCircle className="w-12 h-12 text-red-600 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-red-600">Unable to Load Status</h3>
                <p className="text-muted-foreground mt-2">{error}</p>
              </CardContent>
            </Card>
          ) : status ? (
            <div className="space-y-8">
              {/* Overall Status */}
              <OverallStatusBanner status={status.status} />

              {/* Last Updated */}
              <div className="text-center text-sm text-muted-foreground">
                Last updated: {formatLastUpdated(status.lastUpdated)}
              </div>

              {/* Service Status Cards */}
              <div className="grid gap-4 md:grid-cols-3">
                {status.services.map((service) => (
                  <ServiceCard key={service.service} service={service} />
                ))}
              </div>

              {/* Uptime Chart */}
              <UptimeChart history={status.history} />

              {/* Incident History */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Incidents</CardTitle>
                  <CardDescription>Resolved and ongoing issues</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-600" />
                    <p>No incidents in the last 90 days</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
