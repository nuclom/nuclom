'use client';

/**
 * Video Presence Component
 *
 * Displays avatars of users currently watching a video.
 * Shows up to 5 avatars with a count indicator for additional viewers.
 */

import { cn } from '@nuclom/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@nuclom/ui/avatar';
import { Eye } from 'lucide-react';
import { useMemo } from 'react';
import { useVideoPresence } from '@/hooks/use-video-presence';

// =============================================================================
// Types
// =============================================================================

export interface VideoPresenceProps {
  /** Video ID to track presence for */
  videoId: string;
  /** Additional CSS classes */
  className?: string;
  /** Maximum number of avatars to show before showing count - default: 5 */
  maxAvatars?: number;
}

// =============================================================================
// Component
// =============================================================================

export function VideoPresence({ videoId, className, maxAvatars = 5 }: VideoPresenceProps) {
  const { viewers, loading } = useVideoPresence({
    videoId,
    heartbeatInterval: 30000, // 30 seconds
    fetchInterval: 30000, // 30 seconds
  });

  // Filter out duplicate users and get visible viewers
  const { visibleViewers, remainingCount } = useMemo(() => {
    // Remove duplicates by userId
    const uniqueViewers = Array.from(new Map(viewers.map((v) => [v.userId, v])).values());

    const visible = uniqueViewers.slice(0, maxAvatars);
    const remaining = Math.max(0, uniqueViewers.length - maxAvatars);

    return {
      visibleViewers: visible,
      remainingCount: remaining,
    };
  }, [viewers, maxAvatars]);

  // Don't show anything if loading or no viewers
  if (loading || viewers.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Viewer count with eye icon */}
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm">
        <Eye className="h-3.5 w-3.5 text-white" />
        <span className="text-xs font-medium text-white">{viewers.length}</span>
      </div>

      {/* Avatar stack */}
      <div className="flex items-center -space-x-2">
        {visibleViewers.map((viewer) => (
          <Avatar
            key={viewer.userId}
            className="h-8 w-8 border-2 border-black/50 ring-1 ring-white/20 hover:z-10 transition-transform hover:scale-110"
            title={viewer.userName}
          >
            <AvatarImage src={viewer.userImage || undefined} alt={viewer.userName} />
            <AvatarFallback className="text-xs bg-gradient-to-br from-blue-500 to-purple-500 text-white">
              {viewer.userName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ))}

        {/* Show count if more than maxAvatars */}
        {remainingCount > 0 && (
          <div className="flex items-center justify-center h-8 w-8 rounded-full border-2 border-black/50 ring-1 ring-white/20 bg-gradient-to-br from-gray-600 to-gray-700 text-white text-xs font-semibold">
            +{remainingCount}
          </div>
        )}
      </div>
    </div>
  );
}
