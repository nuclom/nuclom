'use client';

import { AlertCircle, Loader2, Play, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { VideoChapter } from '../types';

interface LoadingOverlayProps {
  visible: boolean;
}

export function LoadingOverlay({ visible }: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
      <Loader2 className="h-12 w-12 animate-spin text-white" />
    </div>
  );
}

interface ErrorOverlayProps {
  visible: boolean;
  message: string | null;
  onRetry: () => void;
}

export function ErrorOverlay({ visible, message, onRetry }: ErrorOverlayProps) {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white gap-3">
      <AlertCircle className="h-12 w-12 text-destructive" />
      <p className="text-sm">{message || 'Failed to load video'}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

interface PlayButtonOverlayProps {
  visible: boolean;
  onPlay: () => void;
}

export function PlayButtonOverlay({ visible, onPlay }: PlayButtonOverlayProps) {
  if (!visible) return null;

  return (
    <button
      type="button"
      className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/30 hover:bg-black/40 transition-colors"
      onClick={onPlay}
      aria-label="Play video"
    >
      <div className="p-4 rounded-full bg-white/20 backdrop-blur-sm">
        <Play className="h-12 w-12 text-white fill-white" />
      </div>
    </button>
  );
}

interface ChapterDisplayProps {
  chapter: VideoChapter | null;
  visible: boolean;
}

export function ChapterDisplay({ chapter, visible }: ChapterDisplayProps) {
  if (!chapter || !visible) return null;

  return (
    <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-md">
      <p className="text-white text-sm font-medium">{chapter.title}</p>
    </div>
  );
}

interface LoopIndicatorProps {
  isLooping: boolean;
}

export function LoopIndicator({ isLooping }: LoopIndicatorProps) {
  if (!isLooping) return null;

  return (
    <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-md">
      <Repeat className="h-4 w-4 text-white" />
    </div>
  );
}
