'use client';

import { logger } from '@nuclom/lib/client-logger';
import { Badge } from '@nuclom/ui/badge';
import { Button } from '@nuclom/ui/button';
import { Checkbox } from '@nuclom/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@nuclom/ui/dialog';
import { Label } from '@nuclom/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@nuclom/ui/select';
import { Separator } from '@nuclom/ui/separator';
import { Switch } from '@nuclom/ui/switch';
import { format } from 'date-fns';
import { Bell, Check, Hash, Info, Loader2, RefreshCw, Shield, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface Integration {
  id: string;
  provider: 'slack' | 'teams';
  connected: boolean;
  expiresAt: string | null;
  metadata: {
    email?: string;
    teamName?: string;
    teamId?: string;
    defaultChannelId?: string;
    defaultChannelName?: string;
    notifyOnVideoUpload?: boolean;
    notifyOnVideoShared?: boolean;
    notifyOnComment?: boolean;
    notifyOnMention?: boolean;
    notificationMuted?: boolean;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface Channel {
  id: string;
  name: string;
  isPrivate: boolean;
}

interface NotificationSettingsProps {
  provider: 'slack' | 'teams';
  integration: Integration | null;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
  organizationSlug: string;
}

type NotificationEventId = 'notifyOnVideoUpload' | 'notifyOnVideoShared' | 'notifyOnComment' | 'notifyOnMention';

const EVENT_OPTIONS: ReadonlyArray<{
  id: NotificationEventId;
  label: string;
  description: string;
}> = [
  {
    id: 'notifyOnVideoUpload',
    label: 'Video uploaded',
    description: 'When a new video is uploaded to the workspace',
  },
  {
    id: 'notifyOnVideoShared',
    label: 'Video shared',
    description: 'When a video is shared with team members',
  },
  {
    id: 'notifyOnComment',
    label: 'New comment',
    description: 'When someone comments on a video',
  },
  {
    id: 'notifyOnMention',
    label: 'Mentions',
    description: 'When you are mentioned in a comment',
  },
];

export function NotificationSettings({
  provider,
  integration,
  open,
  onClose,
  onUpdate,
  organizationSlug,
}: NotificationSettingsProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [settings, setSettings] = useState({
    defaultChannelId: integration?.metadata?.defaultChannelId ?? '',
    notifyOnVideoUpload: integration?.metadata?.notifyOnVideoUpload ?? true,
    notifyOnVideoShared: integration?.metadata?.notifyOnVideoShared ?? true,
    notifyOnComment: integration?.metadata?.notifyOnComment ?? true,
    notifyOnMention: integration?.metadata?.notifyOnMention ?? true,
    notificationMuted: integration?.metadata?.notificationMuted ?? false,
  });

  const providerName = provider === 'slack' ? 'Slack' : 'Microsoft Teams';
  const channelTerm = provider === 'slack' ? 'channel' : 'channel';

  const loadChannels = useCallback(async () => {
    if (!integration) return;

    try {
      setLoadingChannels(true);
      const endpoint =
        provider === 'slack'
          ? `/api/integrations/slack/channels?organizationId=${organizationSlug}`
          : `/api/integrations/teams/channels?organizationId=${organizationSlug}`;

      const response = await fetch(endpoint);
      const data = await response.json();

      if (data.success && data.channels) {
        setChannels(data.channels);
      }
    } catch (error) {
      logger.error('Failed to load channels', error);
      toast({
        title: 'Error',
        description: `Failed to load ${providerName} channels`,
        variant: 'destructive',
      });
    } finally {
      setLoadingChannels(false);
    }
  }, [integration, provider, organizationSlug, providerName, toast]);

  useEffect(() => {
    if (open && integration) {
      loadChannels();
      // Reset settings when dialog opens
      setSettings({
        defaultChannelId: integration.metadata?.defaultChannelId ?? '',
        notifyOnVideoUpload: integration.metadata?.notifyOnVideoUpload ?? true,
        notifyOnVideoShared: integration.metadata?.notifyOnVideoShared ?? true,
        notifyOnComment: integration.metadata?.notifyOnComment ?? true,
        notifyOnMention: integration.metadata?.notifyOnMention ?? true,
        notificationMuted: integration.metadata?.notificationMuted ?? false,
      });
    }
  }, [open, integration, loadChannels]);

  const handleSave = async () => {
    if (!integration) return;

    try {
      setSaving(true);

      const response = await fetch(`/api/integrations/${integration.id}/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      toast({
        title: 'Settings Saved',
        description: `${providerName} notification settings have been updated.`,
      });

      onUpdate();
      onClose();
    } catch (error) {
      logger.error('Failed to save settings', error);
      toast({
        title: 'Error',
        description: 'Failed to save integration settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEventToggle = (eventId: NotificationEventId, checked: boolean) => {
    setSettings((prev) => ({
      ...prev,
      [eventId]: checked,
    }));
  };

  const selectedChannel = channels.find((c) => c.id === settings.defaultChannelId);
  const enabledEventsCount = [
    settings.notifyOnVideoUpload,
    settings.notifyOnVideoShared,
    settings.notifyOnComment,
    settings.notifyOnMention,
  ].filter(Boolean).length;

  if (!integration) {
    return null;
  }

  const isExpired = integration.expiresAt && new Date(integration.expiresAt) < new Date();

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>{providerName} Settings</DialogTitle>
          <DialogDescription>
            Configure notifications and default {channelTerm} for {providerName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Connection Status */}
          <div className="rounded-lg border p-4">
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Connection Status
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{provider === 'slack' ? 'Workspace' : 'Team'}</span>
                <span className="font-medium">{integration.metadata?.teamName || 'Connected'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={isExpired ? 'destructive' : 'secondary'}>{isExpired ? 'Expired' : 'Active'}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Connected</span>
                <span className="text-muted-foreground">{format(new Date(integration.createdAt), 'MMM d, yyyy')}</span>
              </div>
            </div>

            {isExpired && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-sm text-red-600 dark:text-red-400 mb-2">
                  Your connection has expired. Please reconnect to continue receiving notifications.
                </p>
                <Button size="sm" variant="outline" className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reconnect
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* Mute All Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              {settings.notificationMuted ? (
                <VolumeX className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Volume2 className="h-5 w-5 text-primary" />
              )}
              <div className="space-y-0.5">
                <Label htmlFor="mute-all" className="font-medium">
                  {settings.notificationMuted ? 'Notifications muted' : 'Notifications enabled'}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {settings.notificationMuted
                    ? 'No notifications will be sent'
                    : `${enabledEventsCount} event type${enabledEventsCount !== 1 ? 's' : ''} enabled`}
                </p>
              </div>
            </div>
            <Switch
              id="mute-all"
              checked={!settings.notificationMuted}
              onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, notificationMuted: !checked }))}
            />
          </div>

          {/* Default Channel Selection */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Default {channelTerm}
            </h4>
            <div className="space-y-2">
              <Select
                value={settings.defaultChannelId}
                onValueChange={(value) => setSettings((prev) => ({ ...prev, defaultChannelId: value }))}
                disabled={loadingChannels}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingChannels ? 'Loading channels...' : `Select a ${channelTerm}`}>
                    {loadingChannels ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading...
                      </span>
                    ) : selectedChannel ? (
                      <span className="flex items-center gap-2">
                        <Hash className="h-4 w-4" />
                        {selectedChannel.name}
                        {selectedChannel.isPrivate && (
                          <Badge variant="outline" className="text-xs ml-1">
                            Private
                          </Badge>
                        )}
                      </span>
                    ) : (
                      `Select a ${channelTerm}`
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No default {channelTerm}</SelectItem>
                  {channels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      <span className="flex items-center gap-2">
                        <Hash className="h-4 w-4" />
                        {channel.name}
                        {channel.isPrivate && (
                          <Badge variant="outline" className="text-xs">
                            Private
                          </Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Notifications will be posted to this {channelTerm} by default
              </p>
            </div>
          </div>

          <Separator />

          {/* Event Subscriptions */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notification Events
            </h4>
            <div className="space-y-3 rounded-lg border p-4">
              {EVENT_OPTIONS.map((event) => (
                <div
                  key={event.id}
                  className={`flex items-start gap-3 ${settings.notificationMuted ? 'opacity-50' : ''}`}
                >
                  <Checkbox
                    id={event.id}
                    checked={settings[event.id]}
                    onCheckedChange={(checked) => {
                      if (typeof checked === 'boolean') handleEventToggle(event.id, checked);
                    }}
                    disabled={settings.notificationMuted}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <label
                      htmlFor={event.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {event.label}
                    </label>
                    <p className="text-xs text-muted-foreground">{event.description}</p>
                  </div>
                  {settings[event.id] && !settings.notificationMuted && (
                    <Check className="h-4 w-4 text-emerald-500 ml-auto shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Info Section */}
          <div className="rounded-lg bg-muted/50 p-4">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground">About {providerName} notifications</p>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  {provider === 'slack' ? (
                    <>
                      <li>Notifications are sent as rich messages with video previews</li>
                      <li>Team members can react and comment directly from Slack</li>
                      <li>Use /nuclom commands to search and share videos</li>
                    </>
                  ) : (
                    <>
                      <li>Notifications appear as adaptive cards in Teams</li>
                      <li>Team members can view videos directly in Teams</li>
                      <li>Supports @mentions to notify specific team members</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
