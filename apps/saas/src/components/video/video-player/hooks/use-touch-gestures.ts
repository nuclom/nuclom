'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface TouchFeedback {
  visible: boolean;
  side: 'left' | 'right';
  amount: number;
  x: number;
  y: number;
}

interface UseTouchGesturesOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onDoubleTapLeft: () => void;
  onDoubleTapRight: () => void;
  onSingleTap: () => void;
  skipAmount?: number;
  enabled?: boolean;
}

interface UseTouchGesturesResult {
  feedback: TouchFeedback | null;
}

const DOUBLE_TAP_DELAY = 300; // ms

export function useTouchGestures({
  containerRef,
  onDoubleTapLeft,
  onDoubleTapRight,
  onSingleTap,
  skipAmount = 10,
  enabled = true,
}: UseTouchGesturesOptions): UseTouchGesturesResult {
  const [feedback, setFeedback] = useState<TouchFeedback | null>(null);
  const lastTapRef = useRef<{ time: number; side: 'left' | 'right' } | null>(null);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const consecutiveTapsRef = useRef<{ count: number; side: 'left' | 'right' } | null>(null);

  const showFeedback = useCallback(
    (side: 'left' | 'right', x: number, y: number, multiplier: number = 1) => {
      setFeedback({
        visible: true,
        side,
        amount: side === 'left' ? -skipAmount * multiplier : skipAmount * multiplier,
        x,
        y,
      });

      setTimeout(() => setFeedback(null), 600);
    },
    [skipAmount],
  );

  useEffect(() => {
    if (!enabled) return;

    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Don't interfere with controls
      const target = e.target as HTMLElement;
      if (
        target.closest('button') ||
        target.closest('[role="slider"]') ||
        target.closest('[role="menu"]') ||
        target.closest('[data-radix-popper-content-wrapper]')
      ) {
        return;
      }

      const touch = e.touches[0];
      const rect = container.getBoundingClientRect();
      const relativeX = touch.clientX - rect.left;
      const relativeY = touch.clientY - rect.top;
      const side: 'left' | 'right' = relativeX < rect.width / 2 ? 'left' : 'right';
      const now = Date.now();

      const lastTap = lastTapRef.current;

      if (lastTap && now - lastTap.time < DOUBLE_TAP_DELAY && lastTap.side === side) {
        // Double tap detected
        e.preventDefault();

        if (tapTimeoutRef.current) {
          clearTimeout(tapTimeoutRef.current);
          tapTimeoutRef.current = null;
        }

        // Track consecutive taps on the same side
        if (consecutiveTapsRef.current?.side === side) {
          consecutiveTapsRef.current.count += 1;
        } else {
          consecutiveTapsRef.current = { count: 1, side };
        }

        const multiplier = consecutiveTapsRef.current.count;

        if (side === 'left') {
          onDoubleTapLeft();
        } else {
          onDoubleTapRight();
        }

        showFeedback(side, relativeX, relativeY, multiplier);
        lastTapRef.current = null;

        // Reset consecutive taps after delay
        setTimeout(() => {
          consecutiveTapsRef.current = null;
        }, DOUBLE_TAP_DELAY * 2);
      } else {
        // First tap - wait for potential second tap
        lastTapRef.current = { time: now, side };
        consecutiveTapsRef.current = null;

        tapTimeoutRef.current = setTimeout(() => {
          onSingleTap();
          lastTapRef.current = null;
        }, DOUBLE_TAP_DELAY);
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
    };
  }, [containerRef, enabled, onDoubleTapLeft, onDoubleTapRight, onSingleTap, showFeedback]);

  return { feedback };
}
