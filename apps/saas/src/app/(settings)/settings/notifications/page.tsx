'use client';

import { cn } from '@nuclom/lib/utils';
import { useAuth } from '@nuclom/auth/client';
import { logger } from '@nuclom/lib/client-logger';
import { Bell, Check, ChevronDown, ChevronUp, Loader2, Mail, MessageSquare, Sparkles, ToggleLeft, ToggleRight, Video } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { RequireAuth } from '@/components/auth/auth-guard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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

// Notification group configuration
type NotificationGroup = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  keys: (keyof NotificationPreferences)[];
};

const notificationGroups: NotificationGroup[] = [
  {
    id: 'comments',
    label: 'Comments & Mentions',
    icon: MessageSquare,
    description: 'Replies to your comments and when you get mentioned',
    keys: ['emailCommentReplies', 'emailMentions'],
  },
  {
    id: 'videos',
    label: 'Videos',
    icon: Video,
    description: 'Video processing updates and status changes',
    keys: ['emailVideoProcessing'],
  },
  {
    id: 'digests',
    label: 'Digests & Updates',
    icon: Bell,
    description: 'Weekly summaries and product announcements',
    keys: ['emailWeeklyDigest', 'emailProductUpdates'],
  },
];

// Notification summary component
function NotificationSummary({
  preferences,
  loading,
}: {
  preferences: NotificationPreferences;
  loading: boolean;
}) {
  const emailEnabled = preferences.emailNotifications;
  const emailSubCount = emailEnabled
    ? [
        preferences.emailCommentReplies,
        preferences.emailMentions,
        preferences.emailVideoProcessing,
        preferences.emailWeeklyDigest,
        preferences.emailProductUpdates,
      ].filter(Boolean).length
    : 0;

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="py-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 overflow-hidden">
      <CardContent className="py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(
              'flex items-center justify-center w-12 h-12 rounded-full transition-colors',
              emailEnabled ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
            )}>
              <Bell className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Notification Status</h3>
              <p className="text-sm text-muted-foreground">
                {emailEnabled ? (
                  <>
                    <span className="text-primary font-medium">{emailSubCount} of 5</span> email notification types enabled
                  </>
                ) : (
                  'All email notifications are disabled'
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {preferences.pushNotifications && (
              <Badge variant="secondary" className="gap-1">
                <Bell className="h-3 w-3" />
                Push
              </Badge>
            )}
            {emailEnabled && (
              <Badge variant="secondary" className="gap-1">
                <Mail className="h-3 w-3" />
                Email
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Collapsible notification group component
function NotificationGroupCard({
  group,
  preferences,
  onToggle,
  expanded,
  onToggleExpand,
}: {
  group: NotificationGroup;
  preferences: NotificationPreferences;
  onToggle: (key: keyof NotificationPreferences) => void;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const enabledCount = group.keys.filter((key) => preferences[key]).length;
  const allEnabled = enabledCount === group.keys.length;
  const noneEnabled = enabledCount === 0;

  const handleToggleAll = () => {
    const targetState = !allEnabled;
    group.keys.forEach((key) => {
      if (preferences[key] !== targetState) {
        onToggle(key);
      }
    });
  };

  const labelMap: Record<keyof NotificationPreferences, { label: string; description: string }> = {
    emailNotifications: { label: 'Email notifications', description: 'Receive email notifications' },
    emailCommentReplies: { label: 'Comment replies', description: 'When someone replies to your comments' },
    emailMentions: { label: 'Mentions', description: 'When someone mentions you in a comment' },
    emailVideoProcessing: { label: 'Video processing', description: 'When your videos finish processing or fail' },
    emailWeeklyDigest: { label: 'Weekly digest', description: 'Weekly summary of activity in your organizations' },
    emailProductUpdates: { label: 'Product updates', description: 'New features and improvements to Nuclom' },
    pushNotifications: { label: 'Push notifications', description: 'Browser push notifications' },
  };

  return (
    <div className="border rounded-lg overflow-hidden transition-all duration-200 hover:border-primary/30">
      {/* Group Header */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex items-center justify-center w-8 h-8 rounded-md transition-colors',
            allEnabled ? 'bg-primary/10 text-primary' : noneEnabled ? 'bg-muted text-muted-foreground' : 'bg-amber-500/10 text-amber-600'
          )}>
            <group.icon className="h-4 w-4" />
          </div>
          <div className="text-left">
            <span className="font-medium">{group.label}</span>
            <span className="text-xs text-muted-foreground ml-2">
              {enabledCount} of {group.keys.length} enabled
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleAll();
                  }}
                  className={cn(
                    'h-7 px-2 gap-1 text-xs',
                    allEnabled ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  {allEnabled ? (
                    <>
                      <ToggleRight className="h-3.5 w-3.5" />
                      All on
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="h-3.5 w-3.5" />
                      Turn all on
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {allEnabled ? 'Turn off all notifications in this group' : 'Turn on all notifications in this group'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Group Content */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          expanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="px-4 py-3 space-y-3 bg-background">
          {group.keys.map((key) => (
            <div
              key={key}
              className={cn(
                'flex items-center justify-between p-3 rounded-lg transition-colors',
                preferences[key] ? 'bg-primary/5' : 'bg-muted/30'
              )}
            >
              <div className="space-y-0.5">
                <Label className="cursor-pointer">{labelMap[key].label}</Label>
                <p className="text-xs text-muted-foreground">{labelMap[key].description}</p>
              </div>
              <Switch
                checked={preferences[key]}
                onCheckedChange={() => onToggle(key)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NotificationsContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalPreferences, setOriginalPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    comments: true,
    videos: true,
    digests: true,
  });

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
      logger.error('Failed to load notification preferences', error);
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
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
      toast({
        title: 'Preferences saved',
        description: 'Your notification preferences have been updated',
      });
    } catch (error) {
      logger.error('Failed to save notification preferences', error);
      toast({
        title: 'Error',
        description: 'Failed to save notification preferences',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const handleReset = () => {
    setPreferences(originalPreferences);
    setHasChanges(false);
  };

  return (
    <div className="space-y-6">
      {/* Notification Summary */}
      <NotificationSummary preferences={preferences} loading={loading} />

      {/* Email Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Notifications
              </CardTitle>
              <CardDescription className="mt-1.5">Configure which emails you receive from Nuclom</CardDescription>
            </div>
            {/* Master Toggle */}
            <div className="flex items-center gap-3">
              <span className={cn(
                'text-sm transition-colors',
                preferences.emailNotifications ? 'text-primary font-medium' : 'text-muted-foreground'
              )}>
                {preferences.emailNotifications ? 'Enabled' : 'Disabled'}
              </span>
              <Switch
                checked={preferences.emailNotifications}
                onCheckedChange={() => handleToggle('emailNotifications')}
              />
            </div>
          </div>
        </CardHeader>

        {preferences.emailNotifications && (
          <CardContent className="space-y-3 pt-0">
            {notificationGroups.map((group) => (
              <NotificationGroupCard
                key={group.id}
                group={group}
                preferences={preferences}
                onToggle={handleToggle}
                expanded={expandedGroups[group.id] ?? true}
                onToggleExpand={() => toggleGroup(group.id)}
              />
            ))}
          </CardContent>
        )}

        {!preferences.emailNotifications && (
          <CardContent className="pt-0">
            <div className="rounded-lg border border-dashed p-6 text-center">
              <Mail className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                Email notifications are disabled. Enable the toggle above to configure your preferences.
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Push Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                In-App Notifications
              </CardTitle>
              <CardDescription className="mt-1.5">Configure in-app notification preferences</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <span className={cn(
                'text-sm transition-colors',
                preferences.pushNotifications ? 'text-primary font-medium' : 'text-muted-foreground'
              )}>
                {preferences.pushNotifications ? 'Enabled' : 'Disabled'}
              </span>
              <Switch
                checked={preferences.pushNotifications}
                onCheckedChange={() => handleToggle('pushNotifications')}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className={cn(
            'rounded-lg p-4 transition-colors',
            preferences.pushNotifications ? 'bg-primary/5 border border-primary/20' : 'bg-muted/30 border border-transparent'
          )}>
            <div className="flex items-start gap-3">
              <div className={cn(
                'flex items-center justify-center w-10 h-10 rounded-full transition-colors',
                preferences.pushNotifications ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
              )}>
                <Bell className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Browser Push Notifications</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {preferences.pushNotifications
                    ? 'You will receive real-time notifications in your browser when important events happen.'
                    : 'Enable to receive real-time notifications about comments, mentions, and video updates.'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Floating Save Bar */}
      <div
        className={cn(
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300',
          hasChanges || showSuccess ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'
        )}
      >
        <Card className="shadow-lg border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              {hasChanges && !showSuccess && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    </span>
                    <span className="text-sm font-medium">Unsaved changes</span>
                  </div>
                  <Separator orientation="vertical" className="h-6" />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleReset}>
                      Discard
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                          Saving
                        </>
                      ) : (
                        'Save Changes'
                      )}
                    </Button>
                  </div>
                </>
              )}
              {showSuccess && (
                <div className="flex items-center gap-2 text-primary">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <span className="font-medium">Preferences saved!</span>
                  <Sparkles className="h-4 w-4 text-amber-500" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
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
