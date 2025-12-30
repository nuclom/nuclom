/**
 * Video AI Processing Service using Effect-TS
 *
 * Orchestrates the complete AI analysis pipeline for videos:
 * 1. Transcription (audio to text)
 * 2. AI Analysis (summary, tags, action items)
 * 3. Code snippet detection
 * 4. Chapter generation
 * 5. Database storage of results
 */

import { Effect, Context, Layer, pipe } from "effect";
import { Data } from "effect";
import { eq } from "drizzle-orm";
import { Database } from "./database";
import { AI, type ChapterResult, type CodeSnippetResult, type ActionItemResult } from "./ai";
import { Transcription, type TranscriptionResult } from "./transcription";
import {
  videos,
  videoChapters,
  videoCodeSnippets,
  type ProcessingStatus,
  type TranscriptSegment,
  type ActionItem,
} from "@/lib/db/schema";

// =============================================================================
// Error Types
// =============================================================================

export class VideoAIProcessingError extends Data.TaggedError("VideoAIProcessingError")<{
  readonly message: string;
  readonly stage?: ProcessingStatus;
  readonly videoId?: string;
  readonly cause?: unknown;
}> {}

// =============================================================================
// Types
// =============================================================================

export interface AIProcessingResult {
  readonly videoId: string;
  readonly transcript: string;
  readonly segments: ReadonlyArray<TranscriptSegment>;
  readonly summary: string;
  readonly tags: ReadonlyArray<string>;
  readonly actionItems: ReadonlyArray<ActionItem>;
  readonly chapters: ReadonlyArray<ChapterResult>;
  readonly codeSnippets: ReadonlyArray<CodeSnippetResult>;
}

export interface ProcessingStatusUpdate {
  readonly status: ProcessingStatus;
  readonly error?: string;
}

export interface VideoAIProcessorServiceInterface {
  /**
   * Process a video with full AI analysis pipeline
   * This is the main entry point that orchestrates all AI processing
   */
  readonly processVideo: (
    videoId: string,
    videoUrl: string,
    videoTitle?: string,
  ) => Effect.Effect<AIProcessingResult, VideoAIProcessingError>;

  /**
   * Process a video from an existing transcript (skip transcription)
   */
  readonly processFromTranscript: (
    videoId: string,
    transcript: string,
    segments: ReadonlyArray<TranscriptSegment>,
    videoTitle?: string,
  ) => Effect.Effect<AIProcessingResult, VideoAIProcessingError>;

  /**
   * Update video processing status
   */
  readonly updateProcessingStatus: (
    videoId: string,
    status: ProcessingStatus,
    error?: string,
  ) => Effect.Effect<void, VideoAIProcessingError>;

  /**
   * Get current processing status
   */
  readonly getProcessingStatus: (
    videoId: string,
  ) => Effect.Effect<{ status: ProcessingStatus; error?: string | null }, VideoAIProcessingError>;
}

// =============================================================================
// Video AI Processor Tag
// =============================================================================

export class VideoAIProcessor extends Context.Tag("VideoAIProcessor")<
  VideoAIProcessor,
  VideoAIProcessorServiceInterface
>() {}

// =============================================================================
// Video AI Processor Implementation
// =============================================================================

const makeVideoAIProcessorService = Effect.gen(function* () {
  const { db } = yield* Database;
  const ai = yield* AI;
  const transcription = yield* Transcription;

  const updateProcessingStatus = (
    videoId: string,
    status: ProcessingStatus,
    error?: string,
  ): Effect.Effect<void, VideoAIProcessingError> =>
    Effect.tryPromise({
      try: async () => {
        await db
          .update(videos)
          .set({
            processingStatus: status,
            processingError: error || null,
            updatedAt: new Date(),
          })
          .where(eq(videos.id, videoId));
      },
      catch: (e) =>
        new VideoAIProcessingError({
          message: `Failed to update processing status to ${status}`,
          stage: status,
          videoId,
          cause: e,
        }),
    });

  const getProcessingStatus = (
    videoId: string,
  ): Effect.Effect<{ status: ProcessingStatus; error?: string | null }, VideoAIProcessingError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await db
          .select({
            status: videos.processingStatus,
            error: videos.processingError,
          })
          .from(videos)
          .where(eq(videos.id, videoId))
          .limit(1);

        if (result.length === 0) {
          throw new Error("Video not found");
        }

        return {
          status: result[0].status,
          error: result[0].error,
        };
      },
      catch: (e) =>
        new VideoAIProcessingError({
          message: "Failed to get processing status",
          videoId,
          cause: e,
        }),
    });

  const saveTranscript = (
    videoId: string,
    transcript: string,
    segments: ReadonlyArray<TranscriptSegment>,
  ): Effect.Effect<void, VideoAIProcessingError> =>
    Effect.tryPromise({
      try: async () => {
        await db
          .update(videos)
          .set({
            transcript,
            transcriptSegments: segments as TranscriptSegment[],
            updatedAt: new Date(),
          })
          .where(eq(videos.id, videoId));
      },
      catch: (e) =>
        new VideoAIProcessingError({
          message: "Failed to save transcript",
          stage: "transcribing",
          videoId,
          cause: e,
        }),
    });

  const saveAIAnalysis = (
    videoId: string,
    summary: string,
    tags: ReadonlyArray<string>,
    actionItems: ReadonlyArray<ActionItem>,
  ): Effect.Effect<void, VideoAIProcessingError> =>
    Effect.tryPromise({
      try: async () => {
        await db
          .update(videos)
          .set({
            aiSummary: summary,
            aiTags: tags as string[],
            aiActionItems: actionItems as ActionItem[],
            updatedAt: new Date(),
          })
          .where(eq(videos.id, videoId));
      },
      catch: (e) =>
        new VideoAIProcessingError({
          message: "Failed to save AI analysis",
          stage: "analyzing",
          videoId,
          cause: e,
        }),
    });

  const saveChapters = (
    videoId: string,
    chapters: ReadonlyArray<ChapterResult>,
  ): Effect.Effect<void, VideoAIProcessingError> =>
    Effect.tryPromise({
      try: async () => {
        // Delete existing chapters
        await db.delete(videoChapters).where(eq(videoChapters.videoId, videoId));

        // Insert new chapters
        if (chapters.length > 0) {
          await db.insert(videoChapters).values(
            chapters.map((chapter) => ({
              videoId,
              title: chapter.title,
              summary: chapter.summary,
              startTime: Math.floor(chapter.startTime),
              endTime: chapter.endTime ? Math.floor(chapter.endTime) : null,
            })),
          );
        }
      },
      catch: (e) =>
        new VideoAIProcessingError({
          message: "Failed to save chapters",
          stage: "analyzing",
          videoId,
          cause: e,
        }),
    });

  const saveCodeSnippets = (
    videoId: string,
    snippets: ReadonlyArray<CodeSnippetResult>,
  ): Effect.Effect<void, VideoAIProcessingError> =>
    Effect.tryPromise({
      try: async () => {
        // Delete existing code snippets
        await db.delete(videoCodeSnippets).where(eq(videoCodeSnippets.videoId, videoId));

        // Insert new code snippets
        if (snippets.length > 0) {
          await db.insert(videoCodeSnippets).values(
            snippets.map((snippet) => ({
              videoId,
              language: snippet.language,
              code: snippet.code,
              title: snippet.title,
              description: snippet.description,
              timestamp: snippet.timestamp ? Math.floor(snippet.timestamp) : null,
            })),
          );
        }
      },
      catch: (e) =>
        new VideoAIProcessingError({
          message: "Failed to save code snippets",
          stage: "analyzing",
          videoId,
          cause: e,
        }),
    });

  const processFromTranscript = (
    videoId: string,
    transcript: string,
    segments: ReadonlyArray<TranscriptSegment>,
    videoTitle?: string,
  ): Effect.Effect<AIProcessingResult, VideoAIProcessingError> =>
    Effect.gen(function* () {
      // Update status to analyzing
      yield* updateProcessingStatus(videoId, "analyzing");

      // Run AI analysis in parallel
      const [summaryResult, tagsResult, actionItemsResult, chaptersResult, codeSnippetsResult] = yield* Effect.all(
        [
          pipe(
            ai.generateVideoSummary(transcript),
            Effect.catchAll((e) => {
              console.error("Failed to generate summary:", e);
              return Effect.succeed("Summary generation failed");
            }),
          ),
          pipe(
            ai.generateVideoTags(videoTitle || "Untitled Video", transcript.slice(0, 500)),
            Effect.catchAll(() => Effect.succeed([] as ReadonlyArray<string>)),
          ),
          pipe(
            ai.extractActionItemsWithTimestamps(segments),
            Effect.catchAll(() => Effect.succeed([] as ReadonlyArray<ActionItemResult>)),
          ),
          pipe(
            ai.generateChapters(segments, videoTitle),
            Effect.catchAll(() => Effect.succeed([] as ReadonlyArray<ChapterResult>)),
          ),
          pipe(
            ai.detectCodeSnippets(transcript, segments),
            Effect.catchAll(() => Effect.succeed([] as ReadonlyArray<CodeSnippetResult>)),
          ),
        ],
        { concurrency: "unbounded" },
      );

      // Convert action items to database format
      const actionItems: ActionItem[] = actionItemsResult.map((item) => ({
        text: item.text,
        timestamp: item.timestamp,
        priority: item.priority,
      }));

      // Save all results to database
      yield* Effect.all(
        [
          saveAIAnalysis(videoId, summaryResult, tagsResult, actionItems),
          saveChapters(videoId, chaptersResult),
          saveCodeSnippets(videoId, codeSnippetsResult),
        ],
        { concurrency: "unbounded" },
      );

      // Update status to completed
      yield* updateProcessingStatus(videoId, "completed");

      return {
        videoId,
        transcript,
        segments,
        summary: summaryResult,
        tags: tagsResult,
        actionItems,
        chapters: chaptersResult,
        codeSnippets: codeSnippetsResult,
      };
    }).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          // Update status to failed
          const errorMessage = error instanceof VideoAIProcessingError ? error.message : String(error);
          yield* updateProcessingStatus(videoId, "failed", errorMessage);
          return yield* Effect.fail(
            error instanceof VideoAIProcessingError
              ? error
              : new VideoAIProcessingError({
                  message: "AI analysis failed",
                  stage: "analyzing",
                  videoId,
                  cause: error,
                }),
          );
        }),
      ),
    );

  const processVideo = (
    videoId: string,
    videoUrl: string,
    videoTitle?: string,
  ): Effect.Effect<AIProcessingResult, VideoAIProcessingError> =>
    Effect.gen(function* () {
      // Check if transcription service is available
      if (!transcription.isAvailable()) {
        return yield* Effect.fail(
          new VideoAIProcessingError({
            message: "Transcription service not available. Please configure OPENAI_API_KEY.",
            stage: "pending",
            videoId,
          }),
        );
      }

      // Update status to transcribing
      yield* updateProcessingStatus(videoId, "transcribing");

      // Transcribe the video
      const transcriptionResult = yield* pipe(
        transcription.transcribeFromUrl(videoUrl),
        Effect.mapError(
          (e) =>
            new VideoAIProcessingError({
              message: `Transcription failed: ${e.message}`,
              stage: "transcribing",
              videoId,
              cause: e,
            }),
        ),
      );

      // Save transcript
      yield* saveTranscript(videoId, transcriptionResult.transcript, transcriptionResult.segments);

      // Continue with AI analysis
      return yield* processFromTranscript(
        videoId,
        transcriptionResult.transcript,
        transcriptionResult.segments,
        videoTitle,
      );
    }).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          // Update status to failed
          const errorMessage = error instanceof VideoAIProcessingError ? error.message : String(error);
          yield* updateProcessingStatus(videoId, "failed", errorMessage);
          return yield* Effect.fail(error);
        }),
      ),
    );

  return {
    processVideo,
    processFromTranscript,
    updateProcessingStatus,
    getProcessingStatus,
  } satisfies VideoAIProcessorServiceInterface;
});

// =============================================================================
// Video AI Processor Layer
// =============================================================================

export const VideoAIProcessorLive = Layer.effect(VideoAIProcessor, makeVideoAIProcessorService);

// =============================================================================
// Video AI Processor Helper Functions
// =============================================================================

/**
 * Process a video with full AI analysis
 */
export const processVideoAI = (
  videoId: string,
  videoUrl: string,
  videoTitle?: string,
): Effect.Effect<AIProcessingResult, VideoAIProcessingError, VideoAIProcessor> =>
  Effect.gen(function* () {
    const processor = yield* VideoAIProcessor;
    return yield* processor.processVideo(videoId, videoUrl, videoTitle);
  });

/**
 * Process from existing transcript
 */
export const processFromTranscript = (
  videoId: string,
  transcript: string,
  segments: ReadonlyArray<TranscriptSegment>,
  videoTitle?: string,
): Effect.Effect<AIProcessingResult, VideoAIProcessingError, VideoAIProcessor> =>
  Effect.gen(function* () {
    const processor = yield* VideoAIProcessor;
    return yield* processor.processFromTranscript(videoId, transcript, segments, videoTitle);
  });

/**
 * Update video processing status
 */
export const updateVideoProcessingStatus = (
  videoId: string,
  status: ProcessingStatus,
  error?: string,
): Effect.Effect<void, VideoAIProcessingError, VideoAIProcessor> =>
  Effect.gen(function* () {
    const processor = yield* VideoAIProcessor;
    return yield* processor.updateProcessingStatus(videoId, status, error);
  });

/**
 * Get video processing status
 */
export const getVideoProcessingStatus = (
  videoId: string,
): Effect.Effect<{ status: ProcessingStatus; error?: string | null }, VideoAIProcessingError, VideoAIProcessor> =>
  Effect.gen(function* () {
    const processor = yield* VideoAIProcessor;
    return yield* processor.getProcessingStatus(videoId);
  });
