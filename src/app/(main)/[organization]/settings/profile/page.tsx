'use client';

import { AlertTriangle, Database, Download, Loader2, Mail, MessageSquare, Shield, Trash2, Video } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/use-auth';
import { authClient } from '@/lib/auth-client';

interface UserData {
  id: string;
  name: string;
  email: string;
  marketingConsent?: boolean;
  marketingConsentAt?: string | null;
  deletionRequestedAt?: string | null;
  deletionScheduledFor?: string | null;
}

function ProfileForm() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

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
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
      }
    } catch (error) {
      console.error('Profile update error:', error);
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
        <CardFooter className="bg-muted/50 border-t px-6 py-4">
          <Button type="submit" disabled={isUpdating || !name.trim()}>
            {isUpdating ? 'Saving...' : 'Save Changes'}
          </Button>
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
        console.error('Failed to fetch user data:', error);
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
      console.error('Export error:', error);
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
      console.error('Delete error:', error);
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
      console.error('Cancel deletion error:', error);
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
      console.error('Consent update error:', error);
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
        <ProfileForm />
        <PrivacyDataSection />
      </div>
    </RequireAuth>
  );
}
