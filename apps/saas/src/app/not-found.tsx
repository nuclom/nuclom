'use client';

import { Button } from '@nuclom/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@nuclom/ui/card';
import { Link } from '@vercel/microfrontends/next/client';
import { ArrowLeft, FileQuestion, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <FileQuestion className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl">Page not found</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground">The page you are looking for does not exist or has been moved.</p>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button className="w-full" asChild>
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Go to home
            </Link>
          </Button>
          <Button variant="outline" className="w-full" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go back
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
