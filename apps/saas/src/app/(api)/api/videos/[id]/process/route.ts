import { createPublicLayer, handleEffectExit } from '@nuclom/lib/api-handler';
import { auth } from '@nuclom/lib/auth';
import { AppLive, NotFoundError } from '@nuclom/lib/effect';
import { Auth, makeAuthLayer } from '@nuclom/lib/effect/services/auth';
import { Storage } from '@nuclom/lib/effect/services/storage';
import { TranscriptionLive } from '@nuclom/lib/effect/services/transcription';
import {
  VideoAIProcessingError,
  VideoAIProcessor,
  VideoAIProcessorLive,
} from '@nuclom/lib/effect/services/video-ai-processor';
import { VideoRepository } from '@nuclom/lib/effect/services/video-repository';
import { Effect, Layer } from 'effect';
import type { NextRequest } from 'next/server';

// Build the layer with all required dependencies
const VideoAIProcessorWithDeps = VideoAIProcessorLive.pipe(Layer.provide(Layer.mergeAll(AppLive, TranscriptionLive)));

const ProcessingLayer = Layer.mergeAll(AppLive, TranscriptionLive, VideoAIProcessorWithDeps);

// =============================================================================
// POST /api/videos/[id]/process - Trigger AI processing
// =============================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const videoId = resolvedParams.id;

    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Get video details using repository (proper Effect pattern)
    const videoRepo = yield* VideoRepository;
    const video = yield* videoRepo.getVideo(videoId).pipe(
      Effect.catchTag('NotFoundError', () =>
        Effect.fail(
          new NotFoundError({
            message: 'Video not found',
            entity: 'Video',
            id: videoId,
          }),
        ),
      ),
    );

    // Check if video has a URL/key stored
    if (!video.videoUrl) {
      return yield* Effect.fail(
        new VideoAIProcessingError({
          message: 'Video URL not available for processing',
          videoId,
        }),
      );
    }

    // Check if already processing
    if (video.processingStatus === 'transcribing' || video.processingStatus === 'analyzing') {
      return {
        message: 'Video is already being processed',
        status: video.processingStatus,
      };
    }

    // Get the processor and start processing
    const processor = yield* VideoAIProcessor;

    // Check if we already have a transcript
    if (video.transcript && video.transcriptSegments) {
      // Process from existing transcript
      const result = yield* processor.processFromTranscript(
        videoId,
        video.transcript,
        video.transcriptSegments,
        video.title,
      );

      return {
        message: 'AI analysis completed',
        status: 'completed',
        summary: result.summary,
        tags: result.tags,
        actionItems: result.actionItems,
        chapters: result.chapters.length,
      };
    }

    // Generate a presigned URL from the stored file key
    // The database stores file keys, not full URLs
    const storage = yield* Storage;
    const presignedUrl = yield* storage.generatePresignedDownloadUrl(video.videoUrl, 3600).pipe(
      Effect.catchAll(() =>
        Effect.fail(
          new VideoAIProcessingError({
            message: 'Failed to generate video URL for processing',
            videoId,
          }),
        ),
      ),
    );

    // Full processing with transcription using the presigned URL
    const result = yield* processor.processVideo(videoId, presignedUrl, video.title);

    return {
      message: 'Video processing completed',
      status: 'completed',
      summary: result.summary,
      tags: result.tags,
      actionItems: result.actionItems,
      chapters: result.chapters.length,
    };
  });

  // Use standardized layer composition and error handling
  const AuthLayer = makeAuthLayer(auth);
  const FullLayer = Layer.merge(ProcessingLayer, AuthLayer);
  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}

// =============================================================================
// GET /api/videos/[id]/process - Get processing status
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const videoId = resolvedParams.id;

    // Get video processing status using repository
    const videoRepo = yield* VideoRepository;
    const video = yield* videoRepo.getVideo(videoId).pipe(
      Effect.catchTag('NotFoundError', () =>
        Effect.fail(
          new NotFoundError({
            message: 'Video not found',
            entity: 'Video',
            id: videoId,
          }),
        ),
      ),
    );

    return {
      videoId: video.id,
      status: video.processingStatus,
      error: video.processingError,
      hasTranscript: !!video.transcript,
      hasSummary: !!video.aiSummary,
      tags: video.aiTags || [],
      actionItems: video.aiActionItems || [],
    };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
