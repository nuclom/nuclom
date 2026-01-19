'use client';

import { logger } from '@nuclom/lib/client-logger';
import { format } from 'date-fns';
import { Bell, Download, Info, RefreshCw, Shield } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

interface Integration {
  id: string;
  provider: 'zoom' | 'google_meet';
  connected: boolean;
  expiresAt: string | null;
  metadata: {
    email?: string;
    accountId?: string;
    autoImport?: boolean;
    notifyOnNewRecording?: boolean;
    importMinDuration?: number;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface IntegrationSettingsProps {
  provider: 'zoom' | 'google_meet';
  integration: Integration | null;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function IntegrationSettings({ provider, integration, open, onClose, onUpdate }: IntegrationSettingsProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    autoImport: integration?.metadata?.autoImport ?? false,
    notifyOnNewRecording: integration?.metadata?.notifyOnNewRecording ?? true,
    importMinDuration: integration?.metadata?.importMinDuration ?? 5,
  });

  const providerName = provider === 'zoom' ? 'Zoom' : 'Google Meet';

  const handleSave = async () => {
    if (!integration) return;

    try {
      setSaving(true);

      const response = await fetch(`/api/integrations/${integration.id}/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          autoImport: settings.autoImport,
          notifyOnNewRecording: settings.notifyOnNewRecording,
          importMinDuration: settings.importMinDuration,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      toast({
        title: 'Settings Saved',
        description: `${providerName} integration settings have been updated.`,
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

  if (!integration) {
    return null;
  }

  const isExpired = integration.expiresAt && new Date(integration.expiresAt) < new Date();

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{providerName} Settings</DialogTitle>
          <DialogDescription>Configure your {providerName} integration preferences</DialogDescription>
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
                <span className="text-muted-foreground">Account</span>
                <span className="font-medium">{integration.metadata?.email || 'Connected'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={isExpired ? 'destructive' : 'secondary'}>{isExpired ? 'Expired' : 'Active'}</Badge>
              </div>
              {integration.expiresAt && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Expires</span>
                  <span className="text-muted-foreground">
                    {format(new Date(integration.expiresAt), 'MMM d, yyyy h:mm a')}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Connected</span>
                <span className="text-muted-foreground">{format(new Date(integration.createdAt), 'MMM d, yyyy')}</span>
              </div>
            </div>

            {isExpired && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-sm text-red-600 dark:text-red-400 mb-2">
                  Your connection has expired. Please reconnect to continue using {providerName}.
                </p>
                <Button size="sm" variant="outline" className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reconnect
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* Auto-Import Settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Download className="h-4 w-4" />
              Import Settings
            </h4>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-import">Auto-import recordings</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically import new recordings when they become available
                </p>
              </div>
              <Switch
                id="auto-import"
                checked={settings.autoImport}
                onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, autoImport: checked }))}
              />
            </div>

            {settings.autoImport && (
              <div className="ml-4 pl-4 border-l space-y-4">
                <div>
                  <Label htmlFor="min-duration" className="text-sm">
                    Minimum recording duration
                  </Label>
                  <div className="flex items-center gap-2 mt-2">
                    <select
                      id="min-duration"
                      value={settings.importMinDuration}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, importMinDuration: Number.parseInt(e.target.value, 10) }))
                      }
                      className="flex h-9 w-full max-w-[150px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value={0}>No minimum</option>
                      <option value={5}>5 minutes</option>
                      <option value={10}>10 minutes</option>
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={60}>1 hour</option>
                    </select>
                    <span className="text-sm text-muted-foreground">or longer</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Only auto-import recordings that meet this minimum duration
                  </p>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Notification Settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </h4>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notify-new">Notify on new recordings</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when new recordings are available to import
                </p>
              </div>
              <Switch
                id="notify-new"
                checked={settings.notifyOnNewRecording}
                onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, notifyOnNewRecording: checked }))}
              />
            </div>
          </div>

          {/* Info Section */}
          <div className="rounded-lg bg-muted/50 p-4">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground">About {providerName} integration</p>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  {provider === 'zoom' ? (
                    <>
                      <li>Imports cloud recordings from your Zoom account</li>
                      <li>Syncs meeting metadata including participants</li>
                      <li>Requires Zoom Pro or higher for cloud recordings</li>
                    </>
                  ) : (
                    <>
                      <li>Imports recordings from Google Drive</li>
                      <li>Syncs calendar events with Meet links</li>
                      <li>Requires Google Workspace or Meet subscription</li>
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
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
