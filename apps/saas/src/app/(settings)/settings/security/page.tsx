'use client';

import { authClient, multiSession } from '@nuclom/lib/auth-client';
import {
  AlertTriangle,
  Key,
  KeyRound,
  Laptop,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Shield,
  Smartphone,
  Trash2,
  Users,
} from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import { RequireAuth } from '@/components/auth/auth-guard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import { useToast } from '@/hooks/use-toast';

type Session = {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
};

type Passkey = {
  id: string;
  name?: string | null;
  credentialID: string;
  createdAt?: Date | null;
  deviceType?: string | null;
};

type DeviceSession = {
  session: {
    id: string;
    token: string;
    userId: string;
    expiresAt: Date;
    createdAt: Date;
    userAgent?: string | null;
    ipAddress?: string | null;
  };
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
};

function SecurityContent() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [deviceSessions, setDeviceSessions] = useState<DeviceSession[]>([]);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [currentSessionToken, setCurrentSessionToken] = useState<string | null>(null);
  const [switchingSession, setSwitchingSession] = useState<string | null>(null);

  // Passkey state
  const [addingPasskey, setAddingPasskey] = useState(false);
  const [passkeyName, setPasskeyName] = useState('');
  const [passkeyDialogOpen, setPasskeyDialogOpen] = useState(false);

  // 2FA setup state
  const [setup2FAOpen, setSetup2FAOpen] = useState(false);
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [setupStep, setSetupStep] = useState<'qr' | 'verify' | 'backup'>('qr');

  // Password change state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Disable 2FA state
  const [disable2FAOpen, setDisable2FAOpen] = useState(false);
  const [disable2FAPassword, setDisable2FAPassword] = useState('');
  const [disabling2FA, setDisabling2FA] = useState(false);

  const loadSecurityData = useCallback(async () => {
    try {
      setLoading(true);

      // Get current session
      const { data: sessionData } = await authClient.getSession();
      if (sessionData?.session) {
        setCurrentSessionToken(sessionData.session.token);
      }

      // Check if 2FA is enabled
      if (sessionData?.user) {
        setIs2FAEnabled(!!(sessionData.user as { twoFactorEnabled?: boolean }).twoFactorEnabled);
      }

      // Get all sessions
      const { data: sessionsData } = await authClient.listSessions();
      if (sessionsData) {
        setSessions(sessionsData as Session[]);
      }

      // Get passkeys
      try {
        const { data: passkeysData } = await authClient.passkey.listUserPasskeys();
        if (passkeysData) {
          setPasskeys(passkeysData as Passkey[]);
        }
      } catch {
        // Passkeys might not be set up
      }

      // Get device sessions (multi-session support)
      try {
        const { data: deviceSessionsData } = await multiSession.listDeviceSessions();
        if (deviceSessionsData) {
          setDeviceSessions(deviceSessionsData as DeviceSession[]);
        }
      } catch {
        // Multi-session might not be available
      }
    } catch (error) {
      console.error('Error loading security data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load security settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadSecurityData();
  }, [loadSecurityData]);

  const handleRevokeSession = async (sessionToken: string) => {
    try {
      await authClient.revokeSession({ token: sessionToken });
      toast({
        title: 'Session revoked',
        description: 'The session has been logged out',
      });
      await loadSecurityData();
    } catch (error) {
      console.error('Error revoking session:', error);
      toast({
        title: 'Error',
        description: 'Failed to revoke session',
        variant: 'destructive',
      });
    }
  };

  const handleRevokeAllSessions = async () => {
    try {
      await authClient.revokeOtherSessions();
      toast({
        title: 'Sessions revoked',
        description: 'All other sessions have been logged out',
      });
      await loadSecurityData();
    } catch (error) {
      console.error('Error revoking sessions:', error);
      toast({
        title: 'Error',
        description: 'Failed to revoke sessions',
        variant: 'destructive',
      });
    }
  };

  const handleSwitchSession = async (sessionToken: string) => {
    try {
      setSwitchingSession(sessionToken);
      await multiSession.setActive({ sessionToken });
      toast({
        title: 'Switched account',
        description: 'You are now using a different account',
      });
      // Reload the page to reflect the new session
      window.location.reload();
    } catch (error) {
      console.error('Error switching session:', error);
      toast({
        title: 'Error',
        description: 'Failed to switch account',
        variant: 'destructive',
      });
    } finally {
      setSwitchingSession(null);
    }
  };

  const handleRevokeDeviceSession = async (sessionToken: string) => {
    try {
      await multiSession.revoke({ sessionToken });
      toast({
        title: 'Session revoked',
        description: 'The account session has been removed from this device',
      });
      await loadSecurityData();
    } catch (error) {
      console.error('Error revoking device session:', error);
      toast({
        title: 'Error',
        description: 'Failed to revoke session',
        variant: 'destructive',
      });
    }
  };

  const handleStart2FASetup = async () => {
    try {
      const { data } = await authClient.twoFactor.enable({
        password: currentPassword || 'placeholder', // Will be validated server-side
      });
      if (data) {
        setTotpUri((data as { totpURI?: string }).totpURI || null);
        setBackupCodes((data as { backupCodes?: string[] }).backupCodes || []);
        setSetup2FAOpen(true);
        setSetupStep('qr');
      }
    } catch (error) {
      console.error('Error starting 2FA setup:', error);
      toast({
        title: 'Error',
        description: 'Failed to start 2FA setup. Please enter your password.',
        variant: 'destructive',
      });
    }
  };

  const handleVerify2FA = async () => {
    try {
      setVerifying(true);
      const { error } = await authClient.twoFactor.verifyTotp({
        code: verifyCode,
      });
      if (error) {
        toast({
          title: 'Error',
          description: error.message || 'Invalid verification code',
          variant: 'destructive',
        });
        return;
      }
      setSetupStep('backup');
      setIs2FAEnabled(true);
      toast({
        title: '2FA Enabled',
        description: 'Two-factor authentication has been enabled',
      });
    } catch (error) {
      console.error('Error verifying 2FA:', error);
      toast({
        title: 'Error',
        description: 'Failed to verify code',
        variant: 'destructive',
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleDisable2FA = async () => {
    try {
      setDisabling2FA(true);
      const { error } = await authClient.twoFactor.disable({
        password: disable2FAPassword,
      });
      if (error) {
        toast({
          title: 'Error',
          description: error.message || 'Invalid password',
          variant: 'destructive',
        });
        return;
      }
      setIs2FAEnabled(false);
      setDisable2FAOpen(false);
      setDisable2FAPassword('');
      toast({
        title: '2FA Disabled',
        description: 'Two-factor authentication has been disabled',
      });
    } catch (error) {
      console.error('Error disabling 2FA:', error);
      toast({
        title: 'Error',
        description: 'Failed to disable 2FA',
        variant: 'destructive',
      });
    } finally {
      setDisabling2FA(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'destructive',
      });
      return;
    }
    try {
      setChangingPassword(true);
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (error) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to change password',
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Password changed',
        description: 'Your password has been updated and other sessions have been logged out',
      });
      setPasswordDialogOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error changing password:', error);
      toast({
        title: 'Error',
        description: 'Failed to change password',
        variant: 'destructive',
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleAddPasskey = async () => {
    try {
      setAddingPasskey(true);
      const { error } = await authClient.passkey.addPasskey({
        name: passkeyName || undefined,
      });
      if (error) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to add passkey',
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Passkey added',
        description: 'Your passkey has been registered',
      });
      setPasskeyDialogOpen(false);
      setPasskeyName('');
      await loadSecurityData();
    } catch (error) {
      console.error('Error adding passkey:', error);
      toast({
        title: 'Error',
        description: 'Failed to add passkey. Make sure your browser supports WebAuthn.',
        variant: 'destructive',
      });
    } finally {
      setAddingPasskey(false);
    }
  };

  const handleDeletePasskey = async (passkeyId: string) => {
    try {
      const { error } = await authClient.passkey.deletePasskey({
        id: passkeyId,
      });
      if (error) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to delete passkey',
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Passkey deleted',
        description: 'Your passkey has been removed',
      });
      await loadSecurityData();
    } catch (error) {
      console.error('Error deleting passkey:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete passkey',
        variant: 'destructive',
      });
    }
  };

  const getDeviceIcon = (userAgent?: string | null) => {
    if (!userAgent) return Laptop;
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return Smartphone;
    }
    return Laptop;
  };

  const formatUserAgent = (userAgent?: string | null) => {
    if (!userAgent) return 'Unknown device';
    // Simple parsing - could be enhanced with a library
    if (userAgent.includes('Chrome')) return 'Chrome Browser';
    if (userAgent.includes('Firefox')) return 'Firefox Browser';
    if (userAgent.includes('Safari')) return 'Safari Browser';
    if (userAgent.includes('Edge')) return 'Edge Browser';
    return 'Web Browser';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>Loading security settings...</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Password Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Password
          </CardTitle>
          <CardDescription>Change your account password</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            It&apos;s a good idea to use a strong password that you don&apos;t use elsewhere.
          </p>
        </CardContent>
        <CardFooter className="bg-muted/50 border-t px-6 py-4">
          <Button onClick={() => setPasswordDialogOpen(true)}>Change Password</Button>
        </CardFooter>
      </Card>

      {/* Two-Factor Authentication Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>Add an extra layer of security to your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Authenticator App</p>
              <p className="text-sm text-muted-foreground">Use an authenticator app to generate one-time codes</p>
            </div>
            <Badge variant={is2FAEnabled ? 'default' : 'outline'}>{is2FAEnabled ? 'Enabled' : 'Disabled'}</Badge>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/50 border-t px-6 py-4">
          {is2FAEnabled ? (
            <Button variant="destructive" onClick={() => setDisable2FAOpen(true)}>
              Disable 2FA
            </Button>
          ) : (
            <Button onClick={handleStart2FASetup}>Enable 2FA</Button>
          )}
        </CardFooter>
      </Card>

      {/* Passkeys Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Passkeys
          </CardTitle>
          <CardDescription>Use biometrics or hardware security keys for passwordless login</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {passkeys.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No passkeys registered. Add a passkey for faster, more secure sign-ins.
            </p>
          ) : (
            <div className="space-y-3">
              {passkeys.map((passkey) => (
                <div key={passkey.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <KeyRound className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{passkey.name || 'Passkey'}</p>
                      <p className="text-xs text-muted-foreground">
                        {passkey.deviceType || 'Security Key'} &bull; Added{' '}
                        {passkey.createdAt ? new Date(passkey.createdAt).toLocaleDateString() : 'recently'}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDeletePasskey(passkey.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="bg-muted/50 border-t px-6 py-4">
          <Button onClick={() => setPasskeyDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Passkey
          </Button>
        </CardFooter>
      </Card>

      {/* Active Sessions Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Laptop className="h-5 w-5" />
              Active Sessions
            </CardTitle>
            <CardDescription>Manage your active sessions across devices</CardDescription>
          </div>
          {sessions.length > 1 && (
            <Button variant="outline" size="sm" onClick={handleRevokeAllSessions}>
              Sign out all other sessions
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {sessions.map((session) => {
            const DeviceIcon = getDeviceIcon(session.userAgent);
            const isCurrent = session.token === currentSessionToken;
            return (
              <div key={session.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <DeviceIcon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{formatUserAgent(session.userAgent)}</p>
                      {isCurrent && (
                        <Badge variant="secondary" className="text-xs">
                          Current
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {session.ipAddress || 'Unknown IP'} &bull; Active{' '}
                      {new Date(session.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {!isCurrent && (
                  <Button variant="ghost" size="sm" onClick={() => handleRevokeSession(session.token)}>
                    Sign out
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Multi-Session / Account Switching Section */}
      {deviceSessions.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Linked Accounts
            </CardTitle>
            <CardDescription>Switch between accounts signed in on this device</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {deviceSessions.map((deviceSession) => {
              const isCurrent = deviceSession.session.token === currentSessionToken;
              return (
                <div key={deviceSession.session.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center overflow-hidden relative">
                      {deviceSession.user?.image ? (
                        <Image
                          src={deviceSession.user.image}
                          alt={deviceSession.user.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <span className="text-sm font-medium">
                          {deviceSession.user?.name?.[0]?.toUpperCase() ?? '?'}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{deviceSession.user?.name ?? 'Unknown User'}</p>
                        {isCurrent && (
                          <Badge variant="secondary" className="text-xs">
                            Active
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{deviceSession.user?.email ?? 'No email'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isCurrent && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSwitchSession(deviceSession.session.token)}
                        disabled={switchingSession === deviceSession.session.token}
                      >
                        {switchingSession === deviceSession.session.token ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          'Switch'
                        )}
                      </Button>
                    )}
                    {!isCurrent && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRevokeDeviceSession(deviceSession.session.token)}
                      >
                        <LogOut className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Password Change Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Enter your current password and a new password</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPasswordDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={changingPassword}>
                {changingPassword ? 'Changing...' : 'Change Password'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2FA Setup Dialog */}
      <Dialog open={setup2FAOpen} onOpenChange={setSetup2FAOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {setupStep === 'qr' && 'Set up Two-Factor Authentication'}
              {setupStep === 'verify' && 'Verify Setup'}
              {setupStep === 'backup' && 'Save Backup Codes'}
            </DialogTitle>
          </DialogHeader>

          {setupStep === 'qr' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
              </p>
              {totpUri && (
                <div className="flex justify-center p-4 bg-white rounded-lg">
                  <QRCode value={totpUri} size={200} />
                </div>
              )}
              <DialogFooter>
                <Button onClick={() => setSetupStep('verify')}>Continue</Button>
              </DialogFooter>
            </div>
          )}

          {setupStep === 'verify' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app</p>
              <div className="space-y-2">
                <Label htmlFor="verifyCode">Verification Code</Label>
                <Input
                  id="verifyCode"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  className="text-center text-2xl tracking-widest"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSetupStep('qr')}>
                  Back
                </Button>
                <Button onClick={handleVerify2FA} disabled={verifying || verifyCode.length !== 6}>
                  {verifying ? 'Verifying...' : 'Verify'}
                </Button>
              </DialogFooter>
            </div>
          )}

          {setupStep === 'backup' && (
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Save your backup codes</AlertTitle>
                <AlertDescription>
                  These codes can be used to access your account if you lose your authenticator. Store them securely.
                </AlertDescription>
              </Alert>
              <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg font-mono text-sm">
                {backupCodes.map((code, index) => (
                  <div key={index} className="text-center py-1">
                    {code}
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button
                  onClick={() => {
                    setSetup2FAOpen(false);
                    setSetupStep('qr');
                    setVerifyCode('');
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Disable 2FA Dialog */}
      <Dialog open={disable2FAOpen} onOpenChange={setDisable2FAOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
            <DialogDescription>Enter your password to disable 2FA</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="disable2FAPassword">Password</Label>
              <Input
                id="disable2FAPassword"
                type="password"
                value={disable2FAPassword}
                onChange={(e) => setDisable2FAPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDisable2FAOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDisable2FA} disabled={disabling2FA || !disable2FAPassword}>
                {disabling2FA ? 'Disabling...' : 'Disable 2FA'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Passkey Dialog */}
      <Dialog open={passkeyDialogOpen} onOpenChange={setPasskeyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a Passkey</DialogTitle>
            <DialogDescription>
              Register a passkey for passwordless login using biometrics or a security key
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="passkeyName">Passkey Name (optional)</Label>
              <Input
                id="passkeyName"
                value={passkeyName}
                onChange={(e) => setPasskeyName(e.target.value)}
                placeholder="e.g., MacBook Pro, iPhone"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPasskeyDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddPasskey} disabled={addingPasskey}>
                {addingPasskey ? 'Registering...' : 'Register Passkey'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SecuritySettingsPage() {
  return (
    <RequireAuth>
      <SecurityContent />
    </RequireAuth>
  );
}
