'use client';

/**
 * Interactive Card Component
 *
 * A reusable wrapper that makes any content clickable with proper
 * accessibility support (keyboard navigation, focus states).
 */

import { cn } from '@nuclom/lib/utils';
import type { KeyboardEvent, ReactNode } from 'react';

interface InteractiveCardProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: 'default' | 'compact';
}

export function InteractiveCard({ children, onClick, className, variant = 'default' }: InteractiveCardProps) {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  const baseStyles =
    variant === 'compact'
      ? 'flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors'
      : 'p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors';

  if (!onClick) {
    return <div className={cn(baseStyles, className)}>{children}</div>;
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(baseStyles, 'cursor-pointer', className)}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}

export default InteractiveCard;
