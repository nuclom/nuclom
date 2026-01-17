'use client';

import { SkipBack, SkipForward } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TouchFeedback } from '../hooks/use-touch-gestures';

interface TouchSkipFeedbackProps {
  feedback: TouchFeedback | null;
}

export function TouchSkipFeedback({ feedback }: TouchSkipFeedbackProps) {
  if (!feedback?.visible) return null;

  const Icon = feedback.side === 'left' ? SkipBack : SkipForward;

  return (
    <div
      className={cn(
        'absolute pointer-events-none z-20',
        'flex items-center justify-center gap-2',
        feedback.side === 'left' ? 'flex-row' : 'flex-row-reverse',
      )}
      style={{
        left: feedback.x,
        top: feedback.y,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* Ripple effect */}
      <div className="absolute w-20 h-20 rounded-full bg-white/20 animate-ping" />
      <div className="absolute w-16 h-16 rounded-full bg-white/30 animate-pulse" />

      {/* Skip indicator */}
      <div
        className={cn(
          'relative flex items-center gap-1.5 px-3 py-1.5 rounded-full',
          'bg-black/70 text-white font-medium text-sm',
          'animate-in zoom-in-50 duration-200',
        )}
      >
        <Icon className="h-4 w-4" />
        <span>{Math.abs(feedback.amount)}s</span>
      </div>
    </div>
  );
}
