"use client";

import { AlertTriangle, ArrowLeft, Home, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { logClientError } from "@/lib/error-logging";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

const IS_DEV = typeof window !== "undefined" && window.location.hostname === "localhost";

export default function OrganizationErrorPage({ error, reset }: ErrorPageProps) {
  const params = useParams();
  const organization = params?.organization as string;

  useEffect(() => {
    logClientError({
      error,
      context: "OrganizationErrorPage",
      metadata: {
        digest: error.digest,
        organization,
      },
    });
  }, [error, organization]);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Something went wrong</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-muted-foreground">
            We encountered an error while loading this page. Please try again or navigate to another section.
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
          <div className="flex w-full gap-2">
            <Button variant="outline" className="flex-1" asChild>
              <Link href={organization ? `/${organization}` : "/"}>
                <Home className="mr-2 h-4 w-4" />
                Dashboard
              </Link>
            </Button>
            <Button variant="ghost" className="flex-1" onClick={() => window.history.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go back
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
