'use client';

import { ArrowRight, Check, ExternalLink, Video } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StepIntegrationsProps {
  onNext: () => void;
  onBack: () => void;
  organizationSlug?: string;
}

// Zoom icon component
function ZoomIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4.585 10.432C4.585 9.063 5.688 7.96 7.058 7.96h6.403c1.37 0 2.473 1.104 2.473 2.473v3.135c0 1.37-1.104 2.473-2.473 2.473H7.058c-1.37 0-2.473-1.104-2.473-2.473v-3.135z" />
      <path d="M16.584 10.432l3.2-2.24c.31-.216.631-.05.631.327v7.962c0 .377-.321.543-.631.327l-3.2-2.24v-4.136z" />
    </svg>
  );
}

// Google Meet icon component
function GoogleMeetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 10.5c-1.93 0-3.5 1.57-3.5 3.5s1.57 3.5 3.5 3.5 3.5-1.57 3.5-3.5-1.57-3.5-3.5-3.5z" />
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
    </svg>
  );
}

// Slack icon component
function SlackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
    </svg>
  );
}

const integrations = [
  {
    id: 'zoom',
    name: 'Zoom',
    description: 'Import recordings from Zoom meetings',
    icon: ZoomIcon,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    id: 'google_meet',
    name: 'Google Meet',
    description: 'Import recordings from Google Meet',
    icon: GoogleMeetIcon,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Get notified about new videos',
    icon: SlackIcon,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    comingSoon: true,
  },
];

export function StepIntegrations({ onNext, onBack, organizationSlug: _organizationSlug }: StepIntegrationsProps) {
  const [connectedIntegrations, setConnectedIntegrations] = useState<string[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);

  const handleConnect = async (integrationId: string) => {
    if (integrationId === 'slack') return; // Coming soon

    setConnecting(integrationId);

    // In a real app, this would redirect to OAuth flow
    // For now, we'll simulate the connection
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setConnectedIntegrations((prev) => [...prev, integrationId]);
    setConnecting(null);
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <div className="mx-auto w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-4">
          <Video className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-2xl font-bold">Connect your tools</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Import meeting recordings automatically. You can always set this up later in settings.
        </p>
      </div>

      <div className="space-y-3 max-w-lg mx-auto">
        {integrations.map((integration) => {
          const isConnected = connectedIntegrations.includes(integration.id);
          const isConnecting = connecting === integration.id;
          const Icon = integration.icon;

          return (
            <Card
              key={integration.id}
              className={cn('transition-all', isConnected && 'border-emerald-500/50 bg-emerald-500/5')}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', integration.bgColor)}>
                  <Icon className={cn('w-6 h-6', integration.color)} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{integration.name}</p>
                    {integration.comingSoon && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        Coming soon
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{integration.description}</p>
                </div>
                {isConnected ? (
                  <div className="flex items-center gap-2 text-emerald-500">
                    <Check className="w-4 h-4" />
                    <span className="text-sm font-medium">Connected</span>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isConnecting || integration.comingSoon}
                    onClick={() => handleConnect(integration.id)}
                  >
                    {isConnecting ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Connecting...
                      </span>
                    ) : (
                      <>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Connect
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-between pt-4">
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
