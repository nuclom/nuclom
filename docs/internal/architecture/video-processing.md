# Video Processing Architecture

This document describes the video processing pipeline in Nuclom, including upload, async processing, and metadata extraction.

## Overview

Videos in Nuclom go through a multi-stage processing pipeline:

1. **Upload** - Video file uploaded to Cloudflare R2
2. **Async Processing** - Background workflow processes the video
3. **Metadata Extraction** - Duration, resolution, codec, etc.
4. **Thumbnail Generation** - Multiple thumbnails at different timestamps
5. **Transcription** - Audio-to-text using Whisper
6. **AI Analysis** - Summary and insights generation

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────────┐
│   Upload    │────▶│   Storage   │────▶│   Video Record      │
│   (Client)  │     │   (R2)      │     │   (Database)        │
└─────────────┘     └─────────────┘     └─────────────────────┘
                                                    │
                                                    ▼
┌─────────────────────────────────────────────────────────────┐
│                 Workflow (Vercel Workflow DevKit)           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Metadata   │──│  Thumbnail  │──│ Transcribe  │──...    │
│  │  Extraction │  │  Generation │  │   (Whisper) │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   Database Update                           │
│  • Duration, resolution, codec                             │
│  • Thumbnail URLs                                          │
│  • Transcript text                                         │
│  • AI summary                                              │
│  • Processing status: completed                            │
└─────────────────────────────────────────────────────────────┘
```

## Services

### VideoProcessor

Located at `src/lib/effect/services/video-processor.ts`

Handles the initial video upload:

```typescript
interface VideoProcessorService {
  processVideo: (buffer, filename, organizationId, onProgress?) => Effect<ProcessingResult>;
  getVideoInfo: (buffer, filename) => Effect<VideoInfo>;
  validateVideo: (filename, fileSize) => Effect<void>;
  isSupportedVideoFormat: (filename) => boolean;
  getMaxFileSize: () => number;
}
```

**Key Features:**
- Validates video format and file size
- Uploads to R2 using multipart upload
- Estimates initial duration (refined later)
- Returns immediately - processing continues async

### ReplicateAPI

Located at `src/lib/effect/services/replicate.ts`

Provides AI-powered video processing:

```typescript
interface ReplicateService {
  transcribe: (videoUrl) => Effect<TranscriptionResult>;
  generateThumbnail: (videoUrl, timestamp) => Effect<ThumbnailResult>;
  generateThumbnails: (videoUrl, timestamps) => Effect<ThumbnailResult[]>;
  extractMetadata: (videoUrl, fileSize) => Effect<VideoMetadata>;
}
```

**Models Used:**
- `openai/whisper` - Audio transcription
- `fofr/video-to-gif` - Frame extraction for thumbnails

### Workflow

Located at `src/workflows/video-processing.ts`

Uses Vercel Workflow DevKit for durable processing:

```typescript
async function processVideoWorkflow(input: VideoProcessingInput): Promise<ProcessingResult> {
  "use workflow";

  // Step 1: Update status to processing
  await updateProcessingStatus(videoId, "processing", 10);

  // Step 2: Extract metadata
  const metadata = await extractVideoMetadata(videoUrl, fileSize);

  // Step 3: Generate thumbnails
  const thumbnails = await generateVideoThumbnails(videoUrl, metadata.duration);

  // Step 4: Transcribe video
  const transcription = await transcribeVideo(videoUrl);

  // Step 5: Generate AI summary
  const aiSummary = await generateAISummary(transcription.text, title);

  // Step 6: Update database
  await updateVideoRecord(videoId, { ... });

  return { videoId, status: "completed" };
}
```

## Processing Status

Videos track their processing status in the database:

| Status | Description |
|--------|-------------|
| `pending` | Queued for processing |
| `uploading` | File being uploaded |
| `processing` | General processing |
| `extracting_metadata` | Extracting video info |
| `generating_thumbnails` | Creating thumbnails |
| `transcribing` | Converting audio to text |
| `analyzing` | Generating AI summary |
| `completed` | Processing finished |
| `failed` | Processing error occurred |

## Database Schema

```sql
ALTER TABLE videos ADD COLUMN processing_status ProcessingStatus DEFAULT 'pending';
ALTER TABLE videos ADD COLUMN processing_progress INTEGER DEFAULT 0;
ALTER TABLE videos ADD COLUMN processing_error TEXT;
ALTER TABLE videos ADD COLUMN width INTEGER;
ALTER TABLE videos ADD COLUMN height INTEGER;
ALTER TABLE videos ADD COLUMN codec TEXT;
ALTER TABLE videos ADD COLUMN fps INTEGER;
ALTER TABLE videos ADD COLUMN bitrate INTEGER;
ALTER TABLE videos ADD COLUMN file_size INTEGER;
ALTER TABLE videos ADD COLUMN thumbnail_alternates TEXT;  -- JSON array
ALTER TABLE videos ADD COLUMN workflow_run_id TEXT;
ALTER TABLE videos ADD COLUMN processed_at TIMESTAMP;
```

## API Endpoints

### POST /api/videos/upload

Upload a video file. Returns immediately after upload.

**Request:**
```
Content-Type: multipart/form-data
- video: File
- title: string
- description?: string
- organizationId: string
- authorId: string
```

**Response:**
```json
{
  "success": true,
  "data": {
    "videoId": "uuid",
    "videoUrl": "https://...",
    "thumbnailUrl": "",
    "duration": "00:10:00",
    "processingStatus": "pending"
  }
}
```

### GET /api/videos/[id]/processing-status

Get current processing status.

**Response:**
```json
{
  "success": true,
  "data": {
    "videoId": "uuid",
    "processingStatus": "transcribing",
    "processingProgress": 60,
    "thumbnailUrl": "https://...",
    "duration": "00:10:00"
  }
}
```

### PATCH /api/videos/[id]/processing-status

Update processing status (called by workflow).

**Request:**
```json
{
  "status": "processing",
  "progress": 50,
  "error": null
}
```

### POST /api/videos/[id]/processing-complete

Complete processing with all results (called by workflow).

**Request:**
```json
{
  "duration": "00:10:00",
  "width": 1920,
  "height": 1080,
  "codec": "h264",
  "thumbnailUrl": "https://...",
  "transcript": "...",
  "aiSummary": "...",
  "processingStatus": "completed",
  "processingProgress": 100
}
```

## UI Components

### ProcessingStatus

Located at `src/components/video/processing-status.tsx`

Shows current processing status with appropriate icons and animations:

```tsx
<ProcessingStatus
  status={video.processingStatus}
  progress={video.processingProgress}
  showProgress={true}
  showDetails={true}
  onRetry={handleRetry}
/>
```

### ProcessingStatusBadge

Compact badge variant:

```tsx
<ProcessingStatusBadge status={video.processingStatus} />
```

### useProcessingStatus Hook

Polls for status updates:

```tsx
const { data, loading, error } = useProcessingStatus({
  videoId: video.id,
  enabled: video.processingStatus !== "completed",
  interval: 3000,
  onComplete: () => refetchVideo(),
});
```

## Configuration

### Environment Variables

```env
# Required
REPLICATE_API_TOKEN=r8_xxx...

# Optional (for AI summary)
XAI_API_KEY=xai_xxx...

# Next.js workflow
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Next.js Configuration

```typescript
// next.config.ts
import { withWorkflow } from "workflow/next";

export default withWorkflow(nextConfig);
```

## Error Handling

- **Step Retries**: Workflow steps automatically retry on failure
- **Fatal Errors**: Use `FatalError` to stop retrying
- **Status Updates**: Errors stored in `processingError` field
- **UI Feedback**: Retry button shown on failed status

## Performance Considerations

1. **Concurrent Processing**: Multiple steps run in parallel where possible
2. **Progress Updates**: Real-time progress updates via polling
3. **Large Files**: Multipart upload for files > 100MB
4. **Timeouts**: Workflow steps have built-in timeouts

## Future Improvements

1. **FFmpeg Integration**: Direct FFmpeg for metadata/thumbnails
2. **Video Transcoding**: Multiple quality levels
3. **HLS/DASH Streaming**: Adaptive bitrate streaming
4. **WebSocket Updates**: Replace polling with real-time updates
5. **Batch Processing**: Process multiple videos concurrently
