'use client';

import { Bell, Loader2, Mail, MessageSquare, Video } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { RequireAuth } from '@/components/auth/auth-guard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

type NotificationPreferences = {
  emailNotifications: boolean;
  emailCommentReplies: boolean;
  emailMentions: boolean;
  emailVideoProcessing: boolean;
  emailWeeklyDigest: boolean;
  emailProductUpdates: boolean;
  pushNotifications: boolean;
};

const defaultPreferences: NotificationPreferences = {
  emailNotifications: true,
  emailCommentReplies: true,
  emailMentions: true,
  emailVideoProcessing: true,
  emailWeeklyDigest: false,
  emailProductUpdates: true,
  pushNotifications: true,
};

function NotificationsContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalPreferences, setOriginalPreferences] = useState<NotificationPreferences>(defaultPreferences);

  const loadPreferences = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const response = await fetch('/api/user/preferences');
      if (response.ok) {
        const data = await response.json();
        const prefs = {
          emailNotifications: data.emailNotifications ?? true,
          emailCommentReplies: data.emailCommentReplies ?? true,
          emailMentions: data.emailMentions ?? true,
          emailVideoProcessing: data.emailVideoProcessing ?? true,
          emailWeeklyDigest: data.emailWeeklyDigest ?? false,
          emailProductUpdates: data.emailProductUpdates ?? true,
          pushNotifications: data.pushNotifications ?? true,
        };
        setPreferences(prefs);
        setOriginalPreferences(prefs);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
      toast({
        title: 'Error',
        description: 'Failed to load notification preferences',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  useEffect(() => {
    const changed = Object.keys(preferences).some(
      (key) =>
        preferences[key as keyof NotificationPreferences] !== originalPreferences[key as keyof NotificationPreferences],
    );
    setHasChanges(changed);
  }, [preferences, originalPreferences]);

  const handleToggle = (key: keyof NotificationPreferences) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });

      if (!response.ok) {
        throw new Error('Failed to save preferences');
      }

      setOriginalPreferences(preferences);
      setHasChanges(false);
      toast({
        title: 'Preferences saved',
        description: 'Your notification preferences have been updated',
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast({
        title: 'Error',
        description: 'Failed to save notification preferences',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setPreferences(originalPreferences);
    setHasChanges(false);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>Loading notification preferences...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Email Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Notifications
          </CardTitle>
          <CardDescription>Configure which emails you receive from Nuclom</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Master Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Email notifications</Label>
              <p className="text-sm text-muted-foreground">Receive email notifications from Nuclom</p>
            </div>
            <Switch
              checked={preferences.emailNotifications}
              onCheckedChange={() => handleToggle('emailNotifications')}
            />
          </div>

          {preferences.emailNotifications && (
            <>
              <Separator />

              {/* Comment Notifications */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MessageSquare className="h-4 w-4" />
                  Comments & Mentions
                </div>

                <div className="ml-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Comment replies</Label>
                      <p className="text-sm text-muted-foreground">When someone replies to your comments</p>
                    </div>
                    <Switch
                      checked={preferences.emailCommentReplies}
                      onCheckedChange={() => handleToggle('emailCommentReplies')}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Mentions</Label>
                      <p className="text-sm text-muted-foreground">When someone mentions you in a comment</p>
                    </div>
                    <Switch checked={preferences.emailMentions} onCheckedChange={() => handleToggle('emailMentions')} />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Video Notifications */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Video className="h-4 w-4" />
                  Videos
                </div>

                <div className="ml-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Video processing</Label>
                      <p className="text-sm text-muted-foreground">When your videos finish processing or fail</p>
                    </div>
                    <Switch
                      checked={preferences.emailVideoProcessing}
                      onCheckedChange={() => handleToggle('emailVideoProcessing')}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Digest & Updates */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Bell className="h-4 w-4" />
                  Digests & Updates
                </div>

                <div className="ml-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Weekly digest</Label>
                      <p className="text-sm text-muted-foreground">Weekly summary of activity in your organizations</p>
                    </div>
                    <Switch
                      checked={preferences.emailWeeklyDigest}
                      onCheckedChange={() => handleToggle('emailWeeklyDigest')}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Product updates</Label>
                      <p className="text-sm text-muted-foreground">New features and improvements to Nuclom</p>
                    </div>
                    <Switch
                      checked={preferences.emailProductUpdates}
                      onCheckedChange={() => handleToggle('emailProductUpdates')}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
        {hasChanges && (
          <CardFooter className="bg-muted/50 border-t px-6 py-4 flex justify-end gap-2">
            <Button variant="outline" onClick={handleReset}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* Push Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            In-App Notifications
          </CardTitle>
          <CardDescription>Configure in-app notification preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Push notifications</Label>
              <p className="text-sm text-muted-foreground">Receive push notifications in your browser</p>
            </div>
            <Switch checked={preferences.pushNotifications} onCheckedChange={() => handleToggle('pushNotifications')} />
          </div>
        </CardContent>
        {hasChanges && (
          <CardFooter className="bg-muted/50 border-t px-6 py-4 flex justify-end gap-2">
            <Button variant="outline" onClick={handleReset}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

export default function NotificationsSettingsPage() {
  return (
    <RequireAuth>
      <NotificationsContent />
    </RequireAuth>
  );
}
