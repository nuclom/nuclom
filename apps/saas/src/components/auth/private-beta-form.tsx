'use client';

import { logger } from '@nuclom/lib/client-logger';
import { Button } from '@nuclom/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nuclom/ui/card';
import { Input } from '@nuclom/ui/input';
import { Label } from '@nuclom/ui/label';
import { Textarea } from '@nuclom/ui/textarea';
import { Link } from '@vercel/microfrontends/next/client';
import { Check, Loader2 } from 'lucide-react';
import { useState } from 'react';

export function PrivateBetaForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [useCase, setUseCase] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/beta-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          company,
          useCase,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit request');
      }

      setIsSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      logger.error('Beta access request failed', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="space-y-1 pb-4">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <Check className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">Request Received</CardTitle>
          <CardDescription className="text-center">
            Thanks for your interest in Nuclom! We&apos;ll review your request and get back to you soon.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            We&apos;re currently in private beta and rolling out access gradually. You&apos;ll receive an email at{' '}
            <span className="font-medium text-foreground">{email}</span> when your access is approved.
          </p>
          <div className="pt-2">
            <Link href="/">
              <Button variant="outline" className="w-full">
                Back to Home
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1 pb-4">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full w-fit mb-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          Private Beta
        </div>
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl font-bold">Request Access</CardTitle>
          <Link href="/login" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            Already have access?
          </Link>
        </div>
        <CardDescription>
          Nuclom is currently in private beta. Fill out the form below to request early access.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Work Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">Company (optional)</Label>
            <Input
              id="company"
              type="text"
              placeholder="Your company name"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="useCase">How do you plan to use Nuclom?</Label>
            <Textarea
              id="useCase"
              placeholder="Tell us about your video collaboration needs..."
              value={useCase}
              onChange={(e) => setUseCase(e.target.value)}
              rows={3}
              disabled={isLoading}
            />
          </div>

          {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>}

          <Button type="submit" className="w-full h-11" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              'Request Access'
            )}
          </Button>
        </form>

        <p className="text-xs text-center text-muted-foreground pt-2">
          By requesting access, you agree to our{' '}
          <Link href="/terms" target="_blank" className="text-primary hover:underline">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" target="_blank" className="text-primary hover:underline">
            Privacy Policy
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
