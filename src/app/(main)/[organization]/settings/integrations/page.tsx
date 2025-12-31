"use client";

import { formatDistanceToNow } from "date-fns";
import {
  Calendar,
  Check,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw,
  Settings2,
  Shield,
  Video,
  X,
  Zap,
} from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ImportProgressTracker } from "@/components/integrations/import-progress-tracker";
import { IntegrationSettings } from "@/components/integrations/integration-settings";
import { MeetingCalendar } from "@/components/integrations/meeting-calendar";
import { RecordingBrowser } from "@/components/integrations/recording-browser";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

// Official Zoom icon component
function ZoomIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-labelledby="zoom-icon-title"
    >
      <title id="zoom-icon-title">Zoom</title>
      <rect width="24" height="24" rx="4" fill="#2D8CFF" />
      <path
        d="M5 8.5C5 7.67157 5.67157 7 6.5 7H13.5C14.3284 7 15 7.67157 15 8.5V15.5C15 16.3284 14.3284 17 13.5 17H6.5C5.67157 17 5 16.3284 5 15.5V8.5Z"
        fill="white"
      />
      <path d="M15.5 10L19 7.5V16.5L15.5 14V10Z" fill="white" />
    </svg>
  );
}

// Official Google Meet icon component
function GoogleMeetIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-labelledby="google-meet-icon-title"
    >
      <title id="google-meet-icon-title">Google Meet</title>
      <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" fill="#00832D" />
      <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#0066DA" />
      <path d="M2 7V17L12 12V2L2 7Z" fill="#00AC47" />
      <path d="M12 12L2 17L12 22L22 17L12 12Z" fill="#E94235" />
      <path d="M12 12V22L22 17V7L12 12Z" fill="#00832D" />
      <path d="M22 7L12 12V22L22 17V7Z" fill="#2684FC" />
      <path d="M12 12L22 7L12 2V12Z" fill="#FFBA00" />
      <path
        d="M8.5 9.5H11V14.5H8.5V9.5ZM13 9.5H15.5V11H13V9.5ZM13 12H15.5V14.5H13V12Z"
        fill="white"
        fillOpacity="0.4"
      />
    </svg>
  );
}

interface Integration {
  id: string;
  provider: "zoom" | "google_meet";
  connected: boolean;
  expiresAt: string | null;
  metadata: {
    email?: string;
    accountId?: string;
    autoImport?: boolean;
    lastSync?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface ImportedMeeting {
  id: string;
  externalId: string;
  meetingTitle: string | null;
  meetingDate: string | null;
  duration: number | null;
  importStatus: "pending" | "downloading" | "processing" | "completed" | "failed";
  importError: string | null;
  importedAt: string | null;
  videoId: string | null;
}

const INTEGRATIONS_CONFIG = [
  {
    id: "zoom" as const,
    name: "Zoom",
    description: "Import meeting recordings and access calendar events",
    icon: ZoomIcon,
    color: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950/50",
    borderColor: "border-blue-200 dark:border-blue-800",
    features: ["Cloud recordings", "Meeting transcripts", "Calendar sync", "Auto-import"],
  },
  {
    id: "google_meet" as const,
    name: "Google Meet",
    description: "Import recordings from Google Drive and calendar",
    icon: GoogleMeetIcon,
    color: "text-green-500",
    bgColor: "bg-green-50 dark:bg-green-950/50",
    borderColor: "border-green-200 dark:border-green-800",
    features: ["Drive recordings", "Calendar events", "Meeting notes", "Auto-import"],
  },
] as const;

export default function IntegrationsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const organizationSlug = params.organization as string;

  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [importedMeetings, setImportedMeetings] = useState<ImportedMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<"zoom" | "google_meet" | null>(null);
  const [_showCalendar, setShowCalendar] = useState(false);
  const [showSettings, setShowSettings] = useState<"zoom" | "google_meet" | null>(null);
  const [activeTab, setActiveTab] = useState("integrations");
  const [refreshing, setRefreshing] = useState(false);

  // Handle success/error from OAuth callback
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success === "zoom") {
      toast({
        title: "Zoom Connected",
        description: "Your Zoom account has been connected successfully.",
      });
    } else if (success === "google") {
      toast({
        title: "Google Meet Connected",
        description: "Your Google account has been connected successfully.",
      });
    } else if (error) {
      const errorMessages: Record<string, string> = {
        zoom_oauth_failed: "Failed to connect Zoom. Please try again.",
        zoom_state_mismatch: "Security validation failed. Please try again.",
        zoom_state_expired: "Connection request expired. Please try again.",
        zoom_callback_failed: "Failed to complete Zoom connection.",
        google_oauth_failed: "Failed to connect Google. Please try again.",
        google_state_mismatch: "Security validation failed. Please try again.",
        google_state_expired: "Connection request expired. Please try again.",
        google_callback_failed: "Failed to complete Google connection.",
      };

      toast({
        title: "Connection Failed",
        description: errorMessages[error] || "An error occurred. Please try again.",
        variant: "destructive",
      });
    }
  }, [searchParams, toast]);

  const loadIntegrations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/integrations?organizationId=${organizationSlug}`);
      const data = await response.json();

      if (data.success) {
        setIntegrations(data.data);
      }
    } catch (error) {
      console.error("Failed to load integrations:", error);
      toast({
        title: "Error",
        description: "Failed to load integrations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [organizationSlug, toast]);

  const loadImportedMeetings = useCallback(async () => {
    try {
      const allImports: ImportedMeeting[] = [];

      for (const integration of integrations) {
        const response = await fetch(`/api/integrations/import?integrationId=${integration.id}`);
        const data = await response.json();
        if (data.success && data.data) {
          allImports.push(...data.data);
        }
      }

      setImportedMeetings(allImports);
    } catch (error) {
      console.error("Failed to load imported meetings:", error);
    }
  }, [integrations]);

  useEffect(() => {
    loadIntegrations();
  }, [loadIntegrations]);

  useEffect(() => {
    if (integrations.length > 0) {
      loadImportedMeetings();
    }
  }, [integrations, loadImportedMeetings]);

  const handleConnect = (provider: "zoom" | "google_meet") => {
    const endpoint =
      provider === "zoom"
        ? `/api/integrations/zoom/authorize?organizationId=${organizationSlug}`
        : `/api/integrations/google/authorize?organizationId=${organizationSlug}`;

    window.location.href = endpoint;
  };

  const handleDisconnect = async (integrationId: string) => {
    try {
      setDisconnecting(integrationId);
      const response = await fetch(`/api/integrations?id=${integrationId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({
          title: "Disconnected",
          description: "Integration has been disconnected.",
        });
        loadIntegrations();
      } else {
        throw new Error("Failed to disconnect");
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to disconnect integration",
        variant: "destructive",
      });
    } finally {
      setDisconnecting(null);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadIntegrations();
    await loadImportedMeetings();
    setRefreshing(false);
  };

  const getIntegration = (provider: string) => integrations.find((i) => i.provider === provider);

  const pendingImports = importedMeetings.filter(
    (m) => m.importStatus === "pending" || m.importStatus === "downloading" || m.importStatus === "processing",
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Integrations</h1>
            <p className="text-muted-foreground">Connect your meeting apps to import recordings</p>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {[1, 2].map((i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 bg-muted rounded-xl animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-24 bg-muted rounded animate-pulse" />
                    <div className="h-4 w-48 bg-muted rounded animate-pulse" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-20 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Integrations</h1>
          <p className="text-muted-foreground">Connect your meeting apps to import and manage recordings</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Import Progress Banner */}
      {pendingImports.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                  <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                </div>
                <div>
                  <p className="font-medium">Importing recordings...</p>
                  <p className="text-sm text-muted-foreground">
                    {pendingImports.length} recording{pendingImports.length !== 1 ? "s" : ""} in progress
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setActiveTab("activity")}>
                View Progress
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="integrations" className="gap-2">
            <Zap className="h-4 w-4" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2">
            <Calendar className="h-4 w-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2 relative">
            <Clock className="h-4 w-4" />
            Activity
            {pendingImports.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] text-white">
                {pendingImports.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="integrations" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {INTEGRATIONS_CONFIG.map((config) => {
              const integration = getIntegration(config.id);
              const isConnected = !!integration;
              const Icon = config.icon;
              const isExpired = integration?.expiresAt && new Date(integration.expiresAt) < new Date();

              return (
                <Card
                  key={config.id}
                  className={`overflow-hidden transition-all hover:shadow-md ${isConnected ? config.borderColor : ""}`}
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className={`h-14 w-14 rounded-xl flex items-center justify-center ${config.bgColor} transition-colors`}
                        >
                          <Icon className="h-8 w-8" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">{config.name}</CardTitle>
                            {isConnected && (
                              <Badge variant={isExpired ? "destructive" : "secondary"} className="text-xs font-normal">
                                {isExpired ? (
                                  <>
                                    <X className="h-3 w-3 mr-1" />
                                    Expired
                                  </>
                                ) : (
                                  <>
                                    <Check className="h-3 w-3 mr-1" />
                                    Connected
                                  </>
                                )}
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="mt-1">{config.description}</CardDescription>
                        </div>
                      </div>

                      {isConnected && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Settings2 className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setShowSettings(config.id)}>
                              <Settings2 className="h-4 w-4 mr-2" />
                              Settings
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onSelect={(e) => e.preventDefault()}
                                >
                                  <X className="h-4 w-4 mr-2" />
                                  Disconnect
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Disconnect {config.name}?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will disconnect your {config.name} account. You can reconnect at any time.
                                    Previously imported recordings will not be affected.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => integration && handleDisconnect(integration.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    disabled={disconnecting === integration?.id}
                                  >
                                    {disconnecting === integration?.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : null}
                                    Disconnect
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0 pb-4">
                    {isConnected ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Shield className="h-4 w-4" />
                            <span>{integration.metadata?.email || "Connected"}</span>
                          </div>
                          {integration.createdAt && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Clock className="h-4 w-4" />
                              <span>
                                Connected {formatDistanceToNow(new Date(integration.createdAt), { addSuffix: true })}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {config.features.map((feature) => (
                            <Badge key={feature} variant="outline" className="text-xs font-normal">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                          {config.features.map((feature) => (
                            <Badge
                              key={feature}
                              variant="outline"
                              className="text-xs font-normal text-muted-foreground"
                            >
                              {feature}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Connect your {config.name} account to import recordings and sync your calendar.
                        </p>
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="border-t bg-muted/30 py-3">
                    {isConnected ? (
                      <div className="flex w-full gap-2">
                        <Button variant="default" className="flex-1" onClick={() => setSelectedProvider(config.id)}>
                          <Video className="h-4 w-4 mr-2" />
                          Browse Recordings
                        </Button>
                        <Button variant="outline" onClick={() => setShowCalendar(true)}>
                          <Calendar className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button className="w-full" onClick={() => handleConnect(config.id)}>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Connect {config.name}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>

          {/* Quick Stats */}
          {integrations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Import Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold text-green-600">
                      {importedMeetings.filter((m) => m.importStatus === "completed").length}
                    </div>
                    <div className="text-sm text-muted-foreground">Completed</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold text-blue-600">{pendingImports.length}</div>
                    <div className="text-sm text-muted-foreground">In Progress</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold text-red-600">
                      {importedMeetings.filter((m) => m.importStatus === "failed").length}
                    </div>
                    <div className="text-sm text-muted-foreground">Failed</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold">{importedMeetings.length}</div>
                    <div className="text-sm text-muted-foreground">Total</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="calendar">
          <MeetingCalendar
            integrations={integrations}
            organizationSlug={organizationSlug}
            onImportRecording={(provider) => setSelectedProvider(provider)}
          />
        </TabsContent>

        <TabsContent value="activity">
          <ImportProgressTracker
            importedMeetings={importedMeetings}
            onRefresh={loadImportedMeetings}
            organizationSlug={organizationSlug}
          />
        </TabsContent>
      </Tabs>

      {/* Recording Browser Dialog */}
      {selectedProvider && (
        <RecordingBrowser
          provider={selectedProvider}
          open={!!selectedProvider}
          onClose={() => setSelectedProvider(null)}
          organizationSlug={organizationSlug}
        />
      )}

      {/* Integration Settings Dialog */}
      {showSettings && (
        <IntegrationSettings
          provider={showSettings}
          integration={getIntegration(showSettings) || null}
          open={!!showSettings}
          onClose={() => setShowSettings(null)}
          onUpdate={loadIntegrations}
        />
      )}
    </div>
  );
}
