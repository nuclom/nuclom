/**
 * AI Service using Effect-TS
 *
 * Provides type-safe AI operations for video analysis and summaries.
 * Uses Vercel AI SDK with XAI Grok-3 model.
 */

import { Effect, Context, Layer, Stream, Chunk, pipe } from "effect";
import { gateway } from "@ai-sdk/gateway";
import { generateText, streamText } from "ai";
import { AIServiceError } from "../errors";

// =============================================================================
// Types
// =============================================================================

export interface VideoSummary {
  readonly summary: string;
  readonly keyPoints: ReadonlyArray<string>;
  readonly actionItems: ReadonlyArray<string>;
}

export interface AIServiceInterface {
  /**
   * Generate a summary from video transcript
   */
  readonly generateVideoSummary: (transcript: string) => Effect.Effect<string, AIServiceError>;

  /**
   * Generate tags from video title and description
   */
  readonly generateVideoTags: (
    title: string,
    description?: string,
  ) => Effect.Effect<ReadonlyArray<string>, AIServiceError>;

  /**
   * Extract action items from transcript
   */
  readonly extractActionItems: (transcript: string) => Effect.Effect<ReadonlyArray<string>, AIServiceError>;

  /**
   * Create a streaming summary (returns Effect Stream)
   */
  readonly createSummaryStream: (transcript: string) => Stream.Stream<string, AIServiceError>;
}

// =============================================================================
// AI Service Tag
// =============================================================================

export class AI extends Context.Tag("AI")<AI, AIServiceInterface>() {}

// =============================================================================
// AI Service Implementation
// =============================================================================

const makeAIService = Effect.gen(function* () {
  const model = gateway("xai/grok-3");

  const generateVideoSummary = (transcript: string): Effect.Effect<string, AIServiceError> =>
    Effect.tryPromise({
      try: async () => {
        const { text } = await generateText({
          model,
          prompt: `Please analyze this video transcript and provide a concise summary with key points and action items:

${transcript}

Please format the response as:
## Summary
[Brief overview]

## Key Points
- [Point 1]
- [Point 2]
- [Point 3]

## Action Items
- [Action 1]
- [Action 2]`,
        });

        return text;
      },
      catch: (error) =>
        new AIServiceError({
          message: "Failed to generate video summary",
          operation: "generateVideoSummary",
          cause: error,
        }),
    });

  const generateVideoTags = (
    title: string,
    description?: string,
  ): Effect.Effect<ReadonlyArray<string>, AIServiceError> =>
    pipe(
      Effect.tryPromise({
        try: async () => {
          const { text } = await generateText({
            model,
            prompt: `Based on this video title and description, generate 5-8 relevant tags:

Title: ${title}
Description: ${description || "N/A"}

Return only the tags as a comma-separated list.`,
          });

          return text
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0);
        },
        catch: (error) =>
          new AIServiceError({
            message: "Failed to generate video tags",
            operation: "generateVideoTags",
            cause: error,
          }),
      }),
      // Fallback to empty array on error, matching original behavior
      Effect.catchAll(() => Effect.succeed([] as ReadonlyArray<string>)),
    );

  const extractActionItems = (transcript: string): Effect.Effect<ReadonlyArray<string>, AIServiceError> =>
    pipe(
      Effect.tryPromise({
        try: async () => {
          const { text } = await generateText({
            model,
            prompt: `Analyze this transcript and extract any action items, tasks, or to-dos mentioned:

${transcript}

Return each action item on a new line, or "None" if no action items are found.`,
          });

          const items = text.split("\n").filter((item) => item.trim() && !item.includes("None"));
          return items.map((item) => item.replace(/^[-*]\s*/, "").trim());
        },
        catch: (error) =>
          new AIServiceError({
            message: "Failed to extract action items",
            operation: "extractActionItems",
            cause: error,
          }),
      }),
      // Fallback to empty array on error, matching original behavior
      Effect.catchAll(() => Effect.succeed([] as ReadonlyArray<string>)),
    );

  const createSummaryStream = (transcript: string): Stream.Stream<string, AIServiceError> =>
    Stream.async<string, AIServiceError>((emit) => {
      const run = async () => {
        try {
          const result = streamText({
            model,
            prompt: `Analyze this video transcript and provide insights in real-time:

${transcript}`,
          });

          for await (const chunk of result.textStream) {
            emit.single(chunk);
          }
          emit.end();
        } catch (error) {
          emit.fail(
            new AIServiceError({
              message: "Failed to stream summary",
              operation: "createSummaryStream",
              cause: error,
            }),
          );
        }
      };

      run();
    });

  return {
    generateVideoSummary,
    generateVideoTags,
    extractActionItems,
    createSummaryStream,
  } satisfies AIServiceInterface;
});

// =============================================================================
// AI Layer
// =============================================================================

export const AILive = Layer.effect(AI, makeAIService);

// =============================================================================
// AI Helper Functions
// =============================================================================

/**
 * Generate a video summary
 */
export const generateVideoSummary = (transcript: string): Effect.Effect<string, AIServiceError, AI> =>
  Effect.gen(function* () {
    const ai = yield* AI;
    return yield* ai.generateVideoSummary(transcript);
  });

/**
 * Generate video tags
 */
export const generateVideoTags = (
  title: string,
  description?: string,
): Effect.Effect<ReadonlyArray<string>, AIServiceError, AI> =>
  Effect.gen(function* () {
    const ai = yield* AI;
    return yield* ai.generateVideoTags(title, description);
  });

/**
 * Extract action items from transcript
 */
export const extractActionItems = (transcript: string): Effect.Effect<ReadonlyArray<string>, AIServiceError, AI> =>
  Effect.gen(function* () {
    const ai = yield* AI;
    return yield* ai.extractActionItems(transcript);
  });

/**
 * Create a streaming summary
 */
export const createSummaryStream = (
  transcript: string,
): Effect.Effect<Stream.Stream<string, AIServiceError>, never, AI> =>
  Effect.gen(function* () {
    const ai = yield* AI;
    return ai.createSummaryStream(transcript);
  });
