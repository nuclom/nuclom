'use client';

import { AlertCircle, ArrowLeft, Mail } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Map of error codes to user-friendly messages
const errorMessages: Record<string, { title: string; description: string; showContactSupport?: boolean }> = {
  email_doesnt_match: {
    title: 'Email address mismatch',
    description:
      'The email from your social account does not match your existing account email. Please sign in with the same email you used to create your account.',
  },
  "email_doesn't_match": {
    title: 'Email address mismatch',
    description:
      'The email from your social account does not match your existing account email. Please sign in with the same email you used to create your account.',
  },
  account_not_linked: {
    title: 'Account not linked',
    description:
      'This social account is not linked to an existing account. Please sign in with your email and password, then link your social accounts in settings.',
  },
  oauth_error: {
    title: 'Authentication failed',
    description: 'There was a problem connecting to the authentication provider. Please try again.',
  },
  access_denied: {
    title: 'Access denied',
    description: 'You denied access to your account. Please try again and grant the required permissions.',
  },
  invalid_request: {
    title: 'Invalid request',
    description: 'The authentication request was invalid. Please try signing in again.',
  },
  configuration_error: {
    title: 'Configuration error',
    description: 'There is a problem with the authentication configuration. Please contact support.',
    showContactSupport: true,
  },
  default: {
    title: 'Authentication error',
    description: 'An error occurred during authentication. Please try again.',
  },
};

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get('error') || 'default';

  // Normalize error code (replace URL encoding and variations)
  const normalizedCode = errorCode.toLowerCase().replace(/%20/g, '_').replace(/\s+/g, '_');
  const errorInfo = errorMessages[normalizedCode] || errorMessages[errorCode] || errorMessages.default;

  return (
    <div className="w-full max-w-md">
      <Card>
        <CardHeader className="space-y-1 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-xl font-semibold">{errorInfo.title}</CardTitle>
            </div>
          </div>
          <CardDescription className="pt-2">{errorInfo.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorInfo.showContactSupport && (
            <Button variant="outline" className="w-full" asChild>
              <a href="mailto:support@nuclom.com">
                <Mail className="mr-2 h-4 w-4" />
                Contact Support
              </a>
            </Button>
          )}
          <Button className="w-full" asChild>
            <Link href="/login">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Sign In
            </Link>
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-primary hover:underline">
              Create one
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>Loading...</CardTitle>
            </CardHeader>
          </Card>
        </div>
      }
    >
      <AuthErrorContent />
    </Suspense>
  );
}
