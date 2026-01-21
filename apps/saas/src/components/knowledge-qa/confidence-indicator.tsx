'use client';

import { cn } from '@nuclom/lib/utils';
import { AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ConfidenceIndicatorProps {
  confidence: number;
}

export function ConfidenceIndicator({ confidence }: ConfidenceIndicatorProps) {
  const percentage = Math.round(confidence * 100);

  let level: 'high' | 'medium' | 'low';
  let Icon: React.ElementType;
  let label: string;
  let description: string;

  if (percentage >= 75) {
    level = 'high';
    Icon = CheckCircle2;
    label = 'High confidence';
    description = 'This answer is well-supported by multiple sources in your knowledge base.';
  } else if (percentage >= 50) {
    level = 'medium';
    Icon = HelpCircle;
    label = 'Medium confidence';
    description = 'This answer is based on limited sources. Consider verifying with additional context.';
  } else {
    level = 'low';
    Icon = AlertTriangle;
    label = 'Low confidence';
    description = 'Limited relevant information found. This answer may be incomplete or speculative.';
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium cursor-help',
              level === 'high' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
              level === 'medium' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
              level === 'low' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
            )}
          >
            <Icon className="h-3 w-3" />
            <span>{label}</span>
            <span className="opacity-70">({percentage}%)</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-xs">{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
