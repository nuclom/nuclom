/**
 * AI Service using Effect-TS
 *
 * Provides type-safe AI operations for video analysis and summaries.
 * Uses Vercel AI SDK with XAI Grok-3 model.
 */

import { gateway } from "@ai-sdk/gateway";
import { generateText, streamText } from "ai";
import { Context, Effect, Layer, pipe, Stream } from "effect";
import { AIServiceError } from "../errors";
import type { TranscriptSegment, ActionItem } from "@/lib/db/schema";

// =============================================================================
// Types
// =============================================================================

export interface VideoSummary {
  readonly summary: string;
  readonly keyPoints: ReadonlyArray<string>;
  readonly actionItems: ReadonlyArray<string>;
}

export interface ChapterResult {
  readonly title: string;
  readonly summary?: string;
  readonly startTime: number;
  readonly endTime?: number;
}

export interface CodeSnippetResult {
  readonly language: string | null;
  readonly code: string;
  readonly title?: string;
  readonly description?: string;
  readonly timestamp?: number;
}

export interface ActionItemResult {
  readonly text: string;
  readonly timestamp?: number;
  readonly priority?: "high" | "medium" | "low";
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
   * Extract action items from transcript with timestamps
   */
  readonly extractActionItems: (transcript: string) => Effect.Effect<ReadonlyArray<string>, AIServiceError>;

  /**
   * Extract structured action items from transcript segments
   */
  readonly extractActionItemsWithTimestamps: (
    segments: ReadonlyArray<TranscriptSegment>,
  ) => Effect.Effect<ReadonlyArray<ActionItemResult>, AIServiceError>;

  /**
   * Detect and extract code snippets from transcript
   */
  readonly detectCodeSnippets: (
    transcript: string,
    segments?: ReadonlyArray<TranscriptSegment>,
  ) => Effect.Effect<ReadonlyArray<CodeSnippetResult>, AIServiceError>;

  /**
   * Generate chapters/key moments from transcript segments
   */
  readonly generateChapters: (
    segments: ReadonlyArray<TranscriptSegment>,
    videoTitle?: string,
  ) => Effect.Effect<ReadonlyArray<ChapterResult>, AIServiceError>;

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

  const extractActionItemsWithTimestamps = (
    segments: ReadonlyArray<TranscriptSegment>,
  ): Effect.Effect<ReadonlyArray<ActionItemResult>, AIServiceError> =>
    pipe(
      Effect.tryPromise({
        try: async () => {
          // Format segments with timestamps for context
          const formattedTranscript = segments
            .map((seg) => `[${formatTime(seg.startTime)}] ${seg.text}`)
            .join("\n");

          const { text } = await generateText({
            model,
            prompt: `Analyze this timestamped transcript and extract action items, tasks, or to-dos.
For each action item, include the approximate timestamp where it was mentioned.

Transcript:
${formattedTranscript}

Return the response as JSON array with this format:
[
  { "text": "Action item description", "timestamp": 120, "priority": "high" },
  { "text": "Another action item", "timestamp": 300, "priority": "medium" }
]

Priority should be "high", "medium", or "low" based on urgency.
If no action items are found, return an empty array: []`,
          });

          try {
            // Extract JSON from response (handle potential markdown code blocks)
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              return JSON.parse(jsonMatch[0]) as ActionItemResult[];
            }
            return [];
          } catch {
            return [];
          }
        },
        catch: (error) =>
          new AIServiceError({
            message: "Failed to extract action items with timestamps",
            operation: "extractActionItemsWithTimestamps",
            cause: error,
          }),
      }),
      Effect.catchAll(() => Effect.succeed([] as ReadonlyArray<ActionItemResult>)),
    );

  const detectCodeSnippets = (
    transcript: string,
    segments?: ReadonlyArray<TranscriptSegment>,
  ): Effect.Effect<ReadonlyArray<CodeSnippetResult>, AIServiceError> =>
    pipe(
      Effect.tryPromise({
        try: async () => {
          const formattedTranscript = segments
            ? segments.map((seg) => `[${formatTime(seg.startTime)}] ${seg.text}`).join("\n")
            : transcript;

          const { text } = await generateText({
            model,
            prompt: `Analyze this transcript and detect any code snippets, commands, or technical code that was mentioned or dictated.

Transcript:
${formattedTranscript}

For each code snippet found:
1. Reconstruct the actual code from what was spoken
2. Identify the programming language
3. Provide a brief title and description
4. Include the timestamp if available

Return as JSON array:
[
  {
    "language": "javascript",
    "code": "function example() { return true; }",
    "title": "Example function",
    "description": "A simple example function",
    "timestamp": 120
  }
]

Common patterns to look for:
- "npm install", "pip install", "cargo add" (package manager commands)
- Function definitions, class declarations
- Variable assignments
- API calls, imports
- Configuration snippets
- Shell commands

If no code snippets are detected, return an empty array: []`,
          });

          try {
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              return JSON.parse(jsonMatch[0]) as CodeSnippetResult[];
            }
            return [];
          } catch {
            return [];
          }
        },
        catch: (error) =>
          new AIServiceError({
            message: "Failed to detect code snippets",
            operation: "detectCodeSnippets",
            cause: error,
          }),
      }),
      Effect.catchAll(() => Effect.succeed([] as ReadonlyArray<CodeSnippetResult>)),
    );

  const generateChapters = (
    segments: ReadonlyArray<TranscriptSegment>,
    videoTitle?: string,
  ): Effect.Effect<ReadonlyArray<ChapterResult>, AIServiceError> =>
    pipe(
      Effect.tryPromise({
        try: async () => {
          if (segments.length === 0) {
            return [];
          }

          const formattedTranscript = segments
            .map((seg) => `[${formatTime(seg.startTime)}] ${seg.text}`)
            .join("\n");

          const totalDuration = Math.max(...segments.map((s) => s.endTime));

          const { text } = await generateText({
            model,
            prompt: `Analyze this timestamped transcript and generate chapters (key moments) for the video.
${videoTitle ? `Video title: "${videoTitle}"` : ""}

Transcript (total duration: ${formatTime(totalDuration)}):
${formattedTranscript}

Create 3-8 logical chapters based on topic changes, key moments, or natural section breaks.
Each chapter should:
- Have a concise, descriptive title
- Include a brief summary (1-2 sentences)
- Have accurate start/end timestamps

Return as JSON array:
[
  {
    "title": "Introduction",
    "summary": "Overview of what the video covers",
    "startTime": 0,
    "endTime": 120
  },
  {
    "title": "Main Topic",
    "summary": "Deep dive into the core content",
    "startTime": 120,
    "endTime": 360
  }
]

Ensure chapters cover the entire video duration without gaps.`,
          });

          try {
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              return JSON.parse(jsonMatch[0]) as ChapterResult[];
            }
            return [];
          } catch {
            return [];
          }
        },
        catch: (error) =>
          new AIServiceError({
            message: "Failed to generate chapters",
            operation: "generateChapters",
            cause: error,
          }),
      }),
      Effect.catchAll(() => Effect.succeed([] as ReadonlyArray<ChapterResult>)),
    );

  return {
    generateVideoSummary,
    generateVideoTags,
    extractActionItems,
    extractActionItemsWithTimestamps,
    detectCodeSnippets,
    generateChapters,
    createSummaryStream,
  } satisfies AIServiceInterface;
});

// Helper function to format seconds to MM:SS or HH:MM:SS
const formatTime = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

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

/**
 * Extract action items with timestamps from transcript segments
 */
export const extractActionItemsWithTimestamps = (
  segments: ReadonlyArray<TranscriptSegment>,
): Effect.Effect<ReadonlyArray<ActionItemResult>, AIServiceError, AI> =>
  Effect.gen(function* () {
    const ai = yield* AI;
    return yield* ai.extractActionItemsWithTimestamps(segments);
  });

/**
 * Detect code snippets from transcript
 */
export const detectCodeSnippets = (
  transcript: string,
  segments?: ReadonlyArray<TranscriptSegment>,
): Effect.Effect<ReadonlyArray<CodeSnippetResult>, AIServiceError, AI> =>
  Effect.gen(function* () {
    const ai = yield* AI;
    return yield* ai.detectCodeSnippets(transcript, segments);
  });

/**
 * Generate chapters from transcript segments
 */
export const generateChapters = (
  segments: ReadonlyArray<TranscriptSegment>,
  videoTitle?: string,
): Effect.Effect<ReadonlyArray<ChapterResult>, AIServiceError, AI> =>
  Effect.gen(function* () {
    const ai = yield* AI;
    return yield* ai.generateChapters(segments, videoTitle);
  });
