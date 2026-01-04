"use client";

import { forwardRef } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * TouchButton - Button with minimum 44px touch target for mobile accessibility
 * Following Apple Human Interface Guidelines and WCAG 2.5.5
 */
export const TouchButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, size = "default", ...props }, ref) => {
    return (
      <Button
        ref={ref}
        size={size}
        className={cn(
          // Minimum 44x44px touch target
          "min-h-[44px] min-w-[44px]",
          // Better touch feedback
          "active:scale-95 transition-transform",
          // Larger hit area for icon-only buttons
          size === "icon" && "p-3",
          className,
        )}
        {...props}
      />
    );
  },
);
TouchButton.displayName = "TouchButton";

/**
 * TouchLink - Link with minimum 44px touch target
 */
export const TouchLink = forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <a
        ref={ref}
        className={cn(
          // Minimum 44x44px touch target
          "min-h-[44px] min-w-[44px]",
          "inline-flex items-center justify-center",
          // Better touch feedback
          "active:opacity-70 transition-opacity",
          className,
        )}
        {...props}
      >
        {children}
      </a>
    );
  },
);
TouchLink.displayName = "TouchLink";

/**
 * TouchArea - Generic touch target wrapper
 * Renders as a button when interactive (onClick provided), div otherwise
 */
interface TouchAreaProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean;
}

export const TouchArea = forwardRef<HTMLElement, TouchAreaProps>(({ className, onClick, children, ...props }, ref) => {
  const baseClassName = cn(
    // Minimum 44x44px touch target
    "min-h-[44px] min-w-[44px]",
    "flex items-center justify-center",
    // Touch feedback for interactive elements
    onClick && "cursor-pointer active:bg-muted/50 transition-colors",
    className,
  );

  if (onClick) {
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type="button"
        className={cn(baseClassName, "bg-transparent border-0")}
        onClick={onClick as React.MouseEventHandler<HTMLButtonElement>}
        {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {children}
      </button>
    );
  }

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      className={baseClassName}
      {...(props as React.HTMLAttributes<HTMLDivElement>)}
    >
      {children}
    </div>
  );
});
TouchArea.displayName = "TouchArea";

/**
 * SwipeableCard - Card component with swipe gesture support
 */
interface SwipeableCardProps extends React.HTMLAttributes<HTMLDivElement> {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  swipeThreshold?: number;
}

export function SwipeableCard({
  children,
  className,
  onSwipeLeft,
  onSwipeRight,
  swipeThreshold = 50,
  ...props
}: SwipeableCardProps) {
  let touchStartX = 0;
  let touchEndX = 0;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX = e.changedTouches[0].screenX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX = e.changedTouches[0].screenX;
    const diff = touchStartX - touchEndX;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        onSwipeLeft?.();
      } else {
        onSwipeRight?.();
      }
    }
  };

  return (
    <div
      className={cn("touch-pan-y", className)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * PullToRefresh - Pull down to refresh container
 */
interface PullToRefreshProps extends React.HTMLAttributes<HTMLDivElement> {
  onRefresh: () => Promise<void>;
  threshold?: number;
}

export function PullToRefresh({ children, className, onRefresh, threshold = 80, ...props }: PullToRefreshProps) {
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    // Implement pull-to-refresh logic
    // This is a simplified version - production would need more sophisticated handling
    const target = e.target as HTMLElement;
    const scrollTop = target.scrollTop ?? 0;
    if (scrollTop <= 0) {
      // Allow pull down
      e.currentTarget.style.overscrollBehavior = "none";
    }
  };

  return (
    <div className={cn("overflow-auto overscroll-y-contain", className)} onTouchMove={handleTouchMove} {...props}>
      {children}
    </div>
  );
}

/**
 * MobileBottomSheet - Bottom sheet for mobile modals
 */
export function MobileBottomSheet({
  children,
  className,
  isOpen,
  onClose,
}: {
  children: React.ReactNode;
  className?: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Close bottom sheet"
        className="fixed inset-0 bg-black/50 z-40 animate-in fade-in"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
      />
      {/* Sheet */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50",
          "bg-background rounded-t-2xl",
          "animate-in slide-in-from-bottom",
          "max-h-[85vh] overflow-auto",
          "pb-safe", // Safe area padding
          className,
        )}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>
        {children}
      </div>
    </>
  );
}
