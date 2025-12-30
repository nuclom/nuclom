# Video Accessibility Features

This document describes the accessibility features implemented for video content in the Nuclom platform.

## Overview

Nuclom provides comprehensive accessibility support for video content including:

- **WebVTT Subtitles** - Generated from transcripts for caption support
- **Multi-language Translation** - DeepL-powered translation for international users
- **Interactive Transcript Display** - Click-to-seek and current segment highlighting
- **Transcript Editing** - Allow users to correct auto-generated transcripts

## Architecture

### Subtitle Generation (`src/lib/subtitles.ts`)

The subtitle module provides utilities for generating WebVTT and SRT subtitle files from transcript segments.

```typescript
import { generateWebVTT, generateSRT, formatVTTTime } from "@/lib/subtitles";

// Generate WebVTT from transcript segments
const vtt = generateWebVTT(segments, {
  language: "en",
  wrapLines: true,
  maxLineLength: 42,
});

// Generate SRT for compatibility
const srt = generateSRT(segments);
```

Key functions:
- `generateWebVTT(segments, options)` - Generate WebVTT subtitle file content
- `generateSRT(segments)` - Generate SRT subtitle file content
- `formatVTTTime(seconds)` - Format time as VTT timestamp (HH:MM:SS.mmm)
- `findCurrentSegment(segments, time)` - Find segment at current playback time
- `mergeAdjacentSegments(segments)` - Merge close segments for smoother reading

### Translation Service (`src/lib/effect/services/translation.ts`)

The translation service provides multi-language translation using the DeepL API.

```typescript
import { Translation, translateTranscript } from "@/lib/effect";

// Translate transcript to Spanish
const effect = Effect.gen(function* () {
  const translated = yield* translateTranscript(segments, "es");
  return translated.segments;
});
```

Supported languages:
- English (en), Spanish (es), French (fr), German (de)
- Portuguese (pt), Italian (it), Dutch (nl), Polish (pl)
- Russian (ru), Japanese (ja), Chinese (zh), Korean (ko)
- And many more...

Configuration:
```env
DEEPL_API_KEY=your-deepl-api-key
```

## API Endpoints

### Subtitle Endpoints

#### GET `/api/videos/[id]/subtitles`

List available subtitle languages for a video.

**Response:**
```json
{
  "success": true,
  "data": {
    "videoId": "abc123",
    "hasTranscript": true,
    "processingStatus": "completed",
    "languages": [
      {
        "code": "en",
        "name": "English",
        "nativeName": "English",
        "isOriginal": true,
        "available": true,
        "url": "/api/videos/abc123/subtitles/en.vtt"
      }
    ]
  }
}
```

#### GET `/api/videos/[id]/subtitles/[lang].vtt`

Get WebVTT subtitle file for a specific language.

- `[lang]` - Language code (e.g., `en`, `es`, `fr`)
- Append `.srt` instead of `.vtt` for SRT format

**Response:** WebVTT file content

```
WEBVTT
Kind: captions
Language: en

1
00:00:00.000 --> 00:00:05.230
Welcome to this video tutorial.

2
00:00:05.230 --> 00:00:10.450
Today we'll be discussing...
```

### Transcript Endpoints

#### GET `/api/videos/[id]/transcript`

Get transcript data for a video.

#### PUT `/api/videos/[id]/transcript`

Update transcript segments (for corrections).

**Request body:**
```json
{
  "segments": [
    {
      "startTime": 0,
      "endTime": 5.23,
      "text": "Corrected transcript text"
    }
  ]
}
```

## Components

### TranscriptDisplay

Displays transcript with interactive features.

```tsx
import { TranscriptDisplay } from "@/components/video";

<TranscriptDisplay
  segments={transcriptSegments}
  currentTime={currentPlaybackTime}
  onSeek={(time) => videoRef.current.currentTime = time}
  autoScroll={true}
  processingStatus="completed"
/>
```

Features:
- Click segment to seek video
- Current segment highlighting
- Auto-scroll to current segment
- Search within transcript
- Add comment at timestamp

### TranscriptEditor

Allows users to edit and correct transcripts.

```tsx
import { TranscriptEditor } from "@/components/video";

<TranscriptEditor
  videoId={videoId}
  segments={transcriptSegments}
  onSave={async (segments) => {
    await saveTranscript(segments);
  }}
  showSaveButton={true}
/>
```

Features:
- Edit individual segments
- Split and merge segments
- Adjust timestamps
- Undo/redo support
- Keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z, Ctrl+S)

### VideoPlayer Captions

The video player automatically loads captions when a videoId is provided.

```tsx
import { VideoPlayerWithProgress } from "@/components/video";

<VideoPlayerWithProgress
  videoId={videoId}
  url={videoUrl}
  title="Video Title"
  duration="10:30"
/>
```

Caption features:
- Caption track selector in control bar
- Keyboard shortcut (C) to toggle captions
- Multi-language support (when translation is configured)
- Caption track synced with video playback

## Hooks

### useTranscript

Custom hook for managing transcript state.

```tsx
import { useTranscript } from "@/hooks/use-transcript";

const {
  segments,
  isLoading,
  isSaving,
  error,
  saveSegments,
  hasUnsavedChanges,
} = useTranscript({
  videoId: "abc123",
  autoFetch: true,
});
```

## Implementation Details

### Caption Track Loading

1. When `videoId` is provided to VideoPlayer, it fetches available tracks from `/api/videos/[id]/subtitles`
2. Available tracks are added as `<track>` elements with `crossOrigin="anonymous"`
3. User can select a track from the caption dropdown menu
4. Track mode is toggled between "showing" and "disabled"

### Transcript Sync

1. VideoPlayer calls `onTimeUpdate` with current playback time
2. TranscriptDisplay uses `findSegmentIndexByTime` to find active segment
3. Active segment is highlighted with primary color border
4. Auto-scroll brings active segment into view (with 3-second debounce)

### Translation Flow

1. User selects a non-English language from caption dropdown
2. API checks if translation service is configured
3. If configured, segments are sent to DeepL for batch translation
4. Translated segments are cached and returned as WebVTT

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| C | Toggle captions |
| R | Toggle loop |

## Environment Variables

```env
# DeepL API key for translation (optional)
# Free tier keys end with :fx
DEEPL_API_KEY=your-deepl-api-key
```

## Best Practices

1. **Always provide transcripts** - Use AI transcription for accessibility
2. **Allow corrections** - Users can improve auto-generated transcripts
3. **Support multiple languages** - Configure translation for international users
4. **Test with screen readers** - Ensure captions work with assistive technology

## Related Documentation

- [Video Processing](./video-processing.md)
- [Effect-TS Services](./effect-ts.md)
- [API Reference](../../public/api/videos.md)
