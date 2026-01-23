'use client';

import { authClient, useAuth } from '@nuclom/auth/client';
import { logger } from '@nuclom/lib/client-logger';
import { cn } from '@nuclom/lib/utils';
import { Link } from '@vercel/microfrontends/next/client';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Database,
  Download,
  Link2,
  Loader2,
  Mail,
  MessageSquare,
  Shield,
  Sparkles,
  Trash2,
  User,
  Video,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RequireAuth } from '@/components/auth/auth-guard';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';

interface UserData {
  id: string;
  name: string;
  email: string;
  marketingConsent?: boolean;
  marketingConsentAt?: string | null;
  deletionRequestedAt?: string | null;
  deletionScheduledFor?: string | null;
}

// Profile completion step configuration
type CompletionStep = {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  isComplete: boolean;
  priority: 'high' | 'medium' | 'low';
};

function ProfileCompletionCard() {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(true);
  const [linkedAccounts, setLinkedAccounts] = useState<{ provider: string }[]>([]);
  const [notificationPrefs, setNotificationPrefs] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch linked accounts and notification preferences
  useEffect(() => {
    async function fetchData() {
      try {
        const [accountsRes, prefsRes] = await Promise.all([
          fetch('/api/user/linked-accounts').catch(() => null),
          fetch('/api/user/preferences').catch(() => null),
        ]);

        if (accountsRes?.ok) {
          const accounts = await accountsRes.json();
          setLinkedAccounts(accounts || []);
        }
        if (prefsRes?.ok) {
          const prefs = await prefsRes.json();
          setNotificationPrefs(prefs.emailNotifications ?? null);
        }
      } catch (error) {
        logger.error('Failed to fetch profile completion data', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const completionSteps: CompletionStep[] = useMemo(() => {
    const hasName = Boolean(user?.name && user.name.trim().length > 0);
    const hasPhoto = Boolean(user?.image && !user.image.includes('placeholder'));
    const hasLinkedAccount = linkedAccounts.length > 0;
    const hasNotificationPrefs = notificationPrefs !== null;

    return [
      {
        id: 'name',
        label: 'Add your name',
        description: 'Let others know who you are',
        icon: User,
        isComplete: hasName,
        priority: 'high',
      },
      {
        id: 'photo',
        label: 'Add a profile photo',
        description: 'Help teammates recognize you',
        icon: Camera,
        isComplete: hasPhoto,
        priority: 'medium',
      },
      {
        id: 'linked-accounts',
        label: 'Link an account',
        description: 'Connect Google or GitHub for easier sign-in',
        icon: Link2,
        href: '/settings/linked-accounts',
        isComplete: hasLinkedAccount,
        priority: 'medium',
      },
      {
        id: 'notifications',
        label: 'Set notification preferences',
        description: 'Choose how you want to be notified',
        icon: Bell,
        href: '/settings/notifications',
        isComplete: hasNotificationPrefs,
        priority: 'low',
      },
    ];
  }, [user?.name, user?.image, linkedAccounts.length, notificationPrefs]);

  const completedCount = completionSteps.filter((step) => step.isComplete).length;
  const totalSteps = completionSteps.length;
  const percentComplete = Math.round((completedCount / totalSteps) * 100);
  const isFullyComplete = completedCount === totalSteps;

  // Don't show if fully complete or still loading
  if (isLoading) {
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

  if (isFullyComplete) {
    return (
      <Card className="bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-500/20 overflow-hidden">
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-500/20 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-green-700 dark:text-green-400">Profile Complete!</h3>
              <p className="text-sm text-muted-foreground">You've set up everything. Your profile is ready to go.</p>
            </div>
            <Sparkles className="h-5 w-5 text-amber-500" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const incompleteSteps = completionSteps.filter((step) => !step.isComplete);
  const nextStep = incompleteSteps[0];

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              {/* Circular progress indicator */}
              <svg className="w-12 h-12 -rotate-90" aria-hidden="true">
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-muted/30"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeDasharray={`${percentComplete * 1.26} 126`}
                  strokeLinecap="round"
                  className="text-primary transition-all duration-500"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
                {percentComplete}%
              </span>
            </div>
            <div>
              <CardTitle className="text-base">Complete Your Profile</CardTitle>
              <CardDescription className="text-sm">
                {completedCount} of {totalSteps} steps completed
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-muted-foreground"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {/* Collapsible content */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-300',
          isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <CardContent className="pt-0 space-y-3">
          {/* Progress bar */}
          <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${percentComplete}%` }}
            />
          </div>

          {/* Completion steps */}
          <div className="space-y-2">
            {completionSteps.map((step) => (
              <div
                key={step.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg transition-colors',
                  step.isComplete ? 'bg-green-500/10' : 'bg-background hover:bg-muted/50',
                )}
              >
                {/* Step icon */}
                <div
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full transition-colors',
                    step.isComplete ? 'bg-green-500/20 text-green-600' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {step.isComplete ? <Check className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
                </div>

                {/* Step info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn('font-medium text-sm', step.isComplete && 'line-through text-muted-foreground')}
                    >
                      {step.label}
                    </span>
                    {step.priority === 'high' && !step.isComplete && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        Recommended
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{step.description}</p>
                </div>

                {/* Action / Status */}
                {step.isComplete ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                ) : step.href ? (
                  <Link
                    href={step.href}
                    className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
                  >
                    Set up
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                )}
              </div>
            ))}
          </div>

          {/* Quick action hint */}
          {nextStep && !nextStep.href && (
            <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
              <ArrowRight className="h-3 w-3" />
              <span>
                Next: <strong>{nextStep.label}</strong> using the form below
              </span>
            </div>
          )}
        </CardContent>
      </div>
    </Card>
  );
}

function ProfileForm() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Track changes
  useEffect(() => {
    setHasChanges(name !== (user?.name || ''));
  }, [name, user?.name]);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    setMessage(null);
    setShowSuccess(false);

    try {
      const result = await authClient.updateUser({
        name,
      });

      if (result.error) {
        setMessage({
          type: 'error',
          text: result.error.message || 'Failed to update profile',
        });
      } else {
        setShowSuccess(true);
        setHasChanges(false);
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        // Auto-hide success state after animation
        setTimeout(() => setShowSuccess(false), 2000);
      }
    } catch (error) {
      logger.error('Failed to update profile', error);
      setMessage({ type: 'error', text: 'An unexpected error occurred' });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Profile</CardTitle>
        <CardDescription>Manage your personal information.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSaveChanges}>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={user?.image || '/placeholder.svg?height=80&width=80'} />
              <AvatarFallback className="text-lg">{getInitials(user?.name)}</AvatarFallback>
            </Avatar>
            <Button type="button" variant="outline" disabled={isUpdating}>
              Change Photo
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isUpdating}
              placeholder="Enter your full name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input id="email" type="email" value={user?.email || ''} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">
              Email address cannot be changed. Contact support if you need to update it.
            </p>
          </div>
          {message && (
            <div
              className={`text-sm p-3 rounded-md ${
                message.type === 'success'
                  ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/20'
                  : 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/20'
              }`}
            >
              {message.text}
            </div>
          )}
        </CardContent>
        <CardFooter
          className={cn(
            'border-t px-6 py-4 transition-colors duration-300',
            showSuccess ? 'bg-green-500/10' : 'bg-muted/50',
          )}
        >
          <div className="flex items-center gap-3 w-full">
            <Button
              type="submit"
              disabled={isUpdating || !name.trim() || !hasChanges}
              className={cn(
                'relative overflow-hidden transition-all duration-300',
                showSuccess && 'bg-green-500 hover:bg-green-600',
              )}
            >
              {/* Success checkmark animation */}
              <span
                className={cn(
                  'absolute inset-0 flex items-center justify-center transition-all duration-300',
                  showSuccess ? 'opacity-100 scale-100' : 'opacity-0 scale-50',
                )}
              >
                <Check className="h-5 w-5" />
              </span>
              {/* Button text */}
              <span
                className={cn(
                  'flex items-center gap-2 transition-all duration-300',
                  showSuccess ? 'opacity-0 scale-50' : 'opacity-100 scale-100',
                )}
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </span>
            </Button>

            {/* Success message with animation */}
            <div
              className={cn(
                'flex items-center gap-2 text-sm text-green-600 dark:text-green-400 transition-all duration-300',
                showSuccess ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2',
              )}
            >
              <Sparkles className="h-4 w-4" />
              <span>Changes saved!</span>
            </div>

            {/* Unsaved changes indicator */}
            {hasChanges && !showSuccess && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                <span>Unsaved changes</span>
              </div>
            )}
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}

function PrivacyDataSection() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [isUpdatingConsent, setIsUpdatingConsent] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch user data
  useEffect(() => {
    async function fetchUserData() {
      try {
        const response = await fetch('/api/users/me');
        if (response.ok) {
          const data = await response.json();
          setUserData(data);
          setMarketingConsent(data.marketingConsent ?? false);
        }
      } catch (error) {
        logger.error('Failed to fetch user data', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchUserData();
  }, []);

  const handleExportData = useCallback(async () => {
    setIsExporting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/users/me/export');

      if (response.status === 429) {
        const data = await response.json();
        setMessage({ type: 'error', text: data.message });
        return;
      }

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Download the JSON file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nuclom-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setMessage({ type: 'success', text: 'Your data has been exported successfully.' });
    } catch (error) {
      logger.error('Failed to export data', error);
      setMessage({ type: 'error', text: 'Failed to export data. Please try again.' });
    } finally {
      setIsExporting(false);
    }
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    setIsDeleting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/users/me', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Deletion failed');
      }

      setUserData((prev) =>
        prev
          ? {
              ...prev,
              deletionRequestedAt: data.deletionRequestedAt,
              deletionScheduledFor: data.deletionScheduledFor,
            }
          : null,
      );
      setMessage({ type: 'success', text: data.message });
    } catch (error) {
      logger.error('Failed to request account deletion', error);
      setMessage({ type: 'error', text: 'Failed to request account deletion. Please try again.' });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  }, []);

  const handleCancelDeletion = useCallback(async () => {
    setIsCancelling(true);
    setMessage(null);

    try {
      const response = await fetch('/api/users/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel_deletion' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel deletion');
      }

      setUserData((prev) =>
        prev
          ? {
              ...prev,
              deletionRequestedAt: null,
              deletionScheduledFor: null,
            }
          : null,
      );
      setMessage({ type: 'success', text: data.message });
    } catch (error) {
      logger.error('Failed to cancel deletion', error);
      setMessage({ type: 'error', text: 'Failed to cancel deletion. Please try again.' });
    } finally {
      setIsCancelling(false);
    }
  }, []);

  const handleMarketingConsentChange = useCallback(async (checked: boolean) => {
    setIsUpdatingConsent(true);
    setMessage(null);

    try {
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketingConsent: checked }),
      });

      if (!response.ok) {
        throw new Error('Failed to update consent');
      }

      setMarketingConsent(checked);
      setMessage({
        type: 'success',
        text: checked ? 'Marketing communications enabled.' : 'Marketing communications disabled.',
      });
    } catch (error) {
      logger.error('Failed to update marketing consent preferences', error);
      setMessage({ type: 'error', text: 'Failed to update preferences.' });
    } finally {
      setIsUpdatingConsent(false);
    }
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const hasPendingDeletion = userData?.deletionRequestedAt && userData?.deletionScheduledFor;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Privacy & Data
        </CardTitle>
        <CardDescription>
          Manage your data, privacy settings, and account. Learn more in our{' '}
          <Link href="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* What We Store */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Data We Store</h3>
          <div className="grid gap-3 text-sm">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Database className="h-4 w-4" />
              <span>Profile information (name, email, avatar)</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <Video className="h-4 w-4" />
              <span>Videos you've uploaded and their metadata</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              <span>Comments and interactions</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span>Usage data and preferences</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Marketing Consent */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <Label className="text-base font-medium">Marketing Communications</Label>
            <p className="text-sm text-muted-foreground">
              Receive product updates, tips, and promotional content via email.
            </p>
          </div>
          <Switch
            checked={marketingConsent}
            onCheckedChange={handleMarketingConsentChange}
            disabled={isUpdatingConsent}
            aria-label="Marketing communications"
          />
        </div>

        <Separator />

        {/* Data Export */}
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium">Download Your Data</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Get a copy of all your data in JSON format. Includes profile, videos, comments, and settings. Limited to
              one export per 24 hours.
            </p>
          </div>
          <Button variant="outline" onClick={handleExportData} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Download My Data
              </>
            )}
          </Button>
        </div>

        <Separator />

        {/* Account Deletion */}
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Delete Account
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Permanently delete your account and all associated data. This action has a 30-day grace period during
              which you can cancel.
            </p>
          </div>

          {hasPendingDeletion ? (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-3">
              <p className="text-sm text-destructive font-medium">Account deletion scheduled</p>
              <p className="text-sm text-muted-foreground">
                Your account will be permanently deleted on{' '}
                <strong>
                  {new Date(userData.deletionScheduledFor as string).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </strong>
                .
              </p>
              <Button variant="outline" onClick={handleCancelDeletion} disabled={isCancelling}>
                {isCancelling ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  'Cancel Deletion'
                )}
              </Button>
            </div>
          ) : (
            <Button variant="destructive" onClick={() => setShowDeleteDialog(true)} disabled={isDeleting}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete My Account
            </Button>
          )}
        </div>

        {/* Status Message */}
        {message && (
          <div
            className={`text-sm p-3 rounded-md ${
              message.type === 'success'
                ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/20'
                : 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/20'
            }`}
          >
            {message.text}
          </div>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>This will:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Schedule your account for permanent deletion in 30 days</li>
                <li>Remove all your videos, comments, and settings</li>
                <li>Delete your data from our systems</li>
              </ul>
              <p className="font-medium mt-4">You can cancel this request within the 30-day grace period.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Account'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default function ProfileSettingsPage() {
  return (
    <RequireAuth>
      <div className="space-y-6">
        <ProfileCompletionCard />
        <ProfileForm />
        <PrivacyDataSection />
      </div>
    </RequireAuth>
  );
}
