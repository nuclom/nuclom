'use client';

import { Link } from '@vercel/microfrontends/next/client';
import { differenceInDays, format } from 'date-fns';
import { Clock, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TrialBannerProps {
  trialEnd: Date;
  organizationSlug: string;
  className?: string;
}

export function TrialBanner({ trialEnd, organizationSlug, className }: TrialBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  const daysRemaining = Math.max(0, differenceInDays(trialEnd, new Date()));
  const isUrgent = daysRemaining <= 3;
  const isExpired = daysRemaining === 0;

  if (isDismissed && !isUrgent) {
    return null;
  }

  return (
    <div
      className={cn(
        'relative flex items-center justify-between gap-4 px-4 py-2 text-sm',
        isExpired
          ? 'bg-destructive text-destructive-foreground'
          : isUrgent
            ? 'bg-amber-500 text-amber-950 dark:bg-amber-600 dark:text-amber-50'
            : 'bg-primary text-primary-foreground',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {isExpired ? (
          <>
            <Clock className="h-4 w-4" />
            <span className="font-medium">Your trial has expired.</span>
            <span>Subscribe now to continue using Nuclom.</span>
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            <span className="font-medium">
              {daysRemaining === 1 ? '1 day' : `${daysRemaining} days`} left in your trial
            </span>
            <span className="hidden sm:inline">(ends {format(trialEnd, 'MMM d, yyyy')})</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={isExpired || isUrgent ? 'secondary' : 'outline'}
          className={cn(
            'h-7 text-xs',
            !isExpired && !isUrgent && 'bg-primary-foreground text-primary hover:bg-primary-foreground/90',
          )}
          asChild
        >
          <Link href={`/org/${organizationSlug}/settings/billing`}>{isExpired ? 'Subscribe Now' : 'Upgrade'}</Link>
        </Button>

        {!isUrgent && !isExpired && (
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="rounded-full p-1 hover:bg-primary-foreground/20"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
