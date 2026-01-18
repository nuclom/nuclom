'use client';

import { Link } from '@vercel/microfrontends/next/client';
import { AlertTriangle, Home, RefreshCcw } from 'lucide-react';
import { useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { logErrorBoundary } from '@/lib/error-logging';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// Use window.location to detect dev mode in client component
const IS_DEV = typeof window !== 'undefined' && window.location.hostname === 'localhost';

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    logErrorBoundary(error, {
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Something went wrong</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-muted-foreground">
            We encountered an unexpected error. Our team has been notified and is working to fix the issue.
          </p>

          {IS_DEV && (
            <Alert variant="destructive">
              <AlertTitle className="font-mono text-sm">{error.name}</AlertTitle>
              <AlertDescription className="mt-2 font-mono text-xs break-all whitespace-pre-wrap">
                {error.message}
              </AlertDescription>
            </Alert>
          )}

          {error.digest && (
            <p className="text-xs text-muted-foreground">
              Error ID: <code className="rounded bg-muted px-1">{error.digest}</code>
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button onClick={reset} className="w-full">
            <RefreshCcw className="mr-2 h-4 w-4" />
            Try again
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Go to home
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
