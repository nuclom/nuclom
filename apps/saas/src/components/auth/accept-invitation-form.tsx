'use client';

import { AlertCircle, CheckCircle2, Loader2, LogOut, UserPlus, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { authClient } from '@/lib/auth-client';
import { logger } from '@/lib/client-logger';

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  organizationId: string;
  inviterId: string;
  organization: {
    id: string;
    name: string;
    slug: string | null;
    logo: string | null;
  };
  inviter: {
    id: string;
    name: string;
    image: string | null;
  };
}

interface AcceptInvitationFormProps {
  invitation: Invitation | null;
  error?: string | null;
}

export function AcceptInvitationForm({ invitation, error }: AcceptInvitationFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { data: session, isPending: isSessionLoading } = authClient.useSession();
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Loading state while checking session
  if (isSessionLoading) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // 1. Error or not found
  if (error || !invitation) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-red-100 rounded-full">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">Invitation Not Found</CardTitle>
          <CardDescription className="text-center">
            {error || "This invitation doesn't exist or has been cancelled."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button className="w-full" asChild>
            <Link href="/">Go to Home</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // 2. Expired invitation
  const isExpired = new Date(invitation.expiresAt) < new Date();
  if (isExpired) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-orange-100 rounded-full">
              <AlertCircle className="h-8 w-8 text-orange-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">Invitation Expired</CardTitle>
          <CardDescription className="text-center">
            This invitation to join <strong>{invitation.organization.name}</strong> has expired. Please ask{' '}
            {invitation.inviter.name} to send you a new invitation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button className="w-full" asChild>
            <Link href="/">Go to Home</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // 3. Already accepted - redirect
  if (invitation.status === 'accepted') {
    const orgSlug = invitation.organization.slug || invitation.organizationId;
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">Already Accepted</CardTitle>
          <CardDescription className="text-center">
            You've already joined <strong>{invitation.organization.name}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button className="w-full" asChild>
            <Link href={`/org/${orgSlug}`}>Go to {invitation.organization.name}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // 4. Not logged in - show login/signup options
  if (!session) {
    const invitationId = invitation.id;
    const redirectPath = `/accept-invitation/${invitationId}`;
    const loginUrl = `/login?redirectTo=${encodeURIComponent(redirectPath)}`;
    const registerUrl = `/register?redirectTo=${encodeURIComponent(redirectPath)}&email=${encodeURIComponent(invitation.email)}`;

    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            {invitation.organization.logo ? (
              <Avatar className="h-16 w-16">
                <AvatarImage src={invitation.organization.logo} alt={invitation.organization.name} />
                <AvatarFallback className="text-lg">{invitation.organization.name[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
            ) : (
              <div className="p-3 bg-primary/10 rounded-full">
                <UserPlus className="h-8 w-8 text-primary" />
              </div>
            )}
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            You're invited to join {invitation.organization.name}
          </CardTitle>
          <CardDescription className="text-center">
            <span className="font-medium">{invitation.inviter.name}</span> invited you as a{' '}
            <span className="font-medium capitalize">{invitation.role}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-center text-muted-foreground">
            Sign in or create an account to accept this invitation.
          </p>
          <div className="flex flex-col gap-3">
            <Button className="w-full" asChild>
              <Link href={loginUrl}>Sign In</Link>
            </Button>
            <Button variant="outline" className="w-full" asChild>
              <Link href={registerUrl}>Create Account</Link>
            </Button>
          </div>
        </CardContent>
        <CardFooter className="text-center text-xs text-muted-foreground">
          <p className="w-full">Invitation sent to {invitation.email}</p>
        </CardFooter>
      </Card>
    );
  }

  // 5. Logged in as different email than invited
  if (session.user.email !== invitation.email) {
    const handleSignOut = async () => {
      setIsSigningOut(true);
      try {
        await authClient.signOut();
        router.refresh();
      } catch (err) {
        logger.error('Sign out failed', err);
        setIsSigningOut(false);
      }
    };

    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-orange-100 rounded-full">
              <AlertCircle className="h-8 w-8 text-orange-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">Wrong Account</CardTitle>
          <CardDescription className="text-center">
            This invitation was sent to a different email address.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invitation for:</span>
              <span className="font-medium">{invitation.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Signed in as:</span>
              <span className="font-medium">{session.user.email}</span>
            </div>
          </div>
          <Button className="w-full" onClick={handleSignOut} disabled={isSigningOut}>
            {isSigningOut ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing out...
              </>
            ) : (
              <>
                <LogOut className="mr-2 h-4 w-4" />
                Sign out and use correct account
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // 6. Correct user - show accept/decline
  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      const result = await authClient.organization.acceptInvitation({
        invitationId: invitation.id,
      });

      if (result.error) {
        toast({
          title: 'Error',
          description: result.error.message || 'Failed to accept invitation',
          variant: 'destructive',
        });
        setIsAccepting(false);
        return;
      }

      // Send notification to inviter
      try {
        await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: invitation.inviterId,
            type: 'invitation_accepted',
            title: `${session.user.name} joined ${invitation.organization.name}`,
            body: `Your invitation was accepted.`,
            resourceType: 'organization',
            resourceId: invitation.organizationId,
            actorId: session.user.id,
          }),
        });
      } catch (notificationError) {
        // Don't block on notification failure
        logger.error('Failed to send notification', notificationError);
      }

      toast({
        title: 'Welcome!',
        description: `You've joined ${invitation.organization.name}`,
      });

      const orgSlug = invitation.organization.slug || invitation.organizationId;
      router.push(`/org/${orgSlug}`);
      router.refresh();
    } catch (err) {
      logger.error('Failed to accept invitation', err);
      toast({
        title: 'Error',
        description: 'Failed to accept invitation. Please try again.',
        variant: 'destructive',
      });
      setIsAccepting(false);
    }
  };

  const handleDecline = async () => {
    setIsDeclining(true);
    try {
      const result = await authClient.organization.rejectInvitation({
        invitationId: invitation.id,
      });

      if (result.error) {
        toast({
          title: 'Error',
          description: result.error.message || 'Failed to decline invitation',
          variant: 'destructive',
        });
        setIsDeclining(false);
        return;
      }

      toast({
        title: 'Invitation declined',
        description: 'The invitation has been declined.',
      });

      router.push('/');
      router.refresh();
    } catch (err) {
      logger.error('Failed to decline invitation', err);
      toast({
        title: 'Error',
        description: 'Failed to decline invitation. Please try again.',
        variant: 'destructive',
      });
      setIsDeclining(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <div className="flex justify-center mb-4">
          {invitation.organization.logo ? (
            <Avatar className="h-16 w-16">
              <AvatarImage src={invitation.organization.logo} alt={invitation.organization.name} />
              <AvatarFallback className="text-lg">{invitation.organization.name[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
          ) : (
            <div className="p-3 bg-primary/10 rounded-full">
              <UserPlus className="h-8 w-8 text-primary" />
            </div>
          )}
        </div>
        <CardTitle className="text-2xl font-bold text-center">Join {invitation.organization.name}</CardTitle>
        <CardDescription className="text-center">
          <span className="font-medium">{invitation.inviter.name}</span> invited you as a{' '}
          <span className="font-medium capitalize">{invitation.role}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3">
          <Button className="w-full" onClick={handleAccept} disabled={isAccepting || isDeclining}>
            {isAccepting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Accepting...
              </>
            ) : (
              'Accept Invitation'
            )}
          </Button>
          <Button variant="outline" className="w-full" onClick={handleDecline} disabled={isAccepting || isDeclining}>
            {isDeclining ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Declining...
              </>
            ) : (
              'Decline'
            )}
          </Button>
        </div>
      </CardContent>
      <CardFooter className="text-center text-xs text-muted-foreground">
        <p className="w-full">Signed in as {session.user.email}</p>
      </CardFooter>
    </Card>
  );
}
