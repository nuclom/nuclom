'use client';

import { AlertTriangle, Flag, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/client-logger';

export type ReportResourceType = 'video' | 'comment' | 'user';
export type ReportCategory = 'inappropriate' | 'spam' | 'copyright' | 'harassment' | 'other';

interface ReportDialogProps {
  resourceType: ReportResourceType;
  resourceId: string;
  trigger?: React.ReactNode;
  onReportSubmitted?: () => void;
}

const categoryLabels: Record<ReportCategory, { label: string; description: string }> = {
  inappropriate: {
    label: 'Inappropriate Content',
    description: 'Contains nudity, violence, or other inappropriate material',
  },
  spam: {
    label: 'Spam or Misleading',
    description: 'Promotional content, scams, or misleading information',
  },
  copyright: {
    label: 'Copyright Violation',
    description: 'Infringes on intellectual property rights',
  },
  harassment: {
    label: 'Harassment or Bullying',
    description: 'Targets or harasses individuals or groups',
  },
  other: {
    label: 'Other',
    description: 'Another issue not listed above',
  },
};

export function ReportDialog({ resourceType, resourceId, trigger, onReportSubmitted }: ReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const resourceLabel = resourceType === 'video' ? 'video' : resourceType === 'comment' ? 'comment' : 'user';

  const handleSubmit = useCallback(async () => {
    if (!category) {
      toast({
        title: 'Please select a category',
        description: 'Choose a reason for your report.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceType,
          resourceId,
          category,
          description: description.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (response.status === 409) {
        toast({
          title: 'Already reported',
          description: 'You have already reported this content. Our team will review it.',
        });
        setOpen(false);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit report');
      }

      toast({
        title: 'Report submitted',
        description: 'Thank you for your report. Our team will review it shortly.',
      });

      // Reset and close
      setCategory(null);
      setDescription('');
      setOpen(false);
      onReportSubmitted?.();
    } catch (error) {
      logger.error('Report submission error', error);
      toast({
        title: 'Error',
        description: 'Failed to submit report. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [category, description, resourceType, resourceId, toast, onReportSubmitted]);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      // Reset form when closing
      setCategory(null);
      setDescription('');
    }
    setOpen(newOpen);
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <Flag className="h-4 w-4 mr-1" />
            Report
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Report {resourceLabel}
          </DialogTitle>
          <DialogDescription>
            Help us understand the issue with this {resourceLabel}. False reports may result in action against your
            account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Category Selection */}
          <div className="space-y-3">
            <Label className="text-base font-medium">What's the issue?</Label>
            <RadioGroup value={category || ''} onValueChange={(value) => setCategory(value as ReportCategory)}>
              {Object.entries(categoryLabels).map(([key, { label, description }]) => (
                <div
                  key={key}
                  role="button"
                  tabIndex={0}
                  className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => setCategory(key as ReportCategory)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setCategory(key as ReportCategory);
                    }
                  }}
                >
                  <RadioGroupItem value={key} id={key} className="mt-1" />
                  <div className="flex-1 space-y-1">
                    <Label htmlFor={key} className="font-medium cursor-pointer">
                      {label}
                    </Label>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Additional Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Additional details (optional)</Label>
            <Textarea
              id="description"
              placeholder="Provide any additional context that might help our review..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              className="resize-none"
              rows={3}
            />
            <p className="text-xs text-muted-foreground text-right">{description.length}/2000</p>
          </div>

          <p className="text-xs text-muted-foreground">
            By submitting this report, you agree to our{' '}
            <Link href="/content-policy" className="text-primary hover:underline">
              Content Policy
            </Link>
            . We take all reports seriously and will review this {resourceLabel} accordingly.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !category}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Flag className="mr-2 h-4 w-4" />
                Submit Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Dropdown menu item for use in menus
export function ReportMenuItem({
  resourceType,
  resourceId,
  onReportSubmitted,
}: {
  resourceType: ReportResourceType;
  resourceId: string;
  onReportSubmitted?: () => void;
}) {
  return (
    <ReportDialog
      resourceType={resourceType}
      resourceId={resourceId}
      onReportSubmitted={onReportSubmitted}
      trigger={
        <button
          type="button"
          className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 w-full text-left hover:bg-accent"
        >
          <Flag className="mr-2 h-4 w-4" />
          Report
        </button>
      }
    />
  );
}
