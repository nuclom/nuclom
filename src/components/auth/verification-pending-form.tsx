'use client';

import { Mail, RefreshCw } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { authClient } from '@/lib/auth-client';
import { logger } from '@/lib/client-logger';

export function VerificationPendingForm() {
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const email = searchParams.get('email');

  const handleResendEmail = async () => {
    if (!email) {
      setResendStatus('error');
      setErrorMessage('Email address not found');
      return;
    }

    setIsResending(true);
    setResendStatus('idle');
    setErrorMessage(null);

    try {
      const result = await authClient.sendVerificationEmail({
        email,
      });

      if (result.error) {
        setResendStatus('error');
        setErrorMessage(result.error.message || 'Failed to resend verification email');
      } else {
        setResendStatus('success');
      }
    } catch (err) {
      setResendStatus('error');
      setErrorMessage('An unexpected error occurred');
      logger.error('Resend verification failed', err);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">Check your email</CardTitle>
        <CardDescription className="text-center">
          We've sent a verification link to{' '}
          {email ? <span className="font-medium text-foreground">{email}</span> : 'your email address'}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center py-4">
          <div className="rounded-full bg-primary/10 p-4">
            <Mail className="h-8 w-8 text-primary" />
          </div>
        </div>
        <div className="text-center text-sm text-muted-foreground space-y-2">
          <p>Click the link in the email to verify your account.</p>
          <p>If you don't see the email, check your spam folder.</p>
        </div>
        {resendStatus === 'success' && (
          <div className="text-sm text-green-600 bg-green-50 dark:bg-green-950/20 p-3 rounded-md text-center">
            Verification email sent! Check your inbox.
          </div>
        )}
        {resendStatus === 'error' && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md text-center">
            {errorMessage || 'Failed to resend verification email'}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        <Button variant="outline" className="w-full" onClick={handleResendEmail} disabled={isResending || !email}>
          {isResending ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Resend verification email
            </>
          )}
        </Button>
        <Button variant="link" className="w-full" asChild>
          <a href="/login">Back to login</a>
        </Button>
      </CardFooter>
    </Card>
  );
}
