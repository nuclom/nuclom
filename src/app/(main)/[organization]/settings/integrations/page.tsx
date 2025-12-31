"use client";

import { Check, ExternalLink, Loader2, Video, X } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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
import { useToast } from "@/hooks/use-toast";

// Zoom icon component
function ZoomIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.5 14h-9c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5h9c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z" />
      <circle cx="12" cy="12" r="2" fill="white" />
    </svg>
  );
}

// Google Meet icon component
function GoogleMeetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
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
  } | null;
  createdAt: string;
  updatedAt: string;
}

const INTEGRATIONS_CONFIG = [
  {
    id: "zoom",
    name: "Zoom",
    description: "Import meeting recordings from Zoom",
    icon: ZoomIcon,
    color: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950",
  },
  {
    id: "google_meet",
    name: "Google Meet",
    description: "Import meeting recordings from Google Meet",
    icon: GoogleMeetIcon,
    color: "text-green-500",
    bgColor: "bg-green-50 dark:bg-green-950",
  },
] as const;

export default function IntegrationsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const organizationSlug = params.organization as string;

  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<"zoom" | "google_meet" | null>(null);

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

  useEffect(() => {
    loadIntegrations();
  }, [loadIntegrations]);

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

  const getIntegration = (provider: string) => integrations.find((i) => i.provider === provider);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Integrations</h1>
          <p className="text-muted-foreground">Connect your meeting apps to import recordings</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-muted rounded-lg animate-pulse" />
                  <div className="space-y-2">
                    <div className="h-5 w-24 bg-muted rounded animate-pulse" />
                    <div className="h-4 w-48 bg-muted rounded animate-pulse" />
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-muted-foreground">Connect your meeting apps to import recordings</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {INTEGRATIONS_CONFIG.map((config) => {
          const integration = getIntegration(config.id);
          const isConnected = !!integration;
          const Icon = config.icon;

          return (
            <Card key={config.id}>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${config.bgColor}`}>
                    <Icon className={`h-6 w-6 ${config.color}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{config.name}</CardTitle>
                      {isConnected && (
                        <Badge variant="secondary" className="text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          Connected
                        </Badge>
                      )}
                    </div>
                    <CardDescription>{config.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>

              {isConnected && integration.metadata?.email && (
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground">Connected as: {integration.metadata.email}</p>
                </CardContent>
              )}

              <CardFooter className="gap-2">
                {isConnected ? (
                  <>
                    <Button variant="outline" onClick={() => setSelectedProvider(config.id)}>
                      <Video className="h-4 w-4 mr-2" />
                      Browse Recordings
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={disconnecting === integration.id}
                        >
                          {disconnecting === integration.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Disconnect {config.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will disconnect your {config.name} account. You can reconnect at any time. Previously
                            imported recordings will not be affected.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDisconnect(integration.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Disconnect
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                ) : (
                  <Button onClick={() => handleConnect(config.id)}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Connect {config.name}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Recording Browser Dialog */}
      {selectedProvider && (
        <RecordingBrowser
          provider={selectedProvider}
          open={!!selectedProvider}
          onClose={() => setSelectedProvider(null)}
          organizationSlug={organizationSlug}
        />
      )}
    </div>
  );
}
