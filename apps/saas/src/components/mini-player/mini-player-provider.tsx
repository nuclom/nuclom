'use client';

import { usePathname } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMiniPlayer } from '@/hooks/use-mini-player';
import { MiniPlayer } from './mini-player';

interface MiniPlayerProviderProps {
  children: React.ReactNode;
}

// Regex to match video page routes: /[organization]/videos/[id]
const VIDEO_PAGE_PATTERN = /^\/[^/]+\/videos\/[^/]+$/;

// Separate component for navigation detection that uses usePathname
// Wrapped in Suspense to handle dynamic data during prerendering
function MiniPlayerNavigationDetector() {
  const pathname = usePathname();
  const previousPathRef = useRef<string | null>(null);
  const { state, activateMiniPlayer, deactivateMiniPlayer, shouldShowForVideo } = useMiniPlayer();

  useEffect(() => {
    const previousPath = previousPathRef.current;

    // Skip on first render, just store the initial path
    if (previousPath === null) {
      previousPathRef.current = pathname;
      return;
    }

    // Skip if path hasn't changed
    if (previousPath === pathname) return;

    const wasOnVideoPage = VIDEO_PAGE_PATTERN.test(previousPath);
    const isOnVideoPage = pathname ? VIDEO_PAGE_PATTERN.test(pathname) : false;
    const previousVideoId = previousPath.split('/')[3] || null;
    const currentVideoId = pathname?.split('/')[3] || null;

    // If navigating away from a video page (or to a different video)
    if (wasOnVideoPage && (!isOnVideoPage || previousVideoId !== currentVideoId)) {
      activateMiniPlayer();
    }

    // If navigating back to the same video that's in mini-player, deactivate
    if (isOnVideoPage && state.isActive && currentVideoId && shouldShowForVideo(currentVideoId)) {
      deactivateMiniPlayer();
    }

    previousPathRef.current = pathname;
  }, [pathname, activateMiniPlayer, deactivateMiniPlayer, state.isActive, shouldShowForVideo]);

  return null;
}

export function MiniPlayerProvider({ children }: MiniPlayerProviderProps) {
  const { state } = useMiniPlayer();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <MiniPlayerNavigationDetector />
      </Suspense>
      {children}
      {mounted && state.isActive && createPortal(<MiniPlayer />, document.body)}
    </>
  );
}
