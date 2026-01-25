'use client';

import { cn } from '@nuclom/lib/utils';
import { Button } from '@nuclom/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@nuclom/ui/dropdown-menu';
import {
  Captions,
  CaptionsOff,
  Check,
  FastForward,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  Repeat,
  Rewind,
  Settings,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { type CaptionTrack, PLAYBACK_RATES, SKIP_SECONDS } from '../types';
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
  captionsEnabled: boolean;
  selectedCaptionTrack: string | null;
  availableCaptionTracks: CaptionTrack[];
  onTogglePlay: () => void;
  onSeekForward: () => void;
  onSeekBackward: () => void;
  onVolumeChange: (value: number[]) => void;
  onToggleMute: () => void;
  onPlaybackRateChange: (rate: number) => void;
  onToggleFullscreen: () => void;
  onTogglePiP: () => void;
  onToggleLoop: () => void;
  onSelectCaptionTrack: (trackCode: string | null) => void;
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
  captionsEnabled,
  selectedCaptionTrack,
  availableCaptionTracks,
  onTogglePlay,
  onSeekForward,
  onSeekBackward,
  onVolumeChange,
  onToggleMute,
  onPlaybackRateChange,
  onToggleFullscreen,
  onTogglePiP,
  onToggleLoop,
  onSelectCaptionTrack,
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
          <Rewind className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onSeekForward}
          className="text-white hover:bg-white/20"
          aria-label={`Skip forward ${SKIP_SECONDS} seconds`}
        >
          <FastForward className="h-4 w-4" />
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
        {/* Settings Menu - Contains most options */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" aria-label="Settings">
              <Settings className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {/* Playback Speed */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <span className="flex-1">Playback speed</span>
                <span className="text-xs text-muted-foreground">{playbackRate}x</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  {PLAYBACK_RATES.map((rate) => (
                    <DropdownMenuItem key={rate} onClick={() => onPlaybackRateChange(rate)}>
                      {rate === playbackRate && <Check className="h-4 w-4 mr-2" />}
                      <span className={cn(rate !== playbackRate && 'ml-6')}>{rate}x</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            {/* Captions */}
            {availableCaptionTracks.length > 0 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  {captionsEnabled ? <Captions className="h-4 w-4 mr-2" /> : <CaptionsOff className="h-4 w-4 mr-2" />}
                  <span className="flex-1">Captions</span>
                  <span className="text-xs text-muted-foreground">
                    {captionsEnabled
                      ? availableCaptionTracks.find((t) => t.code === selectedCaptionTrack)?.label || 'On'
                      : 'Off'}
                  </span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => onSelectCaptionTrack(null)}>
                      {!captionsEnabled && <Check className="h-4 w-4 mr-2" />}
                      <span className={cn(captionsEnabled && 'ml-6')}>Off</span>
                    </DropdownMenuItem>
                    {availableCaptionTracks.map((track) => (
                      <DropdownMenuItem key={track.code} onClick={() => onSelectCaptionTrack(track.code)}>
                        {captionsEnabled && selectedCaptionTrack === track.code && <Check className="h-4 w-4 mr-2" />}
                        <span className={cn(!(captionsEnabled && selectedCaptionTrack === track.code) && 'ml-6')}>
                          {track.label}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            )}

            <DropdownMenuSeparator />

            {/* Loop */}
            <DropdownMenuItem onClick={onToggleLoop}>
              <Repeat className={cn('h-4 w-4 mr-2', isLooping && 'text-primary')} />
              <span className="flex-1">Loop</span>
              {isLooping && <Check className="h-4 w-4 ml-2" />}
            </DropdownMenuItem>

            {/* Picture-in-Picture */}
            {pipSupported && (
              <DropdownMenuItem onClick={onTogglePiP}>
                <PictureInPicture2 className={cn('h-4 w-4 mr-2', isPiP && 'text-primary')} />
                <span className="flex-1">Picture-in-picture</span>
                {isPiP && <Check className="h-4 w-4 ml-2" />}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Fullscreen - Keep visible for quick access */}
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
