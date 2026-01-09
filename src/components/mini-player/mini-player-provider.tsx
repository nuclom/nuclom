'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMiniPlayer } from '@/hooks/use-mini-player';
import { MiniPlayer } from './mini-player';

interface MiniPlayerProviderProps {
  children: React.ReactNode;
}

// Regex to match video page routes: /[organization]/videos/[id]
const VIDEO_PAGE_PATTERN = /^\/[^/]+\/videos\/[^/]+$/;

export function MiniPlayerProvider({ children }: MiniPlayerProviderProps) {
  const pathname = usePathname();
  const previousPathRef = useRef(pathname);
  const { state, activateMiniPlayer, deactivateMiniPlayer, shouldShowForVideo } = useMiniPlayer();
  const [mounted, setMounted] = useState(false);

  // Handle client-side mounting for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Detect navigation away from video page
  useEffect(() => {
    const wasOnVideoPage = previousPathRef.current ? VIDEO_PAGE_PATTERN.test(previousPathRef.current) : false;
    const isOnVideoPage = pathname ? VIDEO_PAGE_PATTERN.test(pathname) : false;

    // Extract video ID from paths
    const previousVideoId = previousPathRef.current?.split('/')[3] || null;
    const currentVideoId = pathname?.split('/')[3] || null;

    // If navigating away from a video page (or to a different video)
    if (wasOnVideoPage && (!isOnVideoPage || previousVideoId !== currentVideoId)) {
      // Attempt to activate mini-player
      activateMiniPlayer();
    }

    // If navigating back to the same video that's in mini-player, deactivate
    if (isOnVideoPage && state.isActive && currentVideoId && shouldShowForVideo(currentVideoId)) {
      deactivateMiniPlayer();
    }

    previousPathRef.current = pathname;
  }, [pathname, activateMiniPlayer, deactivateMiniPlayer, state.isActive, shouldShowForVideo]);

  return (
    <>
      {children}
      {mounted && state.isActive && createPortal(<MiniPlayer />, document.body)}
    </>
  );
}
