'use client';

import { logClientError } from '@nuclom/lib/error-logging';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import * as React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

// Use window.location to detect dev mode in client component
const IS_DEV = typeof window !== 'undefined' && window.location.hostname === 'localhost';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

/**
 * React Error Boundary for catching client-side errors
 * Provides a user-friendly error display and logs errors to monitoring service
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });

    // Log error to monitoring service
    logClientError({
      error,
      componentStack: errorInfo.componentStack ?? undefined,
      context: 'ErrorBoundary',
    });

    // Call optional onError callback
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorFallback error={this.state.error} onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  onRetry?: () => void;
  showDetails?: boolean;
}

/**
 * Default error fallback UI component
 */
export function ErrorFallback({ error, onRetry, showDetails = false }: ErrorFallbackProps) {
  return (
    <div className="flex min-h-[400px] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <CardTitle>Something went wrong</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            An unexpected error occurred. Please try again or contact support if the problem persists.
          </p>

          {(IS_DEV || showDetails) && error && (
            <Alert variant="destructive">
              <AlertTitle className="font-mono text-sm">{error.name}</AlertTitle>
              <AlertDescription className="mt-2 font-mono text-xs break-all">{error.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          {onRetry && (
            <Button onClick={onRetry} variant="default">
              <RefreshCcw className="mr-2 h-4 w-4" />
              Try again
            </Button>
          )}
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

/**
 * Hook-based error boundary wrapper for functional components
 */
export function withErrorBoundary<P extends object>(Component: React.ComponentType<P>, fallback?: React.ReactNode) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `WithErrorBoundary(${Component.displayName || Component.name || 'Component'})`;

  return WrappedComponent;
}
