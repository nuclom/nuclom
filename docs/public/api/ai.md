# AI Video Processing API

The AI Services API provides intelligent analysis and processing capabilities for video content, including automatic transcription, summarization, code snippet detection, and chapter generation.

## Overview

Nuclom's AI integration leverages OpenAI Whisper for transcription and XAI Grok-3 for analysis to provide:
- Automatic video transcription with timestamps
- AI-powered video summarization
- Action item extraction with priority levels
- Code snippet detection and formatting
- Chapter/key moment generation
- Intelligent tagging

## Video AI Processing Pipeline

When a video is uploaded, it goes through the following AI processing stages:

1. **Pending** - Video uploaded, waiting for processing
2. **Transcribing** - Audio is being transcribed using OpenAI Whisper
3. **Analyzing** - AI is generating summary, action items, tags, chapters, and code snippets
4. **Completed** - All AI processing finished successfully
5. **Failed** - Processing failed (error details available)

## Endpoints

### Trigger AI Processing

Manually trigger AI processing for a video.

```http
POST /api/videos/{videoId}/process
Authorization: Bearer <session_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Video processing completed",
    "status": "completed",
    "summary": "AI-generated summary of the video content...",
    "tags": ["meeting", "planning", "Q1"],
    "actionItems": [
      {
        "text": "Complete user authentication implementation",
        "timestamp": 120,
        "priority": "high"
      }
    ],
    "chapters": 5,
    "codeSnippets": 2
  }
}
```

### Get Processing Status

Check the current AI processing status of a video.

```http
GET /api/videos/{videoId}/process
```

**Response:**
```json
{
  "success": true,
  "data": {
    "videoId": "video_123",
    "status": "completed",
    "error": null,
    "hasTranscript": true,
    "hasSummary": true,
    "tags": ["meeting", "planning", "Q1"],
    "actionItems": [
      {
        "text": "Complete user authentication implementation",
        "timestamp": 120,
        "priority": "high"
      }
    ]
  }
}
```

### Get Video Chapters

Retrieve AI-generated chapters for a video.

```http
GET /api/videos/{videoId}/chapters
```

**Response:**
```json
{
  "success": true,
  "data": {
    "videoId": "video_123",
    "chapters": [
      {
        "id": "chapter_1",
        "title": "Introduction",
        "summary": "Overview of the meeting agenda",
        "startTime": 0,
        "endTime": 120
      },
      {
        "id": "chapter_2",
        "title": "Q1 Planning Discussion",
        "summary": "Team discusses priorities for Q1",
        "startTime": 120,
        "endTime": 480
      }
    ],
    "count": 2
  }
}
```

### Get Code Snippets

Retrieve AI-detected code snippets from video content.

```http
GET /api/videos/{videoId}/code-snippets
```

**Response:**
```json
{
  "success": true,
  "data": {
    "videoId": "video_123",
    "codeSnippets": [
      {
        "id": "snippet_1",
        "language": "javascript",
        "code": "const user = await auth.getUser();",
        "title": "User Authentication",
        "description": "Getting the authenticated user",
        "timestamp": 245
      },
      {
        "id": "snippet_2",
        "language": "bash",
        "code": "npm install @effect/platform",
        "title": "Package Installation",
        "description": "Installing Effect platform package",
        "timestamp": 380
      }
    ],
    "count": 2
  }
}
```

## Data Models

### Processing Status

```typescript
type ProcessingStatus =
  | "pending"       // Waiting for processing
  | "transcribing"  // Transcribing audio
  | "analyzing"     // Running AI analysis
  | "completed"     // Processing finished
  | "failed";       // Processing failed
```

### Transcript Segment

```typescript
interface TranscriptSegment {
  startTime: number;  // Start time in seconds
  endTime: number;    // End time in seconds
  text: string;       // Transcribed text
  confidence?: number; // Confidence score (0-1)
}
```

### Action Item

```typescript
interface ActionItem {
  text: string;                          // Action item description
  timestamp?: number;                     // Timestamp in video (seconds)
  priority?: "high" | "medium" | "low";  // Priority level
}
```

### Chapter

```typescript
interface VideoChapter {
  id: string;
  videoId: string;
  title: string;
  summary?: string;
  startTime: number;  // Start time in seconds
  endTime?: number;   // End time in seconds
  createdAt: Date;
}
```

### Code Snippet

```typescript
interface VideoCodeSnippet {
  id: string;
  videoId: string;
  language?: string;    // Programming language
  code: string;         // The actual code
  title?: string;       // Title/description
  description?: string; // Detailed description
  timestamp?: number;   // Timestamp in video (seconds)
  createdAt: Date;
}
```

## Video Upload with AI Processing

When uploading a video, AI processing starts automatically:

```http
POST /api/videos/upload
Content-Type: multipart/form-data
```

**Form Data:**
- `video` (file, required): The video file
- `title` (string, required): Video title
- `description` (string, optional): Video description
- `organizationId` (string, required): Organization ID
- `authorId` (string, required): Author user ID
- `channelId` (string, optional): Channel ID
- `collectionId` (string, optional): Collection ID
- `skipAIProcessing` (boolean, optional): Skip AI processing if true

**Response:**
```json
{
  "success": true,
  "data": {
    "videoId": "video_123",
    "videoUrl": "https://storage.example.com/videos/...",
    "thumbnailUrl": "https://storage.example.com/thumbnails/...",
    "duration": "10:30",
    "processingStatus": "pending"
  }
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
Status: 404

### Video URL Not Available

```json
{
  "success": false,
  "error": "Video URL not available for processing"
}
```
Status: 500

### Transcription Service Not Configured

```json
{
  "success": false,
  "error": "Transcription service not available. Please configure OPENAI_API_KEY."
}
```
Status: 500

### Already Processing

```json
{
  "success": true,
  "data": {
    "message": "Video is already being processed",
    "status": "transcribing"
  }
}
```

## Environment Configuration

Required environment variables for AI processing:

```bash
# OpenAI API Key (for Whisper transcription)
OPENAI_API_KEY=sk-...

# AI Gateway URL (for XAI Grok-3)
AI_GATEWAY_URL=https://gateway.ai.example.com
```

## Architecture

### Services

The AI processing pipeline uses Effect-TS services:

1. **TranscriptionService** - Handles audio transcription via OpenAI Whisper
2. **AIService** - Provides AI analysis capabilities:
   - `generateVideoSummary` - Generate video summary
   - `generateVideoTags` - Generate relevant tags
   - `extractActionItemsWithTimestamps` - Extract action items
   - `detectCodeSnippets` - Detect code in speech
   - `generateChapters` - Generate chapters/key moments
3. **VideoAIProcessorService** - Orchestrates the full pipeline

### Database Schema

New tables for AI data:

```sql
-- Processing status added to videos table
ALTER TABLE videos ADD COLUMN processing_status TEXT DEFAULT 'pending';
ALTER TABLE videos ADD COLUMN processing_error TEXT;
ALTER TABLE videos ADD COLUMN transcript_segments JSONB;
ALTER TABLE videos ADD COLUMN ai_tags JSONB;
ALTER TABLE videos ADD COLUMN ai_action_items JSONB;

-- Chapters table
CREATE TABLE video_chapters (
  id TEXT PRIMARY KEY,
  video_id TEXT REFERENCES videos(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT,
  start_time INTEGER NOT NULL,
  end_time INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Code snippets table
CREATE TABLE video_code_snippets (
  id TEXT PRIMARY KEY,
  video_id TEXT REFERENCES videos(id) ON DELETE CASCADE,
  language TEXT,
  code TEXT NOT NULL,
  title TEXT,
  description TEXT,
  timestamp INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Best Practices

1. **Video Quality**: Higher quality audio results in better transcription
2. **Clear Speech**: Videos with clear speech produce more accurate transcripts
3. **Background Noise**: Minimize background noise for better results
4. **Language**: Currently optimized for English content
5. **Video Length**: Long videos may take longer to process

## Limitations

- Maximum video file size: 500MB
- Transcription accuracy depends on audio quality
- Code detection works best for clearly spoken code
- Chapter generation requires sufficient content variation
