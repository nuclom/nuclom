# Videos API

The Videos API provides endpoints for managing video content, including CRUD operations, metadata management, comments, transcripts, and AI-powered processing.

> **Note**: For complete endpoint documentation including request/response schemas, see the [OpenAPI specification](/openapi.json) or the [Interactive API Reference](/docs/api/reference).

## Overview

Videos are the core content type in Nuclom. Each video belongs to an organization and can optionally be organized into channels and series.

## Key Features

- **Video Management**: Upload, update, and delete videos
- **AI Processing**: Automatic transcription, summarization, and action item extraction
- **Comments**: Timestamped comments with threading and reactions
- **Progress Tracking**: Track user viewing progress
- **Sharing**: Public/password-protected share links
- **Subtitles**: Multi-language subtitle support

## API Endpoints

The following endpoints are available. See the OpenAPI spec for full details.

### Video CRUD

| Endpoint | Description |
|----------|-------------|
| `GET /videos` | List videos with filtering and pagination |
| `POST /videos` | Create a new video |
| `GET /videos/{id}` | Get video details with comments |
| `PUT /videos/{id}` | Update video metadata |
| `DELETE /videos/{id}` | Soft-delete video (30-day retention) |
| `POST /videos/{id}/restore` | Restore soft-deleted video |

### Video Upload

| Endpoint | Description |
|----------|-------------|
| `POST /videos/upload` | Upload video file with metadata |
| `GET /videos/upload/presigned` | Get presigned URL for direct upload |
| `POST /videos/upload/confirm` | Confirm upload completion |

### Transcripts & Subtitles

| Endpoint | Description |
|----------|-------------|
| `GET /videos/{id}/transcript` | Get video transcript |
| `PUT /videos/{id}/transcript` | Update transcript segments |
| `GET /videos/{id}/subtitles` | List available subtitle languages |
| `GET /videos/{id}/subtitles/{lang}` | Get subtitle file (VTT/SRT) |

### Comments

| Endpoint | Description |
|----------|-------------|
| `GET /videos/{id}/comments` | List comments for a video |
| `POST /videos/{id}/comments` | Add a comment |
| `PATCH /comments/{id}` | Update a comment |
| `DELETE /comments/{id}` | Delete a comment |
| `POST /comments/{id}/reactions` | Add reaction to comment |

### Progress & Analytics

| Endpoint | Description |
|----------|-------------|
| `GET /videos/{id}/progress` | Get watch progress |
| `POST /videos/{id}/progress` | Update watch progress |
| `POST /videos/{id}/views` | Track video view |

## Data Models

### Video

```typescript
interface Video {
  id: string;              // UUID
  title: string;
  description?: string;
  duration: string;        // ISO 8601 duration or "HH:MM:SS"
  thumbnailUrl?: string;
  videoUrl?: string;
  authorId: string;
  organizationId: string;
  channelId?: string;
  collectionId?: string;
  transcript?: string;
  aiSummary?: string;
  viewCount: number;
  isPublic: boolean;
  isDeleted: boolean;
  deletedAt?: string;
  retentionUntil?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Comment

```typescript
interface Comment {
  id: string;
  content: string;
  timestamp?: string;      // Video timestamp "HH:MM:SS"
  authorId: string;
  videoId: string;
  parentId?: string;       // For threaded replies
  author?: User;
  replies?: Comment[];
  reactions?: Reaction[];
  createdAt: string;
  updatedAt: string;
}
```

### Transcript Segment

```typescript
interface TranscriptSegment {
  startTime: number;       // Seconds
  endTime: number;
  text: string;
  confidence?: number;     // 0-1
}
```

## Video Processing Pipeline

When a video is uploaded, it goes through these processing stages:

1. **Upload**: Video file stored in R2
2. **Thumbnail Generation**: Extract preview thumbnails
3. **Transcription**: Audio-to-text using OpenAI Whisper
4. **AI Analysis**: Generate summary, action items, chapters
5. **Embeddings**: Generate vector embeddings for semantic search

Processing status can be tracked via the `processingStatus` field.

## Soft Delete & Retention

Videos are soft-deleted by default with a 30-day retention period:

```typescript
// Soft delete (default)
DELETE /api/videos/{id}

// Permanent delete
DELETE /api/videos/{id}?permanent=true

// Custom retention period
DELETE /api/videos/{id}?retentionDays=7
```

Soft-deleted videos can be restored during the retention period.

## Permissions

| Action | Required Permission |
|--------|---------------------|
| View video | Organization member |
| Create video | Organization member |
| Update video | Video author or organization owner |
| Delete video | Video author or organization owner |
| Comment | Organization member |

## Error Codes

| Code | Description |
|------|-------------|
| `NOT_FOUND_VIDEO` | Video not found |
| `VIDEO_UNSUPPORTED_FORMAT` | Unsupported video format |
| `VIDEO_FILE_TOO_LARGE` | File exceeds size limit |
| `VIDEO_PROCESSING_FAILED` | Processing failed |

## Supported Formats

**Video formats**: MP4, MOV, AVI, MKV, WebM

**Subtitle formats**: VTT, SRT

**Subtitle languages**: en, es, fr, de, pt, it, nl, pl, ru, ja, zh, ko, ar, tr, sv, da, fi, nb, el, cs, ro, hu, uk, id, vi, th

## Usage Examples

### JavaScript/TypeScript

```typescript
// List videos
const response = await fetch("/api/videos?organizationId=org_123", {
  headers: { "Authorization": `Bearer ${token}` }
});
const { data } = await response.json();

// Upload video
const formData = new FormData();
formData.append("file", videoFile);
formData.append("title", "Meeting Recording");
formData.append("organizationId", "org_123");

await fetch("/api/videos/upload", {
  method: "POST",
  headers: { "Authorization": `Bearer ${token}` },
  body: formData
});

// Add timestamped comment
await fetch(`/api/videos/${videoId}/comments`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    content: "Great point here!",
    timestamp: "00:15:30"
  })
});
```
