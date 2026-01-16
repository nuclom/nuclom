'use client';

import { ArrowRight, Bell, Check, ExternalLink, Sparkles, Video, Zap } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface StepIntegrationsProps {
  onNext: () => void;
  onBack: () => void;
  organizationSlug?: string;
}

// Official Zoom icon component
function ZoomIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-labelledby="zoom-onboarding-icon"
    >
      <title id="zoom-onboarding-icon">Zoom</title>
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
      aria-labelledby="google-meet-onboarding-icon"
    >
      <title id="google-meet-onboarding-icon">Google Meet</title>
      <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" fill="#00832D" />
      <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#0066DA" />
      <path d="M2 7V17L12 12V2L2 7Z" fill="#00AC47" />
      <path d="M12 12L2 17L12 22L22 17L12 12Z" fill="#E94235" />
      <path d="M12 12V22L22 17V7L12 12Z" fill="#00832D" />
      <path d="M22 7L12 12V22L22 17V7Z" fill="#2684FC" />
      <path d="M12 12L22 7L12 2V12Z" fill="#FFBA00" />
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
      aria-labelledby="slack-onboarding-icon"
    >
      <title id="slack-onboarding-icon">Slack</title>
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
      aria-labelledby="teams-onboarding-icon"
    >
      <title id="teams-onboarding-icon">Microsoft Teams</title>
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
      aria-labelledby="zapier-onboarding-icon"
    >
      <title id="zapier-onboarding-icon">Zapier</title>
      <rect width="24" height="24" rx="4" fill="#FF4A00" />
      <circle cx="12" cy="12" r="2" fill="white" />
      <line x1="12" y1="5" x2="12" y2="10" stroke="white" strokeWidth="1.5" />
      <line x1="12" y1="14" x2="12" y2="19" stroke="white" strokeWidth="1.5" />
      <line x1="5" y1="12" x2="10" y2="12" stroke="white" strokeWidth="1.5" />
      <line x1="14" y1="12" x2="19" y2="12" stroke="white" strokeWidth="1.5" />
      <line x1="7.05" y1="7.05" x2="10.59" y2="10.59" stroke="white" strokeWidth="1.5" />
      <line x1="13.41" y1="13.41" x2="16.95" y2="16.95" stroke="white" strokeWidth="1.5" />
      <line x1="7.05" y1="16.95" x2="10.59" y2="13.41" stroke="white" strokeWidth="1.5" />
      <line x1="13.41" y1="10.59" x2="16.95" y2="7.05" stroke="white" strokeWidth="1.5" />
    </svg>
  );
}

type IntegrationProvider = 'zoom' | 'google_meet' | 'slack' | 'teams' | 'zapier';

interface IntegrationConfig {
  id: IntegrationProvider;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  features: string[];
  category: 'recording' | 'notification' | 'automation';
  popular?: boolean;
}

const RECORDING_INTEGRATIONS: IntegrationConfig[] = [
  {
    id: 'zoom',
    name: 'Zoom',
    description: 'Import cloud recordings automatically',
    icon: ZoomIcon,
    features: ['Auto-import recordings', 'Sync transcripts', 'Calendar integration'],
    category: 'recording',
    popular: true,
  },
  {
    id: 'google_meet',
    name: 'Google Meet',
    description: 'Import recordings from Google Drive',
    icon: GoogleMeetIcon,
    features: ['Drive sync', 'Calendar events', 'Meeting notes'],
    category: 'recording',
    popular: true,
  },
];

const NOTIFICATION_INTEGRATIONS: IntegrationConfig[] = [
  {
    id: 'slack',
    name: 'Slack',
    description: 'Get notified when videos are shared',
    icon: SlackIcon,
    features: ['Channel notifications', 'Video sharing', 'Workflow triggers'],
    category: 'notification',
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    description: 'Post video updates to your team',
    icon: TeamsIcon,
    features: ['Channel posts', 'Adaptive cards', 'Team sync'],
    category: 'notification',
  },
];

const AUTOMATION_INTEGRATIONS: IntegrationConfig[] = [
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'Automate workflows with 5,000+ apps',
    icon: ZapierIcon,
    features: ['Custom triggers', 'Event webhooks', 'No-code automation'],
    category: 'automation',
  },
];

const PROVIDER_NAMES: Record<IntegrationProvider, string> = {
  zoom: 'Zoom',
  google_meet: 'Google Meet',
  slack: 'Slack',
  teams: 'Microsoft Teams',
  zapier: 'Zapier',
};

export function StepIntegrations({ onNext, onBack, organizationSlug }: StepIntegrationsProps) {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [connectedIntegrations, setConnectedIntegrations] = useState<IntegrationProvider[]>([]);
  const [connecting, setConnecting] = useState<IntegrationProvider | null>(null);
  const [activeTab, setActiveTab] = useState<'recording' | 'notification'>('recording');

  // Handle OAuth callback success/error
  useEffect(() => {
    const success = searchParams.get('integration_success');
    const error = searchParams.get('integration_error');
    const provider = searchParams.get('provider') as IntegrationProvider | null;

    if (success && provider) {
      setConnectedIntegrations((prev) => (prev.includes(provider) ? prev : [...prev, provider]));
      toast({
        title: `${PROVIDER_NAMES[provider]} Connected`,
        description: `Your ${PROVIDER_NAMES[provider]} account has been connected successfully.`,
      });
      // Clean URL params
      window.history.replaceState({}, '', window.location.pathname);
    } else if (error) {
      toast({
        title: 'Connection Failed',
        description: error || 'Failed to connect integration. Please try again.',
        variant: 'destructive',
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams, toast]);

  const handleConnect = (provider: IntegrationProvider) => {
    if (!organizationSlug) {
      toast({
        title: 'Error',
        description: 'Organization not found. Please go back and create a workspace first.',
        variant: 'destructive',
      });
      return;
    }

    setConnecting(provider);

    // Build the OAuth authorization URL with onboarding return path
    const returnPath = encodeURIComponent(`/onboarding?integration_success=true&provider=${provider}`);
    const endpoints: Record<IntegrationProvider, string> = {
      zoom: `/api/integrations/zoom/authorize?organizationId=${organizationSlug}&returnPath=${returnPath}`,
      google_meet: `/api/integrations/google/authorize?organizationId=${organizationSlug}&returnPath=${returnPath}`,
      slack: `/api/integrations/slack/authorize?organizationId=${organizationSlug}&returnPath=${returnPath}`,
      teams: `/api/integrations/teams/authorize?organizationId=${organizationSlug}&returnPath=${returnPath}`,
      zapier: `/api/integrations/zapier/authorize?organizationId=${organizationSlug}&returnPath=${returnPath}`,
    };

    // Redirect to OAuth flow
    window.location.href = endpoints[provider];
  };

  const renderIntegrationCard = (integration: IntegrationConfig) => {
    const isConnected = connectedIntegrations.includes(integration.id);
    const isConnecting = connecting === integration.id;
    const Icon = integration.icon;

    return (
      <Card
        key={integration.id}
        className={cn(
          'relative overflow-hidden transition-all hover:shadow-md',
          isConnected && 'ring-2 ring-emerald-500/50 bg-emerald-500/5',
        )}
      >
        {integration.popular && !isConnected && (
          <div className="absolute top-3 right-3">
            <Badge variant="secondary" className="text-xs gap-1">
              <Sparkles className="h-3 w-3" />
              Popular
            </Badge>
          </div>
        )}
        <CardHeader className="pb-3">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-muted/50 shrink-0">
              <Icon className="h-8 w-8" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{integration.name}</CardTitle>
                {isConnected && (
                  <Badge variant="outline" className="text-emerald-600 border-emerald-500/50 gap-1">
                    <Check className="h-3 w-3" />
                    Connected
                  </Badge>
                )}
              </div>
              <CardDescription className="mt-1">{integration.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {integration.features.map((feature) => (
              <Badge key={feature} variant="outline" className="text-xs font-normal text-muted-foreground">
                {feature}
              </Badge>
            ))}
          </div>
          {!isConnected && (
            <Button
              className="w-full"
              variant="outline"
              onClick={() => handleConnect(integration.id)}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Connecting...
                </span>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Connect
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-4">
          <Video className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-2xl font-bold">Connect your tools</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Import recordings and stay notified. You can always configure these later in settings.
        </p>
      </div>

      {/* Connected count */}
      {connectedIntegrations.length > 0 && (
        <div className="flex justify-center">
          <Badge variant="secondary" className="text-sm gap-2 py-1.5 px-3">
            <Check className="h-4 w-4 text-emerald-500" />
            {connectedIntegrations.length} integration{connectedIntegrations.length !== 1 ? 's' : ''} connected
          </Badge>
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'recording' | 'notification')}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
          <TabsTrigger value="recording" className="gap-2">
            <Video className="h-4 w-4" />
            Recording Import
          </TabsTrigger>
          <TabsTrigger value="notification" className="gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recording" className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            Automatically import meeting recordings from your video conferencing tools
          </p>
          <div className="grid gap-4 sm:grid-cols-2">{RECORDING_INTEGRATIONS.map(renderIntegrationCard)}</div>
        </TabsContent>

        <TabsContent value="notification" className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            Get notified when videos are shared and keep your team in the loop
          </p>
          <div className="grid gap-4 sm:grid-cols-2">{NOTIFICATION_INTEGRATIONS.map(renderIntegrationCard)}</div>

          {/* Automation section */}
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium">Automation</span>
            </div>
            <div className="grid gap-4">{AUTOMATION_INTEGRATIONS.map(renderIntegrationCard)}</div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-between pt-4 border-t">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>
          {connectedIntegrations.length > 0 ? 'Continue' : 'Skip for now'}
          <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
