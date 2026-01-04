"use client";

import { useEffect, useState } from "react";

/**
 * Mobile detection hook
 * Detects if the current device is mobile based on viewport width and touch support
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      // Check viewport width
      const isNarrow = window.innerWidth < breakpoint;
      // Check for touch support
      const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
      // Consider mobile if narrow screen OR touch device with narrow screen
      setIsMobile(isNarrow || (hasTouch && window.innerWidth < 1024));
    };

    // Initial check
    checkMobile();

    // Listen for resize
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [breakpoint]);

  return isMobile;
}

// Alias for backward compatibility
export const useMobile = useIsMobile;

/**
 * Touch device detection hook
 * Detects if the current device has touch support
 */
export function useTouch(): boolean {
  const [hasTouch, setHasTouch] = useState(false);

  useEffect(() => {
    setHasTouch("ontouchstart" in window || navigator.maxTouchPoints > 0);
  }, []);

  return hasTouch;
}

/**
 * Media query hook
 * Generic hook for matching media queries
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

/**
 * Screen orientation hook
 */
export function useOrientation(): "portrait" | "landscape" {
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");

  useEffect(() => {
    const checkOrientation = () => {
      setOrientation(window.innerHeight > window.innerWidth ? "portrait" : "landscape");
    };

    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    return () => window.removeEventListener("resize", checkOrientation);
  }, []);

  return orientation;
}

/**
 * Safe area insets hook for notched devices
 */
export function useSafeArea(): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  const [safeArea, setSafeArea] = useState({ top: 0, right: 0, bottom: 0, left: 0 });

  useEffect(() => {
    const computeStyles = () => {
      const style = getComputedStyle(document.documentElement);
      setSafeArea({
        top: parseInt(style.getPropertyValue("--sat") || "0", 10) || 0,
        right: parseInt(style.getPropertyValue("--sar") || "0", 10) || 0,
        bottom: parseInt(style.getPropertyValue("--sab") || "0", 10) || 0,
        left: parseInt(style.getPropertyValue("--sal") || "0", 10) || 0,
      });
    };

    // Set CSS variables for safe area
    document.documentElement.style.setProperty("--sat", "env(safe-area-inset-top)");
    document.documentElement.style.setProperty("--sar", "env(safe-area-inset-right)");
    document.documentElement.style.setProperty("--sab", "env(safe-area-inset-bottom)");
    document.documentElement.style.setProperty("--sal", "env(safe-area-inset-left)");

    computeStyles();
    window.addEventListener("resize", computeStyles);
    return () => window.removeEventListener("resize", computeStyles);
  }, []);

  return safeArea;
}
