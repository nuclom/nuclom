# Videos API

The Videos API provides endpoints for managing video content, including CRUD operations, metadata management, comments, and progress tracking.

## Endpoints

### List Videos

Retrieve a paginated list of videos with optional filtering.

```http
GET /api/videos
```

**Query Parameters:**

- `organizationId` (string, optional): Filter by organization ID
- `channelId` (string, optional): Filter by channel ID
- `seriesId` (string, optional): Filter by series ID
- `page` (integer, optional): Page number (default: 1)
- `limit` (integer, optional): Items per page (default: 20, max: 100)

**Example Request:**

```http
GET /api/videos?organizationId=ws_123&page=1&limit=10
```

**Response:**

```json
{
  "success": true,
  "data": {
    "videos": [
      {
        "id": "video_123",
        "title": "Team Meeting - Q1 Planning",
        "description": "Quarterly planning session with the development team",
        "duration": "00:45:30",
        "thumbnailUrl": "https://example.com/thumbnail.jpg",
        "videoUrl": "https://example.com/video.mp4",
        "authorId": "user_456",
        "organizationId": "ws_123",
        "channelId": "ch_789",
        "seriesId": "series_012",
        "transcript": "Meeting transcript...",
        "aiSummary": "Key points discussed...",
        "createdAt": "2024-01-01T10:00:00Z",
        "updatedAt": "2024-01-01T10:00:00Z",
        "author": {
          "id": "user_456",
          "name": "John Doe",
          "email": "john@example.com",
          "avatarUrl": "https://example.com/avatar.jpg"
        },
        "organization": {
          "id": "ws_123",
          "name": "Development Team",
          "slug": "dev-team"
        },
        "channel": {
          "id": "ch_789",
          "name": "Meetings",
          "description": "Team meetings and discussions"
        },
        "series": {
          "id": "series_012",
          "name": "Q1 Planning",
          "description": "Quarterly planning sessions"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3
    }
  }
}
```

### Get Video

Retrieve a specific video with full details including comments.

```http
GET /api/videos/{id}
```

**Path Parameters:**

- `id` (string, required): Video ID

**Example Request:**

```http
GET /api/videos/video_123
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "video_123",
    "title": "Team Meeting - Q1 Planning",
    "description": "Quarterly planning session with the development team",
    "duration": "00:45:30",
    "thumbnailUrl": "https://example.com/thumbnail.jpg",
    "videoUrl": "https://example.com/video.mp4",
    "authorId": "user_456",
    "organizationId": "ws_123",
    "channelId": "ch_789",
    "seriesId": "series_012",
    "transcript": "Meeting transcript...",
    "aiSummary": "Key points discussed...",
    "createdAt": "2024-01-01T10:00:00Z",
    "updatedAt": "2024-01-01T10:00:00Z",
    "author": {
      "id": "user_456",
      "name": "John Doe",
      "email": "john@example.com",
      "avatarUrl": "https://example.com/avatar.jpg"
    },
    "organization": {
      "id": "ws_123",
      "name": "Development Team",
      "slug": "dev-team"
    },
    "channel": {
      "id": "ch_789",
      "name": "Meetings",
      "description": "Team meetings and discussions"
    },
    "series": {
      "id": "series_012",
      "name": "Q1 Planning",
      "description": "Quarterly planning sessions"
    },
    "comments": [
      {
        "id": "comment_123",
        "content": "Great discussion on the new features",
        "timestamp": "00:15:30",
        "authorId": "user_789",
        "videoId": "video_123",
        "parentId": null,
        "createdAt": "2024-01-01T11:00:00Z",
        "updatedAt": "2024-01-01T11:00:00Z",
        "author": {
          "id": "user_789",
          "name": "Jane Smith",
          "email": "jane@example.com",
          "avatarUrl": "https://example.com/avatar2.jpg"
        },
        "replies": []
      }
    ]
  }
}
```

### Create Video

Create a new video in a organization.

```http
POST /api/videos
Content-Type: application/json
```

**Request Body:**

```json
{
  "title": "Team Meeting - Q1 Planning",
  "description": "Quarterly planning session with the development team",
  "duration": "00:45:30",
  "thumbnailUrl": "https://example.com/thumbnail.jpg",
  "videoUrl": "https://example.com/video.mp4",
  "authorId": "user_456",
  "organizationId": "ws_123",
  "channelId": "ch_789",
  "seriesId": "series_012"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "video_123",
    "title": "Team Meeting - Q1 Planning",
    "description": "Quarterly planning session with the development team",
    "duration": "00:45:30",
    "thumbnailUrl": "https://example.com/thumbnail.jpg",
    "videoUrl": "https://example.com/video.mp4",
    "authorId": "user_456",
    "organizationId": "ws_123",
    "channelId": "ch_789",
    "seriesId": "series_012",
    "transcript": null,
    "aiSummary": null,
    "createdAt": "2024-01-01T10:00:00Z",
    "updatedAt": "2024-01-01T10:00:00Z",
    "author": {
      "id": "user_456",
      "name": "John Doe",
      "email": "john@example.com",
      "avatarUrl": "https://example.com/avatar.jpg"
    },
    "organization": {
      "id": "ws_123",
      "name": "Development Team",
      "slug": "dev-team"
    },
    "channel": {
      "id": "ch_789",
      "name": "Meetings",
      "description": "Team meetings and discussions"
    },
    "series": {
      "id": "series_012",
      "name": "Q1 Planning",
      "description": "Quarterly planning sessions"
    }
  }
}
```

### Update Video

Update an existing video's metadata.

```http
PUT /api/videos/{id}
Content-Type: application/json
```

**Path Parameters:**

- `id` (string, required): Video ID

**Request Body:**

```json
{
  "title": "Updated Team Meeting - Q1 Planning",
  "description": "Updated quarterly planning session with the development team",
  "channelId": "ch_456",
  "seriesId": "series_789"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "video_123",
    "title": "Updated Team Meeting - Q1 Planning",
    "description": "Updated quarterly planning session with the development team",
    "duration": "00:45:30",
    "thumbnailUrl": "https://example.com/thumbnail.jpg",
    "videoUrl": "https://example.com/video.mp4",
    "authorId": "user_456",
    "organizationId": "ws_123",
    "channelId": "ch_456",
    "seriesId": "series_789",
    "transcript": null,
    "aiSummary": null,
    "createdAt": "2024-01-01T10:00:00Z",
    "updatedAt": "2024-01-01T12:00:00Z",
    "author": {
      "id": "user_456",
      "name": "John Doe",
      "email": "john@example.com",
      "avatarUrl": "https://example.com/avatar.jpg"
    },
    "organization": {
      "id": "ws_123",
      "name": "Development Team",
      "slug": "dev-team"
    },
    "channel": {
      "id": "ch_456",
      "name": "Announcements",
      "description": "Team announcements"
    },
    "series": {
      "id": "series_789",
      "name": "Q2 Planning",
      "description": "Second quarter planning sessions"
    }
  }
}
```

### Delete Video

Delete a video from the organization.

```http
DELETE /api/videos/{id}
```

**Path Parameters:**

- `id` (string, required): Video ID

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Video deleted successfully"
  }
}
```

## Data Models

### Video

```typescript
interface Video {
  id: string;
  title: string;
  description?: string;
  duration: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  authorId: string;
  organizationId: string;
  channelId?: string;
  seriesId?: string;
  transcript?: string;
  aiSummary?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Video with Details

```typescript
interface VideoWithDetails extends Video {
  author: User;
  organization: Organization;
  channel?: Channel;
  series?: Series;
  comments: CommentWithReplies[];
}
```

### Comment

```typescript
interface Comment {
  id: string;
  content: string;
  timestamp?: string;
  authorId: string;
  videoId: string;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Comment with Replies

```typescript
interface CommentWithReplies extends Comment {
  author: User;
  replies: CommentWithReplies[];
}
```

## Error Responses

### Video Not Found

```json
{
  "success": false,
  "error": "Video not found"
}
```

### Invalid Request

```json
{
  "success": false,
  "error": "Title is required"
}
```

### Server Error

```json
{
  "success": false,
  "error": "Failed to create video"
}
```

## Authentication

All video endpoints require authentication. Include the session cookie or authorization header:

```http
Authorization: Bearer <session_token>
```

## Permissions

- **Create Video**: User must be a member of the organization
- **Update Video**: User must be the video author or organization admin
- **Delete Video**: User must be the video author or organization admin
- **View Video**: User must have access to the organization

## Video Upload

For video file uploads, use a separate upload endpoint with multipart/form-data:

```http
POST /api/videos/upload
Content-Type: multipart/form-data

{
  "file": <video_file>,
  "organizationId": "ws_123",
  "title": "Meeting Recording",
  "description": "Team meeting from today"
}
```

## Video Processing

Videos undergo processing after upload:

1. **Thumbnail Generation**: Automatic thumbnail extraction
2. **Transcription**: Audio-to-text conversion
3. **AI Analysis**: Summary and insights generation
4. **Encoding**: Multiple quality formats

## Video Progress Tracking

Track user viewing progress:

```http
POST /api/videos/{id}/progress
Content-Type: application/json

{
  "currentTime": "00:15:30",
  "completed": false
}
```

## Comments API

### Add Comment

```http
POST /api/videos/{id}/comments
Content-Type: application/json

{
  "content": "Great discussion on the new features",
  "timestamp": "00:15:30",
  "parentId": null
}
```

### Reply to Comment

```http
POST /api/videos/{id}/comments
Content-Type: application/json

{
  "content": "I agree with your point",
  "parentId": "comment_123"
}
```

### Update Comment

```http
PUT /api/videos/{id}/comments/{commentId}
Content-Type: application/json

{
  "content": "Updated comment content"
}
```

### Delete Comment

```http
DELETE /api/videos/{id}/comments/{commentId}
```

## Search and Filtering

### Search Videos

```http
GET /api/videos/search?q=meeting&organizationId=ws_123
```

### Filter by Tags

```http
GET /api/videos?tags=meeting,planning&organizationId=ws_123
```

### Filter by Date Range

```http
GET /api/videos?startDate=2024-01-01&endDate=2024-01-31&organizationId=ws_123
```

## Analytics

### Video Statistics

```http
GET /api/videos/{id}/stats
```

**Response:**

```json
{
  "success": true,
  "data": {
    "views": 42,
    "uniqueViewers": 15,
    "averageWatchTime": "00:22:15",
    "comments": 8,
    "likes": 12,
    "shares": 3
  }
}
```

## Webhooks

Subscribe to video events:

- `video.created`: New video uploaded
- `video.updated`: Video metadata changed
- `video.deleted`: Video removed
- `video.processed`: Video processing completed
- `comment.created`: New comment added

## Subtitles and Transcripts

### List Subtitle Languages

Get available subtitle languages for a video.

```http
GET /api/videos/{id}/subtitles
```

**Response:**

```json
{
  "success": true,
  "data": {
    "videoId": "video_123",
    "hasTranscript": true,
    "processingStatus": "completed",
    "languages": [
      {
        "code": "en",
        "name": "English",
        "nativeName": "English",
        "isOriginal": true,
        "available": true,
        "url": "/api/videos/video_123/subtitles/en.vtt"
      },
      {
        "code": "es",
        "name": "Spanish",
        "nativeName": "Español",
        "isOriginal": false,
        "available": true,
        "url": "/api/videos/video_123/subtitles/es.vtt"
      }
    ]
  }
}
```

### Get Subtitle File

Get WebVTT or SRT subtitle file for a specific language.

```http
GET /api/videos/{id}/subtitles/{lang}.vtt
GET /api/videos/{id}/subtitles/{lang}.srt
```

**Path Parameters:**

- `id` (string, required): Video ID
- `lang` (string, required): Language code (e.g., `en`, `es`, `fr`)

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
Today we'll be discussing the new features.
```

**Supported Languages:**

English (en), Spanish (es), French (fr), German (de), Portuguese (pt), Italian (it), Dutch (nl), Polish (pl), Russian (ru), Japanese (ja), Chinese (zh), Korean (ko), Arabic (ar), Turkish (tr), Swedish (sv), Danish (da), Finnish (fi), Norwegian (nb), Greek (el), Czech (cs), Romanian (ro), Hungarian (hu), Ukrainian (uk), Indonesian (id), Vietnamese (vi), Thai (th)

### Get Transcript

Get transcript data for a video.

```http
GET /api/videos/{id}/transcript
```

**Response:**

```json
{
  "success": true,
  "data": {
    "videoId": "video_123",
    "title": "Team Meeting",
    "transcript": "Full transcript text...",
    "segments": [
      {
        "startTime": 0,
        "endTime": 5.23,
        "text": "Welcome to this video tutorial.",
        "confidence": 0.95
      },
      {
        "startTime": 5.23,
        "endTime": 10.45,
        "text": "Today we'll be discussing the new features.",
        "confidence": 0.92
      }
    ],
    "processingStatus": "completed"
  }
}
```

### Update Transcript

Update transcript segments (for corrections).

```http
PUT /api/videos/{id}/transcript
Content-Type: application/json
```

**Request Body:**

```json
{
  "segments": [
    {
      "startTime": 0,
      "endTime": 5.23,
      "text": "Corrected transcript text.",
      "confidence": 1.0
    }
  ]
}
```

**Validation Rules:**

- Segments must be in chronological order
- Start time must be before end time
- Text cannot be empty

**Response:**

```json
{
  "success": true,
  "data": {
    "videoId": "video_123",
    "segments": [...],
    "message": "Transcript updated successfully"
  }
}
```

## Rate Limits

- **Video Upload**: 10 uploads per hour per user
- **API Requests**: 100 requests per minute per user
- **Comment Creation**: 30 comments per minute per user
- **Translation Requests**: 100 per hour (requires DeepL API key)

## Examples

### JavaScript/TypeScript

```typescript
// Fetch videos
const response = await fetch("/api/videos?organizationId=ws_123");
const { data } = await response.json();

// Create video
const newVideo = await fetch("/api/videos", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: "Team Meeting",
    duration: "00:45:30",
    organizationId: "ws_123",
    authorId: "user_456",
  }),
});
```

### React Hook

```typescript
import { useVideos } from "@/hooks/useVideos";

function VideoList({ organizationId }: { organizationId: string }) {
  const { videos, loading, error } = useVideos({ organizationId });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  );
}
```
