/**
 * URL Upload API
 *
 * Imports a video from a remote URL by downloading and re-uploading to R2.
 */

import { createPublicLayer, mapErrorToApiResponse } from '@nuclom/lib/api-handler';
import { auth } from '@nuclom/lib/auth';
import { CollectionRepository, Storage, ValidationError, VideoRepository } from '@nuclom/lib/effect';
import { logger } from '@nuclom/lib/logger';
import type { ApiResponse } from '@nuclom/lib/types';
import { sanitizeDescription, sanitizeTitle, validate } from '@nuclom/lib/validation';
import { Effect, Schema } from 'effect';
import { connection, type NextRequest, NextResponse } from 'next/server';
import { processVideoWorkflow } from '@/workflows/video-processing/workflow';

// =============================================================================
// Types
// =============================================================================

const UrlUploadRequestSchema = Schema.Struct({
  url: Schema.String,
  title: Schema.String,
  description: Schema.optional(Schema.String),
  organizationId: Schema.String,
  authorId: Schema.String,
  collectionId: Schema.optional(Schema.String),
});

type UrlUploadRequest = Schema.Schema.Type<typeof UrlUploadRequestSchema>;

interface UrlUploadResponse {
  videoId: string;
  videoUrl: string;
  processingStatus: string;
}

// Placeholder duration - will be updated during processing
const PLACEHOLDER_DURATION = '0:00';

// Supported video extensions
const SUPPORTED_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v', '3gp'];

// Max file size for URL imports (2GB)
const MAX_URL_FILE_SIZE = 2 * 1024 * 1024 * 1024;

// =============================================================================
// Helper Functions
// =============================================================================

function getExtensionFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    for (const ext of SUPPORTED_EXTENSIONS) {
      if (pathname.endsWith(`.${ext}`)) {
        return ext;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function getExtensionFromContentType(contentType: string): string | null {
  const typeMap: Record<string, string> = {
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    'video/x-matroska': 'mkv',
    'video/webm': 'webm',
    'video/x-flv': 'flv',
    'video/x-ms-wmv': 'wmv',
    'video/3gpp': '3gp',
    'video/mpeg': 'mp4',
  };
  return typeMap[contentType] || null;
}

// =============================================================================
// POST /api/videos/upload/url - Import video from URL
// =============================================================================

export async function POST(request: NextRequest) {
  await connection();

  // Verify authentication
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Parse request body
  let body: UrlUploadRequest;
  try {
    const rawBody = await request.json();
    body = await Effect.runPromise(validate(UrlUploadRequestSchema, rawBody));
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  const { url, title, description, organizationId, authorId, collectionId } = body;

  // Validate URL
  let videoUrl: URL;
  try {
    videoUrl = new URL(url);
    if (!['http:', 'https:'].includes(videoUrl.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid URL' }, { status: 400 });
  }

  const effect = Effect.gen(function* () {
    const storage = yield* Storage;
    const videoRepo = yield* VideoRepository;
    const collectionRepo = yield* CollectionRepository;

    // Check if storage is configured
    if (!storage.isConfigured) {
      return yield* Effect.fail(
        new ValidationError({
          message: 'Storage is not configured',
        }),
      );
    }

    // Fetch the video with HEAD request first to check content type and size
    const headResponse = yield* Effect.tryPromise({
      try: () =>
        fetch(videoUrl.toString(), {
          method: 'HEAD',
          headers: {
            'User-Agent': 'Nuclom Video Import/1.0',
          },
        }),
      catch: () =>
        new ValidationError({
          message: 'Failed to access video URL. Please check if the URL is accessible.',
        }),
    });

    if (!headResponse.ok) {
      return yield* Effect.fail(
        new ValidationError({
          message: `Failed to access video URL: ${headResponse.status} ${headResponse.statusText}`,
        }),
      );
    }

    const contentType = headResponse.headers.get('content-type') || '';
    const contentLength = headResponse.headers.get('content-length');

    // Check file size
    if (contentLength) {
      const size = Number.parseInt(contentLength, 10);
      if (size > MAX_URL_FILE_SIZE) {
        return yield* Effect.fail(
          new ValidationError({
            message: 'Video file is too large. Maximum size for URL imports is 2GB.',
          }),
        );
      }
    }

    // Determine file extension
    let extension = getExtensionFromUrl(url);
    if (!extension) {
      extension = getExtensionFromContentType(contentType);
    }
    if (!extension) {
      // Default to mp4 if we can't determine
      extension = 'mp4';
    }

    // Download the video
    const videoResponse = yield* Effect.tryPromise({
      try: () =>
        fetch(videoUrl.toString(), {
          headers: {
            'User-Agent': 'Nuclom Video Import/1.0',
          },
        }),
      catch: () =>
        new ValidationError({
          message: 'Failed to download video from URL.',
        }),
    });

    if (!videoResponse.ok || !videoResponse.body) {
      return yield* Effect.fail(
        new ValidationError({
          message: `Failed to download video: ${videoResponse.status} ${videoResponse.statusText}`,
        }),
      );
    }

    // Convert response to buffer
    const arrayBuffer = yield* Effect.tryPromise({
      try: () => videoResponse.arrayBuffer(),
      catch: () =>
        new ValidationError({
          message: 'Failed to read video data.',
        }),
    });

    const buffer = Buffer.from(arrayBuffer);

    // Generate unique file key
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().substring(0, 8);
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const fileKey = `videos/${organizationId}/${timestamp}-${randomId}-${sanitizedTitle}.${extension}`;

    // Upload to R2
    yield* storage.uploadFile(buffer, fileKey, { contentType: `video/${extension}` });

    // Generate presigned URL for immediate playback
    const presignedVideoUrl = yield* storage.generatePresignedDownloadUrl(fileKey, 3600);

    // Sanitize user input
    const sanitizedTitleFinal = sanitizeTitle(title);
    const sanitizedDescription = description ? sanitizeDescription(description) : undefined;

    // Create video record
    const video = yield* videoRepo.createVideo({
      title: sanitizedTitleFinal,
      description: sanitizedDescription,
      duration: PLACEHOLDER_DURATION,
      videoUrl: fileKey,
      thumbnailUrl: undefined,
      authorId,
      organizationId,
      processingStatus: 'pending',
    });

    if (collectionId) {
      yield* collectionRepo.addVideoToCollection(collectionId, video.id);
    }

    return {
      videoId: video.id,
      videoUrl: presignedVideoUrl,
      processingStatus: video.processingStatus,
      videoTitle: sanitizedTitleFinal,
    };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);

  if (exit._tag === 'Failure') {
    return mapErrorToApiResponse(exit.cause);
  }

  const data = exit.value;

  // Trigger video processing
  processVideoWorkflow({
    videoId: data.videoId,
    videoUrl: data.videoUrl,
    videoTitle: data.videoTitle,
    organizationId: body.organizationId,
  }).catch((err) => {
    logger.error('Video processing workflow error', err instanceof Error ? err : new Error(String(err)), {
      videoId: data.videoId,
      component: 'video-upload-url',
    });
  });

  const response: ApiResponse<UrlUploadResponse> = {
    success: true,
    data: {
      videoId: data.videoId,
      videoUrl: data.videoUrl,
      processingStatus: data.processingStatus,
    },
  };

  return NextResponse.json(response, { status: 201 });
}
