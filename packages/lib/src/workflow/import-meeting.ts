/**
 * Import Meeting Workflow
 *
 * Handles the async import of meeting recordings from Zoom and Google Meet.
 * Uses fire-and-forget async processing pattern similar to video upload.
 */

import { Effect, Layer, ManagedRuntime } from 'effect';
import type { IntegrationProvider } from '../db/schema';
import { AppLive } from '../effect/runtime';
import { DatabaseLive } from '../effect/services/database';
import { GoogleClientLive } from '../effect/services/google-client';
import { GoogleMeet, GoogleMeetLive } from '../effect/services/google-meet';
import { IntegrationRepository, IntegrationRepositoryLive } from '../effect/services/integration-repository';
import { Storage } from '../effect/services/storage';
import { TranscriptionLive } from '../effect/services/transcription';
import { VideoAIProcessor, VideoAIProcessorLive } from '../effect/services/video-ai-processor';
import { VideoRepository } from '../effect/services/video-repository';
import { Zoom, ZoomLive } from '../effect/services/zoom';
import { ZoomClientLive } from '../effect/services/zoom-client';
import { formatDuration } from '../format-utils';
import { logger } from '../logger';

// =============================================================================
// Workflow Input Types
// =============================================================================

export interface ImportMeetingInput {
  readonly importedMeetingId: string;
  readonly integrationId: string;
  readonly provider: IntegrationProvider;
  readonly externalId: string;
  readonly downloadUrl: string;
  readonly meetingTitle: string;
  readonly userId: string;
  readonly organizationId: string;
  readonly accessToken: string;
}

export interface ImportMeetingResult {
  readonly success: boolean;
  readonly videoId?: string;
  readonly error?: string;
}

// =============================================================================
// Layer Setup
// =============================================================================

const IntegrationRepositoryWithDeps = IntegrationRepositoryLive.pipe(Layer.provide(DatabaseLive));
const VideoAIProcessorWithDeps = VideoAIProcessorLive.pipe(Layer.provide(Layer.mergeAll(AppLive, TranscriptionLive)));
const ZoomLiveWithDeps = ZoomLive.pipe(Layer.provide(ZoomClientLive));
const GoogleMeetLiveWithDeps = GoogleMeetLive.pipe(Layer.provide(GoogleClientLive));

const ImportWorkflowLayer = Layer.mergeAll(
  AppLive,
  ZoomLiveWithDeps,
  GoogleMeetLiveWithDeps,
  IntegrationRepositoryWithDeps,
  VideoAIProcessorWithDeps,
);

const ImportWorkflowRuntime = ManagedRuntime.make(ImportWorkflowLayer);

// =============================================================================
// Import Meeting Effect
// =============================================================================

const importMeetingEffect = (input: ImportMeetingInput) =>
  Effect.gen(function* () {
    const { importedMeetingId, provider, externalId, downloadUrl, meetingTitle, userId, organizationId, accessToken } =
      input;

    const integrationRepo = yield* IntegrationRepository;
    const storage = yield* Storage;
    const videoRepo = yield* VideoRepository;
    const zoom = yield* Zoom;
    const google = yield* GoogleMeet;
    const aiProcessor = yield* VideoAIProcessor;

    // Step 1: Update import status to downloading
    yield* integrationRepo.updateImportedMeeting(importedMeetingId, {
      importStatus: 'downloading',
    });

    // Step 2: Download the recording
    let fileBuffer: Buffer;
    let contentType = 'video/mp4';

    if (provider === 'zoom') {
      const fullDownloadUrl = zoom.getDownloadUrl(downloadUrl, accessToken);

      const response = yield* Effect.tryPromise({
        try: () => fetch(fullDownloadUrl),
        catch: (error) => new Error(`Failed to download Zoom recording: ${error}`),
      });

      if (!response.ok) {
        yield* Effect.fail(new Error(`Failed to download Zoom recording: ${response.status}`));
      }

      const arrayBuffer = yield* Effect.tryPromise({
        try: () => response.arrayBuffer(),
        catch: (error) => new Error(`Failed to read response: ${error}`),
      });

      fileBuffer = Buffer.from(arrayBuffer);
      contentType = response.headers.get('content-type') || 'video/mp4';
    } else {
      // Google Meet
      const stream = yield* google.downloadFile(accessToken, externalId);

      const chunks: Uint8Array[] = [];
      const reader = stream.getReader();

      yield* Effect.tryPromise({
        try: async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              chunks.push(value);
            }
          } finally {
            // Always release the reader to prevent resource leaks
            reader.releaseLock();
          }
        },
        catch: (error) => new Error(`Failed to read stream: ${error}`),
      });

      fileBuffer = Buffer.concat(chunks);
    }

    // Step 3: Upload to storage
    const filename = `${externalId}.mp4`;
    const key = storage.generateFileKey(organizationId, filename, 'video');

    const uploadResult = yield* storage.uploadFile(fileBuffer, key, { contentType });

    // Step 4: Update status to processing
    yield* integrationRepo.updateImportedMeeting(importedMeetingId, {
      importStatus: 'processing',
    });

    // Step 5: Create video record (store the key, not a URL)
    const estimatedDuration = Math.round(fileBuffer.length / 100000);

    const video = yield* videoRepo.createVideo({
      title: meetingTitle || 'Meeting Recording',
      description: `Imported from ${provider === 'zoom' ? 'Zoom' : 'Google Meet'}`,
      duration: formatDuration(estimatedDuration),
      videoUrl: uploadResult.key,
      authorId: userId,
      organizationId,
      processingStatus: 'pending',
    });

    // Step 6: Update imported meeting with video ID
    yield* integrationRepo.updateImportedMeeting(importedMeetingId, {
      videoId: video.id,
      importStatus: 'completed',
      importedAt: new Date(),
    });

    // Step 7: Generate presigned URL for AI processing
    const presignedUrl = yield* storage.generatePresignedDownloadUrl(uploadResult.key);

    // Step 8: Trigger AI processing in the background (fire and forget)
    const aiEffect = aiProcessor.processVideo(video.id, presignedUrl, meetingTitle);
    Effect.runPromise(aiEffect).catch((err) => {
      logger.error('Import meeting AI processing failed', err instanceof Error ? err : new Error(String(err)), {
        videoId: video.id,
        importedMeetingId,
        provider,
      });
    });

    return {
      success: true,
      videoId: video.id,
    } as ImportMeetingResult;
  });

// =============================================================================
// Workflow Trigger Function
// =============================================================================

export async function triggerImportMeeting(input: ImportMeetingInput): Promise<void> {
  const effect = importMeetingEffect(input).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        const integrationRepo = yield* IntegrationRepository;

        yield* integrationRepo
          .updateImportedMeeting(input.importedMeetingId, {
            importStatus: 'failed',
            importError: error instanceof Error ? error.message : String(error),
          })
          .pipe(Effect.catchAll(() => Effect.succeed(undefined)));

        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        } as ImportMeetingResult;
      }),
    ),
  );

  // Run in the background (fire and forget)
  ImportWorkflowRuntime.runPromise(effect).catch((err) => {
    logger.error('Import meeting workflow failed', err instanceof Error ? err : new Error(String(err)), {
      importedMeetingId: input.importedMeetingId,
      provider: input.provider,
      externalId: input.externalId,
    });
  });
}
