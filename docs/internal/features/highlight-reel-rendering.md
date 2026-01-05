# Highlight Reel Rendering

This document describes the highlight reel rendering feature implementation.

## Overview

The highlight reel rendering feature allows users to combine multiple video clips into a single rendered video file. This is implemented using a durable workflow pattern with the Workflow DevKit for reliability and observability.

## Architecture

### Components

1. **API Route**: `/api/highlight-reels/[id]/render` (POST)
   - Authenticates the user
   - Validates the highlight reel exists and has clips
   - Triggers the background rendering workflow
   - Returns immediately with 202 Accepted status

2. **Workflow**: `renderHighlightReelWorkflow`
   - Location: `/src/workflows/highlight-reel-render.ts`
   - Handles the complete rendering pipeline with automatic retries and checkpointing
   - Can resume from the last successful step if the server restarts

### Database Schema

The `highlightReels` table tracks the rendering status:

- `status`: One of `"draft"`, `"rendering"`, `"ready"`, `"failed"`
- `clipIds`: Array of clip IDs to include in the reel
- `storageKey`: R2 storage path for the rendered video
- `duration`: Total duration of the rendered video in seconds
- `processingError`: Error message if rendering failed

## Workflow Steps

The rendering workflow follows these steps:

1. **Fetch Highlight Reel Data**
   - Retrieves the reel from the database
   - Validates it has clips

2. **Update Status to "rendering"**
   - Updates the database to indicate rendering has started

3. **Get Clip Segments**
   - Fetches all clips from the database
   - Retrieves parent video URLs for each clip
   - Extracts start/end timestamps
   - Filters out clips with missing video URLs

4. **Render Video**
   - Uses Replicate's video concatenation model
   - Combines all clip segments into a single video
   - Outputs as MP4 with H.264 codec

5. **Download and Upload**
   - Downloads the rendered video from Replicate
   - Uploads to Cloudflare R2 storage
   - Generates a storage key: `{organizationId}/highlight-reels/{reelId}-{timestamp}.mp4`

6. **Update Highlight Reel**
   - Sets status to `"ready"`
   - Stores the storage key
   - Records the total duration
   - Clears any previous error messages

7. **Error Handling**
   - On failure, sets status to `"failed"`
   - Stores error message in `processingError`
   - Uses `FatalError` for non-retryable errors

## API Usage

### Start Rendering

```http
POST /api/highlight-reels/{id}/render
Authorization: Bearer {token}
```

**Response (202 Accepted)**:
```json
{
  "success": true,
  "data": {
    "id": "reel_123",
    "status": "rendering",
    "clipCount": 5
  },
  "message": "Highlight reel rendering started. The video will be ready shortly."
}
```

### Check Status

Use the existing GET endpoint to check the rendering status:

```http
GET /api/highlight-reels/{id}
Authorization: Bearer {token}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "reel_123",
    "title": "My Highlights",
    "status": "ready",
    "storageKey": "org_123/highlight-reels/reel_123-1234567890.mp4",
    "duration": 125,
    "clipIds": ["clip_1", "clip_2", "clip_3"],
    ...
  }
}
```

## Dependencies

### Required Environment Variables

- `REPLICATE_API_TOKEN`: Replicate API key for video processing
- `R2_ACCOUNT_ID`: Cloudflare R2 account ID
- `R2_ACCESS_KEY_ID`: R2 access key
- `R2_SECRET_ACCESS_KEY`: R2 secret key
- `R2_BUCKET_NAME`: R2 bucket name

### Replicate Model

The workflow uses the following Replicate model:
- **Model**: `noxinc/video-concat:latest`
- **Purpose**: Concatenates multiple video segments into a single video
- **Input**: Array of video segments with URLs and timestamps
- **Output**: Rendered MP4 video URL

> **Note**: If this specific model is not available, you may need to:
> - Use an alternative video concatenation model on Replicate
> - Implement a custom video processing solution using FFmpeg
> - Update the model name in the workflow file

## Error Handling

### Fatal Errors (Non-retryable)

The following errors are considered fatal and will not be retried:

- Replicate API token not configured
- R2 storage not configured
- Highlight reel not found
- No clips in the highlight reel
- Video concatenation model not available

### Retryable Errors

The workflow will automatically retry these errors:

- Network failures
- Temporary Replicate API issues
- Temporary R2 upload failures

## Monitoring

The workflow logs important events:

- Clip segment retrieval
- Video concatenation start/completion
- Video upload to R2
- Errors and failures

These logs can be viewed in your workflow monitoring dashboard.

## Future Enhancements

Potential improvements for the rendering feature:

1. **Transition Effects**: Add fade, wipe, or other transitions between clips
2. **Title Cards**: Insert title screens between sections
3. **Audio Mixing**: Adjust audio levels, add music, or mix tracks
4. **Custom Branding**: Overlay logos or watermarks
5. **Quality Options**: Allow users to select output resolution and bitrate
6. **Thumbnail Generation**: Automatically generate thumbnails for the rendered video
7. **Progress Tracking**: Real-time progress updates during rendering
8. **Custom FFmpeg**: Use direct FFmpeg processing for more control and faster rendering

## Troubleshooting

### "Video concatenation model not available"

This error occurs when the Replicate model cannot be found. Solutions:

1. Verify the model name is correct in the workflow
2. Check if the model is still available on Replicate
3. Consider using an alternative video processing service
4. Implement a custom FFmpeg-based solution

### "R2 storage not configured"

Ensure all R2 environment variables are set:
```bash
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=your_bucket_name
```

### Rendering takes too long

Video rendering can be slow depending on:
- Number of clips
- Length of clips
- Video quality/resolution
- Replicate API queue

Consider implementing:
- Progress notifications
- Estimated completion time
- Email notification when complete
