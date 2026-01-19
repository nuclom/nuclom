'use client';

import { authClient } from '@nuclom/lib/auth-client';
import { logger } from '@nuclom/lib/client-logger';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

type VerificationStatus = 'loading' | 'success' | 'error' | 'no-token';

export function VerifyEmailForm() {
  const [status, setStatus] = useState<VerificationStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('no-token');
      return;
    }

    const verifyEmail = async () => {
      try {
        const result = await authClient.verifyEmail({
          query: { token },
        });

        if (result.error) {
          setStatus('error');
          setErrorMessage(result.error.message || 'Verification failed');
        } else {
          setStatus('success');
        }
      } catch (err) {
        setStatus('error');
        setErrorMessage('An unexpected error occurred during verification');
        logger.error('Email verification failed', err);
      }
    };

    verifyEmail();
  }, [token]);

  const handleGoToLogin = () => {
    router.push('/login');
  };

  const handleGoToDashboard = () => {
    router.push('/');
  };

  if (status === 'loading') {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Verifying your email</CardTitle>
          <CardDescription className="text-center">Please wait while we verify your email address...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (status === 'no-token') {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Invalid verification link</CardTitle>
          <CardDescription className="text-center">
            This verification link appears to be invalid or incomplete.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <XCircle className="h-12 w-12 text-destructive" />
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button className="w-full" onClick={handleGoToLogin}>
            Go to login
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Need a new verification email? Sign in to request a new one.
          </p>
        </CardFooter>
      </Card>
    );
  }

  if (status === 'error') {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Verification failed</CardTitle>
          <CardDescription className="text-center">
            {errorMessage || "We couldn't verify your email address."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <XCircle className="h-12 w-12 text-destructive" />
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button className="w-full" onClick={handleGoToLogin}>
            Go to login
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            The verification link may have expired. Sign in to request a new one.
          </p>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">Email verified!</CardTitle>
        <CardDescription className="text-center">Your email address has been successfully verified.</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center py-8">
        <CheckCircle2 className="h-12 w-12 text-green-500" />
      </CardContent>
      <CardFooter>
        <Button className="w-full" onClick={handleGoToDashboard}>
          Continue to dashboard
        </Button>
      </CardFooter>
    </Card>
  );
}
