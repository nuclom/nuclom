'use client';

import {
  Captions,
  CaptionsOff,
  Keyboard,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  Repeat,
  Settings,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { type CaptionTrack, KEYBOARD_SHORTCUTS, PLAYBACK_RATES, SKIP_SECONDS, type VideoChapter } from '../types';
import { formatTime } from '../utils';

interface VideoControlsProps {
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
  isFullscreen: boolean;
  isPiP: boolean;
  pipSupported: boolean;
  isLooping: boolean;
  chapters: VideoChapter[];
  currentChapter: VideoChapter | null;
  captionsEnabled: boolean;
  selectedCaptionTrack: string | null;
  availableCaptionTracks: CaptionTrack[];
  onTogglePlay: () => void;
  onSeekForward: () => void;
  onSeekBackward: () => void;
  onSeekToChapter: (chapter: VideoChapter) => void;
  onVolumeChange: (value: number[]) => void;
  onToggleMute: () => void;
  onPlaybackRateChange: (rate: number) => void;
  onToggleFullscreen: () => void;
  onTogglePiP: () => void;
  onToggleLoop: () => void;
  onSelectCaptionTrack: (trackCode: string | null) => void;
  onShowKeyboardHelp: () => void;
}

export function VideoControls({
  playing,
  currentTime,
  duration,
  volume,
  muted,
  playbackRate,
  isFullscreen,
  isPiP,
  pipSupported,
  isLooping,
  chapters,
  currentChapter,
  captionsEnabled,
  selectedCaptionTrack,
  availableCaptionTracks,
  onTogglePlay,
  onSeekForward,
  onSeekBackward,
  onSeekToChapter,
  onVolumeChange,
  onToggleMute,
  onPlaybackRateChange,
  onToggleFullscreen,
  onTogglePiP,
  onToggleLoop,
  onSelectCaptionTrack,
  onShowKeyboardHelp,
}: VideoControlsProps) {
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className="flex items-center justify-between gap-2">
      {/* Left Controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onTogglePlay}
          className="text-white hover:bg-white/20"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onSeekBackward}
          className="text-white hover:bg-white/20"
          aria-label={`Skip back ${SKIP_SECONDS} seconds`}
        >
          <SkipBack className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onSeekForward}
          className="text-white hover:bg-white/20"
          aria-label={`Skip forward ${SKIP_SECONDS} seconds`}
        >
          <SkipForward className="h-4 w-4" />
        </Button>

        {/* Volume Control */}
        <div className="flex items-center gap-1 group/volume">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleMute}
            className="text-white hover:bg-white/20"
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            <VolumeIcon className="h-4 w-4" />
          </Button>
          <div className="w-0 overflow-hidden group-hover/volume:w-20 transition-all duration-200">
            <div className="relative h-1.5 bg-white/30 rounded-full">
              <div
                className="absolute top-0 left-0 h-full bg-white rounded-full"
                style={{ width: `${(muted ? 0 : volume) * 100}%` }}
              />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={muted ? 0 : volume}
                onChange={(e) => onVolumeChange([Number.parseFloat(e.target.value)])}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                aria-label="Volume"
              />
            </div>
          </div>
        </div>

        {/* Time Display */}
        <span className="text-white text-sm ml-2 font-mono">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1">
        {/* Loop Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleLoop}
          className={cn('text-white hover:bg-white/20', isLooping && 'bg-white/20')}
          aria-label={isLooping ? 'Disable loop' : 'Enable loop'}
          title="Toggle loop (R)"
        >
          <Repeat className="h-4 w-4" />
        </Button>

        {/* Settings Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 text-xs px-2">
              <Settings className="h-4 w-4 mr-1" />
              {playbackRate}x
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Playback Speed</DropdownMenuLabel>
            {PLAYBACK_RATES.map((rate) => (
              <DropdownMenuItem
                key={rate}
                onClick={() => onPlaybackRateChange(rate)}
                className={cn(rate === playbackRate && 'bg-accent')}
              >
                {rate}x
              </DropdownMenuItem>
            ))}
            {chapters.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Chapters</DropdownMenuLabel>
                {chapters.map((chapter) => (
                  <DropdownMenuItem
                    key={chapter.id}
                    onClick={() => onSeekToChapter(chapter)}
                    className={cn(currentChapter?.id === chapter.id && 'bg-accent')}
                  >
                    <span className="flex-1 truncate">{chapter.title}</span>
                    <span className="text-xs text-muted-foreground ml-2">{formatTime(chapter.startTime)}</span>
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Keyboard Shortcuts Help */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (?)"
            >
              <Keyboard className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64">
            <h4 className="font-medium mb-2">Keyboard Shortcuts</h4>
            <div className="space-y-1 text-sm">
              {KEYBOARD_SHORTCUTS.slice(0, 6).map((shortcut) => (
                <div key={shortcut.key} className="flex justify-between">
                  <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">{shortcut.key}</kbd>
                  <span className="text-muted-foreground text-xs">{shortcut.action}</span>
                </div>
              ))}
            </div>
            <Button variant="link" size="sm" className="w-full mt-2 text-xs" onClick={onShowKeyboardHelp}>
              View all shortcuts
            </Button>
          </PopoverContent>
        </Popover>

        {/* Captions */}
        {availableCaptionTracks.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn('text-white hover:bg-white/20', captionsEnabled && 'bg-white/20')}
                aria-label={captionsEnabled ? 'Captions on' : 'Captions off'}
                title="Captions (C)"
              >
                {captionsEnabled ? <Captions className="h-4 w-4" /> : <CaptionsOff className="h-4 w-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Subtitles</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onSelectCaptionTrack(null)}
                className={cn(!captionsEnabled && 'bg-accent')}
              >
                Off
              </DropdownMenuItem>
              {availableCaptionTracks.map((track) => (
                <DropdownMenuItem
                  key={track.code}
                  onClick={() => onSelectCaptionTrack(track.code)}
                  className={cn(captionsEnabled && selectedCaptionTrack === track.code && 'bg-accent')}
                >
                  {track.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Picture-in-Picture */}
        {pipSupported && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onTogglePiP}
            className={cn('text-white hover:bg-white/20', isPiP && 'bg-white/20')}
            aria-label={isPiP ? 'Exit Picture-in-Picture' : 'Enter Picture-in-Picture'}
            title="Picture-in-Picture (P)"
          >
            <PictureInPicture2 className="h-4 w-4" />
          </Button>
        )}

        {/* Fullscreen */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleFullscreen}
          className="text-white hover:bg-white/20"
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          title="Fullscreen (F)"
        >
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
