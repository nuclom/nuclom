'use client';

import { AlertTriangle, Download, Loader2, Mail, Trash2, UserX } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { RequireAuth } from '@/components/auth/auth-guard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { authClient } from '@/lib/auth-client';

function AccountContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  // Email change state
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [_emailPassword, setEmailPassword] = useState('');
  const [changingEmail, setChangingEmail] = useState(false);

  // Export data state
  const [exporting, setExporting] = useState(false);

  // Delete account state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newEmail.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a new email address',
        variant: 'destructive',
      });
      return;
    }

    try {
      setChangingEmail(true);
      const { error } = await authClient.changeEmail({
        newEmail: newEmail.trim(),
      });

      if (error) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to change email',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Verification email sent',
        description: 'Please check your new email address to verify the change',
      });
      setEmailDialogOpen(false);
      setNewEmail('');
      setEmailPassword('');
    } catch (error) {
      console.error('Error changing email:', error);
      toast({
        title: 'Error',
        description: 'Failed to change email address',
        variant: 'destructive',
      });
    } finally {
      setChangingEmail(false);
    }
  };

  const handleExportData = async () => {
    try {
      setExporting(true);

      // Request data export from API
      const response = await fetch('/api/user/export', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to export data');
      }

      // Download the exported data
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nuclom-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Data exported',
        description: 'Your data has been downloaded',
      });
    } catch (error) {
      console.error('Error exporting data:', error);
      toast({
        title: 'Error',
        description: 'Failed to export your data',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();

    if (deleteConfirmation !== 'delete my account') {
      toast({
        title: 'Error',
        description: "Please type 'delete my account' to confirm",
        variant: 'destructive',
      });
      return;
    }

    try {
      setDeleting(true);

      const { error } = await authClient.deleteUser({
        password: deletePassword,
      });

      if (error) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to delete account',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Account deleted',
        description: 'Your account has been permanently deleted',
      });

      // Redirect to home page
      router.push('/');
    } catch (error) {
      console.error('Error deleting account:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete account',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Email Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Address
          </CardTitle>
          <CardDescription>Manage your email address</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Current email</Label>
            <div className="flex items-center gap-2">
              <Input value={user?.email || ''} disabled className="bg-muted" />
              {user?.emailVerified && <span className="text-sm text-green-600 whitespace-nowrap">Verified</span>}
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/50 border-t px-6 py-4">
          <Button variant="outline" onClick={() => setEmailDialogOpen(true)}>
            Change Email
          </Button>
        </CardFooter>
      </Card>

      {/* Data Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Your Data
          </CardTitle>
          <CardDescription>Download a copy of all your data stored in Nuclom</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Your export will include your profile information, videos, comments, and settings. This process may take a
            few moments depending on how much data you have.
          </p>
        </CardContent>
        <CardFooter className="bg-muted/50 border-t px-6 py-4">
          <Button variant="outline" onClick={handleExportData} disabled={exporting}>
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <UserX className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>Irreversible and destructive actions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>
              Deleting your account is permanent. All your data, including videos, comments, and settings will be
              permanently deleted. This action cannot be undone.
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="bg-destructive/5 border-t border-destructive/20 px-6 py-4">
          <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Account
          </Button>
        </CardFooter>
      </Card>

      {/* Change Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Email Address</DialogTitle>
            <DialogDescription>
              Enter your new email address. You&apos;ll need to verify it before the change takes effect.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangeEmail} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentEmail">Current Email</Label>
              <Input id="currentEmail" value={user?.email || ''} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newEmail">New Email Address</Label>
              <Input
                id="newEmail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="new@example.com"
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEmailDialogOpen(false);
                  setNewEmail('');
                  setEmailPassword('');
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={changingEmail}>
                {changingEmail ? 'Sending...' : 'Send Verification Email'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Your Account</DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone. All your data will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDeleteAccount} className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This will permanently delete your account and all associated data including:
                <ul className="list-disc list-inside mt-2">
                  <li>Your profile and settings</li>
                  <li>All videos you&apos;ve uploaded</li>
                  <li>All comments you&apos;ve made</li>
                  <li>Your organization memberships</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="deletePassword">Your Password</Label>
              <Input
                id="deletePassword"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deleteConfirmation">
                Type <span className="font-mono font-bold">delete my account</span> to confirm
              </Label>
              <Input
                id="deleteConfirmation"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="delete my account"
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setDeleteConfirmation('');
                  setDeletePassword('');
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={deleting || deleteConfirmation !== 'delete my account'}
              >
                {deleting ? 'Deleting...' : 'Permanently Delete Account'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AccountSettingsPage() {
  return (
    <RequireAuth>
      <AccountContent />
    </RequireAuth>
  );
}
