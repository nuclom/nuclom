'use client';

import { Github, Link2, Loader2, Mail, Unlink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { RequireAuth } from '@/components/auth/auth-guard';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { authClient } from '@/lib/auth-client';

interface Account {
  id: string;
  providerId: string;
  accountId: string;
  createdAt: Date;
}

// Google icon component
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-label="Google">
      <title>Google</title>
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

// Provider configuration
const providers = {
  google: {
    name: 'Google',
    icon: GoogleIcon,
    description: 'Sign in with your Google account',
  },
  github: {
    name: 'GitHub',
    icon: Github,
    description: 'Sign in with your GitHub account',
  },
  credential: {
    name: 'Email & Password',
    icon: Mail,
    description: 'Sign in with your email and password',
  },
} as const;

type ProviderId = keyof typeof providers;

function LinkedAccountsContent() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null);
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);

  // Fetch linked accounts
  useEffect(() => {
    async function fetchAccounts() {
      try {
        const result = await authClient.listAccounts();
        if (result.data) {
          setAccounts(result.data as Account[]);
        }
      } catch (error) {
        console.error('Failed to fetch accounts:', error);
        toast({
          title: 'Error',
          description: 'Failed to load linked accounts',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }
    fetchAccounts();
  }, [toast]);

  const handleLinkAccount = async (providerId: 'google' | 'github') => {
    setLinkingProvider(providerId);

    try {
      await authClient.linkSocial({
        provider: providerId,
        callbackURL: window.location.href,
      });
    } catch (error) {
      console.error(`Failed to link ${providerId}:`, error);
      toast({
        title: 'Error',
        description: `Failed to link ${providers[providerId].name} account`,
        variant: 'destructive',
      });
      setLinkingProvider(null);
    }
  };

  const handleUnlinkAccount = async (providerId: string) => {
    setUnlinkingProvider(providerId);

    try {
      const result = await authClient.unlinkAccount({
        providerId,
      });

      if (result.error) {
        toast({
          title: 'Cannot unlink account',
          description: result.error.message || 'You must have at least one way to sign in',
          variant: 'destructive',
        });
        return;
      }

      // Update local state
      setAccounts((prev) => prev.filter((a) => a.providerId !== providerId));

      toast({
        title: 'Account unlinked',
        description: `Your ${providers[providerId as ProviderId]?.name || providerId} account has been unlinked`,
      });
    } catch (error) {
      console.error(`Failed to unlink ${providerId}:`, error);
      toast({
        title: 'Error',
        description: 'Failed to unlink account. You must have at least one way to sign in.',
        variant: 'destructive',
      });
    } finally {
      setUnlinkingProvider(null);
    }
  };

  const isAccountLinked = (providerId: string) => {
    return accounts.some((a) => a.providerId === providerId);
  };

  const linkedCount = accounts.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Linked Accounts
          </CardTitle>
          <CardDescription>
            Connect your social accounts for easier sign-in. You can link multiple accounts to your profile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {linkedCount === 1 && (
            <Alert>
              <AlertDescription>
                You only have one sign-in method. Link another account before unlinking this one to avoid losing access.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Google Account */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <GoogleIcon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Google</CardTitle>
                <CardDescription className="text-sm">Sign in with your Google account</CardDescription>
              </div>
            </div>
            {isAccountLinked('google') ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-green-600 font-medium">Connected</span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Not connected</span>
            )}
          </div>
        </CardHeader>
        <CardFooter className="bg-muted/50 border-t px-6 py-4">
          {isAccountLinked('google') ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleUnlinkAccount('google')}
              disabled={unlinkingProvider === 'google' || linkedCount <= 1}
            >
              {unlinkingProvider === 'google' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Unlinking...
                </>
              ) : (
                <>
                  <Unlink className="mr-2 h-4 w-4" />
                  Unlink Google
                </>
              )}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleLinkAccount('google')}
              disabled={!!linkingProvider}
            >
              {linkingProvider === 'google' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Link2 className="mr-2 h-4 w-4" />
                  Connect Google
                </>
              )}
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* GitHub Account */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Github className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">GitHub</CardTitle>
                <CardDescription className="text-sm">Sign in with your GitHub account</CardDescription>
              </div>
            </div>
            {isAccountLinked('github') ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-green-600 font-medium">Connected</span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Not connected</span>
            )}
          </div>
        </CardHeader>
        <CardFooter className="bg-muted/50 border-t px-6 py-4">
          {isAccountLinked('github') ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleUnlinkAccount('github')}
              disabled={unlinkingProvider === 'github' || linkedCount <= 1}
            >
              {unlinkingProvider === 'github' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Unlinking...
                </>
              ) : (
                <>
                  <Unlink className="mr-2 h-4 w-4" />
                  Unlink GitHub
                </>
              )}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleLinkAccount('github')}
              disabled={!!linkingProvider}
            >
              {linkingProvider === 'github' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Link2 className="mr-2 h-4 w-4" />
                  Connect GitHub
                </>
              )}
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Email & Password Account */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Email & Password</CardTitle>
                <CardDescription className="text-sm">Sign in with your email and password</CardDescription>
              </div>
            </div>
            {isAccountLinked('credential') ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-green-600 font-medium">Connected</span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Not set up</span>
            )}
          </div>
        </CardHeader>
        <CardFooter className="bg-muted/50 border-t px-6 py-4">
          <p className="text-sm text-muted-foreground">
            {isAccountLinked('credential')
              ? 'You can change your password in the Security settings.'
              : 'Set up a password in the Security settings to enable email sign-in.'}
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function LinkedAccountsPage() {
  return (
    <RequireAuth>
      <LinkedAccountsContent />
    </RequireAuth>
  );
}
