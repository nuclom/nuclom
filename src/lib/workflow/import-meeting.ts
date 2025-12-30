/**
 * Import Meeting Workflow
 *
 * Handles the async import of meeting recordings from Zoom and Google Meet.
 * Uses fire-and-forget async processing pattern similar to video upload.
 */

import { Effect, Layer } from "effect";
import type { IntegrationProvider } from "@/lib/db/schema";
import { AppLive } from "@/lib/effect/runtime";
import { Storage } from "@/lib/effect/services/storage";
import { VideoRepository } from "@/lib/effect/services/video-repository";
import { IntegrationRepository, IntegrationRepositoryLive } from "@/lib/effect/services/integration-repository";
import { Zoom, ZoomLive } from "@/lib/effect/services/zoom";
import { GoogleMeet, GoogleMeetLive } from "@/lib/effect/services/google-meet";
import { VideoAIProcessor, VideoAIProcessorLive } from "@/lib/effect/services/video-ai-processor";
import { TranscriptionLive } from "@/lib/effect/services/transcription";
import { DatabaseLive } from "@/lib/effect/services/database";

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

const ImportWorkflowLayer = Layer.mergeAll(
  AppLive,
  ZoomLive,
  GoogleMeetLive,
  IntegrationRepositoryWithDeps,
  VideoAIProcessorWithDeps,
);

// =============================================================================
// Helper Functions
// =============================================================================

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

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
      importStatus: "downloading",
    });

    // Step 2: Download the recording
    let fileBuffer: Buffer;
    let contentType = "video/mp4";

    if (provider === "zoom") {
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
      contentType = response.headers.get("content-type") || "video/mp4";
    } else {
      // Google Meet
      const stream = yield* google.downloadFile(accessToken, externalId);

      const chunks: Uint8Array[] = [];
      const reader = stream.getReader();

      yield* Effect.tryPromise({
        try: async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
          }
        },
        catch: (error) => new Error(`Failed to read stream: ${error}`),
      });

      fileBuffer = Buffer.concat(chunks);
    }

    // Step 3: Upload to storage
    const filename = `${externalId}.mp4`;
    const key = storage.generateFileKey(organizationId, filename, "video");

    const uploadResult = yield* storage.uploadLargeFile(fileBuffer, key, { contentType });

    // Step 4: Update status to processing
    yield* integrationRepo.updateImportedMeeting(importedMeetingId, {
      importStatus: "processing",
    });

    // Step 5: Create video record
    const estimatedDuration = Math.round(fileBuffer.length / 100000);

    const video = yield* videoRepo.createVideo({
      title: meetingTitle || "Meeting Recording",
      description: `Imported from ${provider === "zoom" ? "Zoom" : "Google Meet"}`,
      duration: formatDuration(estimatedDuration),
      videoUrl: uploadResult.url,
      authorId: userId,
      organizationId,
      processingStatus: "pending",
    });

    // Step 6: Update imported meeting with video ID
    yield* integrationRepo.updateImportedMeeting(importedMeetingId, {
      videoId: video.id,
      importStatus: "completed",
      importedAt: new Date(),
    });

    // Step 7: Trigger AI processing in the background (fire and forget)
    const aiEffect = aiProcessor.processVideo(video.id, uploadResult.url, meetingTitle);
    Effect.runPromise(aiEffect).catch((err) => {
      console.error("[Import Meeting AI Processing Error]", err);
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
            importStatus: "failed",
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

  const runnable = Effect.provide(effect, ImportWorkflowLayer);

  // Run in the background (fire and forget)
  Effect.runPromise(runnable).catch((err) => {
    console.error("[Import Meeting Error]", err);
  });
}
