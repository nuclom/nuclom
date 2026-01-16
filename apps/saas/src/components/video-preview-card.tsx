'use client';

import { Clock, Maximize2, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatRelativeTime, formatTime } from '@/lib/format-utils';
import { IMAGE_SIZES, VIDEO_THUMBNAIL_BLUR_DATA_URL } from '@/lib/image-utils';
import type { VideoWithAuthor } from '@/lib/types';
import { cn } from '@/lib/utils';

interface VideoPreviewCardProps {
  video: VideoWithAuthor & { views?: number };
  organization?: string;
  priority?: boolean;
  showProgress?: boolean;
  progress?: number;
  savedTime?: number;
}

export function VideoPreviewCard({
  video,
  organization,
  priority = false,
  showProgress = false,
  progress = 0,
  savedTime = 0,
}: VideoPreviewCardProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const organizationSlug = organization || 'default';

  const [isHovered, setIsHovered] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(savedTime);
  const [duration, setDuration] = useState(0);
  const [videoError, setVideoError] = useState(false);
  const [thumbnailError, setThumbnailError] = useState(false);

  // Set initial position when video loads (don't auto-play)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !video.src || videoError) return;

    // Set initial position from saved time
    if (savedTime > 0 && video.currentTime === 0) {
      video.currentTime = savedTime;
    }
  }, [savedTime, videoError]);

  // Handle video metadata loaded
  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      setDuration(video.duration);
      // Seek to saved position
      if (savedTime > 0) {
        video.currentTime = savedTime;
      }
    }
  }, [savedTime]);

  // Handle time update
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      setCurrentTime(video.currentTime);
    }
  }, []);

  // Handle play/pause toggle
  const handleTogglePlay = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const video = videoRef.current;
      if (!video) return;

      if (isPlaying) {
        video.pause();
      } else {
        video.play().catch(() => {});
      }
    },
    [isPlaying],
  );

  // Handle mute toggle
  const handleToggleMute = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  // Handle expand to full video page
  const handleExpand = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const videoEl = videoRef.current;
      const time = videoEl ? Math.floor(videoEl.currentTime) : Math.floor(savedTime);
      const url =
        time > 0
          ? `/org/${organizationSlug}/videos/${video.id}?t=${time}`
          : `/org/${organizationSlug}/videos/${video.id}`;

      router.push(url);
    },
    [organizationSlug, video.id, savedTime, router],
  );

  // Handle video error
  const handleVideoError = useCallback(() => {
    setVideoError(true);
  }, []);

  // Calculate progress percentage
  const playbackProgress = duration > 0 ? (currentTime / duration) * 100 : progress;

  // Check if video is new (within 7 days)
  const isNew = video.createdAt && new Date(video.createdAt).getTime() > Date.now() - 86400000 * 7;

  return (
    <div className="group relative" ref={containerRef}>
      <div
        className="block cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleExpand}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleExpand(e as unknown as React.MouseEvent);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Play ${video.title}`}
      >
        <Card className="bg-transparent border-0 shadow-none overflow-hidden">
          <CardContent className="p-0">
            {/* Video/Thumbnail Container */}
            <div
              className={cn(
                'relative aspect-video overflow-hidden rounded-xl border bg-black',
                'group-hover:ring-2 ring-primary/50 transition-all duration-200',
              )}
            >
              {/* Video Element - always mounted but hidden when not playing */}
              {video.videoUrl && !videoError && (
                <video
                  ref={videoRef}
                  src={video.videoUrl}
                  className={cn(
                    'absolute inset-0 w-full h-full object-contain',
                    'transition-opacity duration-300',
                    // Only show video when playing
                    isPlaying ? 'opacity-100' : 'opacity-0',
                  )}
                  muted={isMuted}
                  playsInline
                  preload="metadata"
                  crossOrigin="anonymous"
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onError={handleVideoError}
                />
              )}

              {/* Thumbnail Image - shown when video is not playing */}
              <Image
                src={thumbnailError ? '/placeholder.svg' : video.thumbnailUrl || '/placeholder.svg'}
                alt={video.title}
                fill
                sizes={IMAGE_SIZES.videoCard}
                priority={priority}
                placeholder="blur"
                blurDataURL={VIDEO_THUMBNAIL_BLUR_DATA_URL}
                className={cn(
                  'object-cover transition-all duration-300',
                  // Hide thumbnail when video is playing
                  isPlaying ? 'opacity-0' : 'opacity-100',
                  isHovered && !isPlaying && 'scale-105',
                )}
                onError={() => setThumbnailError(true)}
              />

              {/* Hover Overlay with Controls */}
              <div
                className={cn(
                  'absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40',
                  'transition-opacity duration-200',
                  isHovered ? 'opacity-100' : 'opacity-0',
                )}
              >
                {/* Top Right Controls */}
                <div className="absolute top-2 right-2 flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white hover:bg-white/20 bg-black/40"
                    onClick={handleExpand}
                    aria-label="Open in full screen"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Center Play/Pause Button */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-14 w-14 text-white hover:bg-white/20 rounded-full bg-black/40"
                    onClick={handleTogglePlay}
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 ml-1" />}
                  </Button>
                </div>

                {/* Bottom Controls */}
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white hover:bg-white/20 bg-black/40"
                    onClick={handleToggleMute}
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </Button>

                  {/* Time Display */}
                  {duration > 0 && (
                    <span className="text-white text-xs bg-black/60 px-2 py-1 rounded">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  )}
                </div>
              </div>

              {/* Duration badge (shown when not hovered) */}
              <div
                className={cn(
                  'absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded-md font-medium backdrop-blur-sm',
                  'transition-opacity duration-200',
                  isHovered ? 'opacity-0' : 'opacity-100',
                )}
              >
                {video.duration}
              </div>

              {/* Progress bar */}
              {(showProgress || isHovered) && playbackProgress > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30">
                  <div
                    className="h-full bg-primary transition-all duration-150"
                    style={{ width: `${Math.min(playbackProgress, 100)}%` }}
                  />
                </div>
              )}

              {/* New badge */}
              {isNew && (
                <Badge
                  variant="secondary"
                  className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] font-semibold"
                >
                  NEW
                </Badge>
              )}
            </div>

            {/* Content */}
            <div className="flex items-start gap-3 mt-3">
              <Avatar className="h-9 w-9 ring-2 ring-background">
                <AvatarImage src={video.author.image || '/placeholder.svg'} alt={video.author.name || 'Author'} />
                <AvatarFallback className="text-xs font-medium">
                  {video.author.name ? video.author.name.charAt(0).toUpperCase() : 'A'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium leading-tight text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                  {video.title}
                </h4>
                <p className="text-sm text-muted-foreground mt-1">{video.author.name}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  {video.createdAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatRelativeTime(video.createdAt)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
