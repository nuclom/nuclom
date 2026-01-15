'use client';

import { formatDistanceToNow } from 'date-fns';
import {
  Calendar,
  Check,
  CheckCircle,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Settings2,
  Shield,
  Trash2,
  TrendingUp,
  Video,
  Webhook,
  X,
  Zap,
} from 'lucide-react';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { ImportProgressTracker } from '@/components/integrations/import-progress-tracker';
import { IntegrationSettings } from '@/components/integrations/integration-settings';
import { MeetingCalendar } from '@/components/integrations/meeting-calendar';
import { RecordingBrowser } from '@/components/integrations/recording-browser';
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
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

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

// Official Slack icon component
function SlackIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-labelledby="slack-icon-title"
    >
      <title id="slack-icon-title">Slack</title>
      <rect width="24" height="24" rx="4" fill="#4A154B" />
      <path
        d="M8.5 13.5C8.5 14.328 7.828 15 7 15C6.172 15 5.5 14.328 5.5 13.5C5.5 12.672 6.172 12 7 12H8.5V13.5Z"
        fill="#E01E5A"
      />
      <path
        d="M9.25 13.5C9.25 12.672 9.922 12 10.75 12C11.578 12 12.25 12.672 12.25 13.5V17C12.25 17.828 11.578 18.5 10.75 18.5C9.922 18.5 9.25 17.828 9.25 17V13.5Z"
        fill="#E01E5A"
      />
      <path
        d="M10.75 8.5C9.922 8.5 9.25 7.828 9.25 7C9.25 6.172 9.922 5.5 10.75 5.5C11.578 5.5 12.25 6.172 12.25 7V8.5H10.75Z"
        fill="#36C5F0"
      />
      <path
        d="M10.75 9.25C11.578 9.25 12.25 9.922 12.25 10.75C12.25 11.578 11.578 12.25 10.75 12.25H7C6.172 12.25 5.5 11.578 5.5 10.75C5.5 9.922 6.172 9.25 7 9.25H10.75Z"
        fill="#36C5F0"
      />
      <path
        d="M15.5 10.75C15.5 9.922 16.172 9.25 17 9.25C17.828 9.25 18.5 9.922 18.5 10.75C18.5 11.578 17.828 12.25 17 12.25H15.5V10.75Z"
        fill="#2EB67D"
      />
      <path
        d="M14.75 10.75C14.75 11.578 14.078 12.25 13.25 12.25C12.422 12.25 11.75 11.578 11.75 10.75V7C11.75 6.172 12.422 5.5 13.25 5.5C14.078 5.5 14.75 6.172 14.75 7V10.75Z"
        fill="#2EB67D"
      />
      <path
        d="M13.25 15.5C14.078 15.5 14.75 16.172 14.75 17C14.75 17.828 14.078 18.5 13.25 18.5C12.422 18.5 11.75 17.828 11.75 17V15.5H13.25Z"
        fill="#ECB22E"
      />
      <path
        d="M13.25 14.75C12.422 14.75 11.75 14.078 11.75 13.25C11.75 12.422 12.422 11.75 13.25 11.75H17C17.828 11.75 18.5 12.422 18.5 13.25C18.5 14.078 17.828 14.75 17 14.75H13.25Z"
        fill="#ECB22E"
      />
    </svg>
  );
}

// Official Microsoft Teams icon component
function TeamsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-labelledby="teams-icon-title"
    >
      <title id="teams-icon-title">Microsoft Teams</title>
      <rect width="24" height="24" rx="4" fill="#6264A7" />
      <circle cx="15.5" cy="8.5" r="2.5" fill="white" />
      <path
        d="M11 11.5C11 10.672 11.672 10 12.5 10H18.5C19.328 10 20 10.672 20 11.5V15.5C20 16.328 19.328 17 18.5 17H12.5C11.672 17 11 16.328 11 15.5V11.5Z"
        fill="white"
      />
      <path
        d="M4 8.5C4 7.672 4.672 7 5.5 7H9.5C10.328 7 11 7.672 11 8.5V16.5C11 17.328 10.328 18 9.5 18H5.5C4.672 18 4 17.328 4 16.5V8.5Z"
        fill="white"
        fillOpacity="0.8"
      />
      <rect x="6" y="10" width="3" height="1" rx="0.5" fill="#6264A7" />
      <rect x="6" y="12" width="3" height="1" rx="0.5" fill="#6264A7" />
      <rect x="6" y="14" width="3" height="1" rx="0.5" fill="#6264A7" />
    </svg>
  );
}

// Official Zapier icon component
function ZapierIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-labelledby="zapier-icon-title"
    >
      <title id="zapier-icon-title">Zapier</title>
      <rect width="24" height="24" rx="4" fill="#FF4A00" />
      <path
        d="M12 5L13.5 8.5H17.5L14.5 11L16 14.5L12 12L8 14.5L9.5 11L6.5 8.5H10.5L12 5Z"
        fill="white"
        stroke="white"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2" fill="white" />
      <line x1="12" y1="5" x2="12" y2="10" stroke="white" strokeWidth="1.5" />
      <line x1="12" y1="14" x2="12" y2="19" stroke="white" strokeWidth="1.5" />
      <line x1="5" y1="12" x2="10" y2="12" stroke="white" strokeWidth="1.5" />
      <line x1="14" y1="12" x2="19" y2="12" stroke="white" strokeWidth="1.5" />
    </svg>
  );
}

interface Integration {
  id: string;
  provider: 'zoom' | 'google_meet' | 'slack' | 'teams' | 'zapier';
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
  importStatus: 'pending' | 'downloading' | 'processing' | 'completed' | 'failed';
  importError: string | null;
  importedAt: string | null;
  videoId: string | null;
}

const INTEGRATIONS_CONFIG = [
  {
    id: 'zoom' as const,
    name: 'Zoom',
    description: 'Import meeting recordings and access calendar events',
    icon: ZoomIcon,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-950/50',
    borderColor: 'border-blue-200 dark:border-blue-800',
    features: ['Cloud recordings', 'Meeting transcripts', 'Calendar sync', 'Auto-import'],
  },
  {
    id: 'google_meet' as const,
    name: 'Google Meet',
    description: 'Import recordings from Google Drive and calendar',
    icon: GoogleMeetIcon,
    color: 'text-green-500',
    bgColor: 'bg-green-50 dark:bg-green-950/50',
    borderColor: 'border-green-200 dark:border-green-800',
    features: ['Drive recordings', 'Calendar events', 'Meeting notes', 'Auto-import'],
  },
  {
    id: 'slack' as const,
    name: 'Slack',
    description: 'Share videos to channels and receive notifications',
    icon: SlackIcon,
    color: 'text-purple-500',
    bgColor: 'bg-purple-50 dark:bg-purple-950/50',
    borderColor: 'border-purple-200 dark:border-purple-800',
    features: ['Channel notifications', 'Video sharing', 'Workflow triggers'],
  },
  {
    id: 'teams' as const,
    name: 'Microsoft Teams',
    description: 'Post video updates and sync with your team',
    icon: TeamsIcon,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-50 dark:bg-indigo-950/50',
    borderColor: 'border-indigo-200 dark:border-indigo-800',
    features: ['Channel notifications', 'Adaptive cards', 'Team sync'],
  },
  {
    id: 'zapier' as const,
    name: 'Zapier',
    description: 'Automate workflows with custom webhook triggers',
    icon: ZapierIcon,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50 dark:bg-orange-950/50',
    borderColor: 'border-orange-200 dark:border-orange-800',
    features: ['Webhook triggers', 'Event subscriptions', 'Custom automations'],
  },
] as const;

function IntegrationsPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const organizationSlug = params.organization as string;

  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [importedMeetings, setImportedMeetings] = useState<ImportedMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  // Types for recording-only providers (Zoom/Google Meet)
  type RecordingProvider = 'zoom' | 'google_meet';
  const [selectedProvider, setSelectedProvider] = useState<RecordingProvider | null>(null);
  const [_showCalendar, setShowCalendar] = useState(false);
  const [showSettings, setShowSettings] = useState<RecordingProvider | null>(null);
  const [activeTab, setActiveTab] = useState('integrations');
  const [refreshing, setRefreshing] = useState(false);
  const [showZapierDialog, setShowZapierDialog] = useState(false);

  // Handle success/error from OAuth callback
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success === 'zoom') {
      toast({
        title: 'Zoom Connected',
        description: 'Your Zoom account has been connected successfully.',
      });
    } else if (success === 'google') {
      toast({
        title: 'Google Meet Connected',
        description: 'Your Google account has been connected successfully.',
      });
    } else if (success === 'slack') {
      toast({
        title: 'Slack Connected',
        description: 'Your Slack workspace has been connected successfully.',
      });
    } else if (success === 'teams') {
      toast({
        title: 'Microsoft Teams Connected',
        description: 'Your Teams account has been connected successfully.',
      });
    } else if (error) {
      const errorMessages: Record<string, string> = {
        zoom_oauth_failed: 'Failed to connect Zoom. Please try again.',
        zoom_state_mismatch: 'Security validation failed. Please try again.',
        zoom_state_expired: 'Connection request expired. Please try again.',
        zoom_callback_failed: 'Failed to complete Zoom connection.',
        google_oauth_failed: 'Failed to connect Google. Please try again.',
        google_state_mismatch: 'Security validation failed. Please try again.',
        google_state_expired: 'Connection request expired. Please try again.',
        google_callback_failed: 'Failed to complete Google connection.',
        slack_oauth_failed: 'Failed to connect Slack. Please try again.',
        slack_state_mismatch: 'Security validation failed. Please try again.',
        slack_state_expired: 'Connection request expired. Please try again.',
        slack_callback_failed: 'Failed to complete Slack connection.',
        teams_oauth_failed: 'Failed to connect Teams. Please try again.',
        teams_state_mismatch: 'Security validation failed. Please try again.',
        teams_state_expired: 'Connection request expired. Please try again.',
        teams_callback_failed: 'Failed to complete Teams connection.',
      };

      toast({
        title: 'Connection Failed',
        description: errorMessages[error] || 'An error occurred. Please try again.',
        variant: 'destructive',
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
      console.error('Failed to load integrations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load integrations',
        variant: 'destructive',
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
      console.error('Failed to load imported meetings:', error);
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

  const handleConnect = (provider: 'zoom' | 'google_meet' | 'slack' | 'teams' | 'zapier') => {
    if (provider === 'zapier') {
      setShowZapierDialog(true);
      return;
    }

    const endpoints: Record<string, string> = {
      zoom: `/api/integrations/zoom/authorize?organizationId=${organizationSlug}`,
      google_meet: `/api/integrations/google/authorize?organizationId=${organizationSlug}`,
      slack: `/api/integrations/slack/authorize?organizationId=${organizationSlug}`,
      teams: `/api/integrations/teams/authorize?organizationId=${organizationSlug}`,
    };

    window.location.href = endpoints[provider];
  };

  const handleDisconnect = async (integrationId: string) => {
    try {
      setDisconnecting(integrationId);
      const response = await fetch(`/api/integrations?id=${integrationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: 'Disconnected',
          description: 'Integration has been disconnected.',
        });
        loadIntegrations();
      } else {
        throw new Error('Failed to disconnect');
      }
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to disconnect integration',
        variant: 'destructive',
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
    (m) => m.importStatus === 'pending' || m.importStatus === 'downloading' || m.importStatus === 'processing',
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
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
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
                    {pendingImports.length} recording{pendingImports.length !== 1 ? 's' : ''} in progress
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setActiveTab('activity')}>
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
                  className={`overflow-hidden transition-all hover:shadow-md ${isConnected ? config.borderColor : ''}`}
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
                              <Badge variant={isExpired ? 'destructive' : 'secondary'} className="text-xs font-normal">
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
                            {(config.id === 'zoom' || config.id === 'google_meet') && (
                              <>
                                <DropdownMenuItem onClick={() => setShowSettings(config.id as RecordingProvider)}>
                                  <Settings2 className="h-4 w-4 mr-2" />
                                  Settings
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
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
                            <span>{integration.metadata?.email || 'Connected'}</span>
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
                      config.id === 'zapier' ? (
                        <Button variant="default" className="w-full" onClick={() => setShowZapierDialog(true)}>
                          <Webhook className="h-4 w-4 mr-2" />
                          Configure Webhooks
                        </Button>
                      ) : config.id === 'slack' || config.id === 'teams' ? (
                        <div className="flex w-full items-center justify-center gap-2 text-sm text-muted-foreground">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span>Integration active</span>
                        </div>
                      ) : (
                        <div className="flex w-full gap-2">
                          <Button
                            variant="default"
                            className="flex-1"
                            onClick={() => setSelectedProvider(config.id as RecordingProvider)}
                          >
                            <Video className="h-4 w-4 mr-2" />
                            Browse Recordings
                          </Button>
                          <Button variant="outline" onClick={() => setShowCalendar(true)}>
                            <Calendar className="h-4 w-4" />
                          </Button>
                        </div>
                      )
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
                      {importedMeetings.filter((m) => m.importStatus === 'completed').length}
                    </div>
                    <div className="text-sm text-muted-foreground">Completed</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold text-blue-600">{pendingImports.length}</div>
                    <div className="text-sm text-muted-foreground">In Progress</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold text-red-600">
                      {importedMeetings.filter((m) => m.importStatus === 'failed').length}
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
            integrations={integrations.filter(
              (i): i is Integration & { provider: RecordingProvider } =>
                i.provider === 'zoom' || i.provider === 'google_meet',
            )}
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
          integration={
            (getIntegration(showSettings) as
              | (Omit<Integration, 'provider'> & { provider: RecordingProvider })
              | undefined) ?? null
          }
          open={!!showSettings}
          onClose={() => setShowSettings(null)}
          onUpdate={loadIntegrations}
        />
      )}

      {/* Zapier Webhooks Dialog */}
      <ZapierWebhooksDialog
        open={showZapierDialog}
        onClose={() => setShowZapierDialog(false)}
        organizationSlug={organizationSlug}
      />
    </div>
  );
}

// Zapier Webhooks Dialog Component
interface ZapierWebhook {
  id: string;
  targetUrl: string;
  events: string[];
  isActive: boolean;
  lastTriggeredAt: string | null;
  failureCount: number;
  createdAt: string;
}

interface ZapierWebhooksDialogProps {
  open: boolean;
  onClose: () => void;
  organizationSlug: string;
}

function ZapierWebhooksDialog({ open, onClose, organizationSlug: _organizationSlug }: ZapierWebhooksDialogProps) {
  const { toast } = useToast();
  const [webhooks, setWebhooks] = useState<ZapierWebhook[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Create form state
  const [targetUrl, setTargetUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  const availableEvents = [
    { value: 'video.uploaded', label: 'Video Uploaded' },
    { value: 'video.processed', label: 'Video Processed' },
    { value: 'video.shared', label: 'Video Shared' },
    { value: 'comment.created', label: 'Comment Created' },
    { value: 'comment.replied', label: 'Comment Replied' },
    { value: 'member.joined', label: 'Member Joined' },
    { value: 'member.left', label: 'Member Left' },
  ];

  const loadWebhooks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/webhooks/zapier');
      const data = await response.json();

      if (data.webhooks) {
        setWebhooks(data.webhooks);
      }
    } catch (error) {
      console.error('Failed to load webhooks:', error);
      toast({
        title: 'Error',
        description: 'Failed to load webhooks',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open) {
      loadWebhooks();
    }
  }, [open, loadWebhooks]);

  const handleCreate = async () => {
    if (!targetUrl || selectedEvents.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a target URL and select at least one event',
        variant: 'destructive',
      });
      return;
    }

    try {
      setCreating(true);
      const response = await fetch('/api/webhooks/zapier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl,
          events: selectedEvents,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create webhook');
      }

      toast({
        title: 'Webhook Created',
        description: 'Your webhook has been created successfully',
      });

      setTargetUrl('');
      setSelectedEvents([]);
      setShowCreateForm(false);
      loadWebhooks();
    } catch (error) {
      console.error('Failed to create webhook:', error);
      toast({
        title: 'Error',
        description: 'Failed to create webhook',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (webhookId: string) => {
    try {
      setDeletingId(webhookId);
      const response = await fetch(`/api/webhooks/zapier/${webhookId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete webhook');
      }

      toast({
        title: 'Webhook Deleted',
        description: 'The webhook has been deleted successfully',
      });

      loadWebhooks();
    } catch (error) {
      console.error('Failed to delete webhook:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete webhook',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: 'Copied',
      description: 'Webhook URL copied to clipboard',
    });
  };

  const handleToggleEvent = (event: string) => {
    setSelectedEvents((prev) => (prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]));
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Zapier Webhooks</DialogTitle>
          <DialogDescription>
            Configure webhooks to trigger Zapier automations when events occur in your workspace
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Create New Webhook Form */}
          {showCreateForm ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Create New Webhook</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="targetUrl">Target URL</Label>
                  <Input
                    id="targetUrl"
                    placeholder="https://hooks.zapier.com/hooks/catch/..."
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Enter the webhook URL from your Zapier Zap</p>
                </div>

                <div className="space-y-2">
                  <Label>Event Subscriptions</Label>
                  <div className="space-y-2 border rounded-lg p-4">
                    {availableEvents.map((event) => (
                      <div key={event.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={event.value}
                          checked={selectedEvents.includes(event.value)}
                          onCheckedChange={() => handleToggleEvent(event.value)}
                        />
                        <label
                          htmlFor={event.value}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {event.label}
                        </label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Select which events will trigger this webhook</p>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Webhook
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <Button onClick={() => setShowCreateForm(true)} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Create New Webhook
            </Button>
          )}

          {/* Existing Webhooks List */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : webhooks.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center text-muted-foreground">
                  <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No webhooks configured yet</p>
                  <p className="text-sm mt-2">Create your first webhook to get started</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {webhooks.map((webhook) => (
                <Card key={webhook.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <CardTitle className="text-base truncate">{webhook.targetUrl}</CardTitle>
                          <Badge variant={webhook.isActive ? 'secondary' : 'outline'}>
                            {webhook.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {webhook.events.map((event) => (
                            <Badge key={event} variant="outline" className="text-xs">
                              {availableEvents.find((e) => e.value === event)?.label || event}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-1 ml-2">
                        <Button variant="ghost" size="icon" onClick={() => handleCopyUrl(webhook.targetUrl)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Webhook?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete this webhook. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(webhook.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                disabled={deletingId === webhook.id}
                              >
                                {deletingId === webhook.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground mb-1">Created</div>
                        <div>{formatDistanceToNow(new Date(webhook.createdAt), { addSuffix: true })}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-1">Last Triggered</div>
                        <div>
                          {webhook.lastTriggeredAt
                            ? formatDistanceToNow(new Date(webhook.lastTriggeredAt), { addSuffix: true })
                            : 'Never'}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-1">
                          <TrendingUp className="h-3 w-3 inline mr-1" />
                          Failures
                        </div>
                        <div className={webhook.failureCount > 0 ? 'text-destructive font-medium' : ''}>
                          {webhook.failureCount}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IntegrationsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-32 bg-muted rounded animate-pulse" />
          <div className="h-4 w-64 bg-muted rounded animate-pulse mt-2" />
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

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<IntegrationsSkeleton />}>
      <IntegrationsPageContent />
    </Suspense>
  );
}
