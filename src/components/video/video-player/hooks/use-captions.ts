"use client";

import { useCallback, useEffect, useState } from "react";
import { clientLogger } from "@/lib/client-logger";
import type { CaptionTrack } from "../types";

interface UseCaptionsOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoId?: string;
  customCaptionTracks?: CaptionTrack[];
}

export function useCaptions({ videoRef, videoId, customCaptionTracks }: UseCaptionsOptions) {
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [selectedCaptionTrack, setSelectedCaptionTrack] = useState<string | null>(null);
  const [availableCaptionTracks, setAvailableCaptionTracks] = useState<CaptionTrack[]>([]);

  // Load caption tracks from API or use custom tracks
  useEffect(() => {
    if (customCaptionTracks && customCaptionTracks.length > 0) {
      setAvailableCaptionTracks(customCaptionTracks);
      const defaultTrack = customCaptionTracks.find((t) => t.default);
      if (defaultTrack) {
        setSelectedCaptionTrack(defaultTrack.code);
      }
    } else if (videoId) {
      fetch(`/api/videos/${videoId}/subtitles`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data?.languages) {
            const tracks: CaptionTrack[] = data.data.languages
              .filter((lang: { available: boolean }) => lang.available)
              .map((lang: { code: string; name: string; isOriginal: boolean; url: string }) => ({
                code: lang.code,
                label: lang.name,
                src: lang.url,
                default: lang.isOriginal,
              }));
            setAvailableCaptionTracks(tracks);
          }
        })
        .catch((err) => {
          clientLogger.error("Failed to load caption tracks", err);
        });
    }
  }, [videoId, customCaptionTracks]);

  const toggleCaptions = useCallback(() => {
    const video = videoRef.current;
    if (!video || availableCaptionTracks.length === 0) return;

    if (captionsEnabled) {
      Array.from(video.textTracks).forEach((track) => {
        track.mode = "disabled";
      });
      setCaptionsEnabled(false);
    } else {
      const trackToEnable = selectedCaptionTrack || availableCaptionTracks[0]?.code;
      if (trackToEnable) {
        setSelectedCaptionTrack(trackToEnable);
        Array.from(video.textTracks).forEach((track) => {
          if (track.language === trackToEnable) {
            track.mode = "showing";
          } else {
            track.mode = "disabled";
          }
        });
        setCaptionsEnabled(true);
      }
    }
  }, [captionsEnabled, selectedCaptionTrack, availableCaptionTracks, videoRef]);

  const selectCaptionTrack = useCallback(
    (trackCode: string | null) => {
      const video = videoRef.current;
      if (!video) return;

      if (trackCode === null) {
        Array.from(video.textTracks).forEach((track) => {
          track.mode = "disabled";
        });
        setCaptionsEnabled(false);
        setSelectedCaptionTrack(null);
      } else {
        setSelectedCaptionTrack(trackCode);
        setCaptionsEnabled(true);
        Array.from(video.textTracks).forEach((track) => {
          if (track.language === trackCode) {
            track.mode = "showing";
          } else {
            track.mode = "disabled";
          }
        });
      }
    },
    [videoRef],
  );

  return {
    captionsEnabled,
    selectedCaptionTrack,
    availableCaptionTracks,
    toggleCaptions,
    selectCaptionTrack,
  };
}
