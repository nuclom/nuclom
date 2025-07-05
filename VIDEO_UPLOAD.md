# Video Upload Documentation

## Overview

The video upload functionality allows users to upload video files to their organization with automatic processing, thumbnail generation, and storage using Cloudflare R2.

## Features

### 🎬 Video Upload

- **Drag & Drop**: Simply drag video files into the upload area
- **File Selection**: Click to browse and select video files
- **Format Support**: MP4, MOV, AVI, MKV, WebM, FLV, WMV
- **Size Limit**: Maximum 500MB per file
- **Progress Tracking**: Real-time upload progress with visual feedback

### 🔄 Video Processing

- **Automatic Processing**: Videos are processed upon upload
- **Thumbnail Generation**: Automatic thumbnail creation from video
- **Metadata Extraction**: Duration and video information extraction
- **Storage**: Secure storage using Cloudflare R2

### 🎨 User Interface

- **Clean Design**: Modern, responsive interface using shadcn/ui
- **Error Handling**: Clear error messages and validation
- **Navigation**: Seamless integration with existing organization navigation
- **Mobile Friendly**: Works on desktop and mobile devices

## Usage

### Accessing Upload

1. Navigate to your organization
2. Click the "Upload Video" button from:
   - Main organization page (in "New this week" section)
   - "My Videos" page (top right corner)
   - Or directly visit `/{organization}/upload`

### Uploading a Video

1. **Select File**: Either drag a video file or click "Select Video File"
2. **Add Details**:
   - Enter a title (required)
   - Add description (optional)
3. **Upload**: Click "Upload Video" to start the process
4. **Wait**: Monitor the progress bar during upload and processing
5. **Complete**: You'll be redirected to the new video page when done

### Supported Formats

- **MP4** (recommended)
- **MOV** (Apple QuickTime)
- **AVI** (Audio Video Interleave)
- **MKV** (Matroska)
- **WebM** (Web Video)
- **FLV** (Flash Video)
- **WMV** (Windows Media Video)

## Configuration

### Environment Variables

```bash
# Required for production
R2_ACCOUNT_ID=your-cloudflare-r2-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=nuclom-videos

# Optional - defaults to PostgreSQL connection
DATABASE_URL=postgresql://user:pass@host:port/db
```

### Development Mode

When R2 credentials are not configured, the system automatically falls back to mock storage mode for development:

- Files are "uploaded" but not actually stored
- Mock URLs are generated for testing
- All functionality works except actual file storage

## API Endpoints

### Upload Video

```
POST /api/videos/upload
Content-Type: multipart/form-data

Body:
- video: File (video file)
- title: string (required)
- description: string (optional)
- organizationId: string (required)
- authorId: string (required)
- channelId: string (optional)
- seriesId: string (optional)
```

### Response

```json
{
  "success": true,
  "data": {
    "videoId": "uuid",
    "videoUrl": "https://...",
    "thumbnailUrl": "https://...",
    "duration": "12:34"
  }
}
```

## Architecture

### Components

- **VideoUpload** (`src/components/video-upload.tsx`): Main upload component
- **StorageService** (`src/lib/storage.ts`): Cloudflare R2 integration
- **VideoProcessor** (`src/lib/video-processor.ts`): Video processing pipeline
- **Upload API** (`src/app/api/videos/upload/route.ts`): Backend endpoint

### File Flow

1. **Client**: User selects file in UI
2. **Validation**: File type and size validation
3. **Upload**: FormData sent to API endpoint
4. **Processing**: Server processes video and generates thumbnail
5. **Storage**: Files uploaded to Cloudflare R2
6. **Database**: Video metadata saved to PostgreSQL
7. **Response**: Video details returned to client
8. **Navigation**: User redirected to new video page

## Error Handling

### Client-Side Validation

- File format validation
- File size limits (500MB)
- Required field validation
- Real-time error display

### Server-Side Validation

- Content-type verification
- File format re-validation
- Database constraint validation
- Storage error handling

### Common Errors

- **"Unsupported file format"**: File is not a supported video format
- **"File size too large"**: File exceeds 500MB limit
- **"Missing required fields"**: Title, organization, or author not provided
- **"Upload failed"**: Network or server error during upload

## Performance

### Optimizations

- **Chunked Upload**: Large files uploaded in chunks for reliability
- **Progress Tracking**: Real-time progress feedback
- **Async Processing**: Non-blocking video processing
- **CDN Ready**: R2 provides global CDN for fast video delivery

### Limits

- **File Size**: 500MB maximum per video
- **Concurrent Uploads**: Limited by browser and server capacity
- **Processing Time**: Depends on video size and complexity
- **Storage**: Limited by Cloudflare R2 plan limits

## Troubleshooting

### Common Issues

**Upload Stuck at 0%**

- Check network connection
- Verify file size is under 500MB
- Ensure R2 credentials are configured

**"Failed to upload file" Error**

- Check R2 credentials and permissions
- Verify bucket exists and is accessible
- Check server logs for detailed errors

**Video Not Playing After Upload**

- Verify R2 bucket is configured for public access
- Check video file format compatibility
- Ensure CDN settings are correct

**Development Mode Issues**

- Missing R2 credentials will use mock storage
- Mock URLs won't serve actual video files
- Database still needs to be configured

### Debug Mode

Set environment variable for detailed logging:

```bash
NODE_ENV=development
```

This will provide:

- Detailed upload progress logs
- Storage operation debugging
- API request/response logging
- Error stack traces

## Future Enhancements

### Planned Features

- **Video Transcoding**: Multiple quality options
- **Live Streaming**: Real-time video streaming
- **Batch Upload**: Multiple file upload support
- **Resume Upload**: Pause and resume large uploads
- **Video Analytics**: View counts and engagement metrics
- **Subtitle Support**: Automatic and manual subtitle generation

### Integration Opportunities

- **AI Processing**: Automatic video summarization
- **CDN Optimization**: Enhanced global delivery
- **Compression**: Advanced video compression
- **Security**: Enhanced access controls and DRM
