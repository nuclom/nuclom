/**
 * AI Service with Structured Outputs using Effect-TS and Effect Schema
 *
 * Provides type-safe AI operations with guaranteed structured outputs.
 * Uses Vercel AI SDK with XAI Grok-3 model and Effect schemas for validation.
 */

import { gateway } from "@ai-sdk/gateway";
import { generateObject, generateText, jsonSchema, streamText } from "ai";
import { Context, Effect, JSONSchema, Layer, Schedule, Schema, Stream } from "effect";
import type { TranscriptSegment } from "@/lib/db/schema";
import { AIServiceError } from "../errors";

// =============================================================================
// Effect Schemas for Structured AI Outputs
// =============================================================================

export const VideoSummarySchema = Schema.Struct({
  summary: Schema.String.annotations({ description: "A concise 2-3 sentence summary of the video content" }),
  keyPoints: Schema.Array(Schema.String).pipe(
    Schema.minItems(1),
    Schema.maxItems(10),
    Schema.annotations({ description: "Key points discussed in the video" }),
  ),
  actionItems: Schema.Array(Schema.String).annotations({ description: "Action items or tasks mentioned in the video" }),
  topics: Schema.Array(Schema.String).pipe(
    Schema.maxItems(5),
    Schema.annotations({ description: "Main topics covered in the video" }),
  ),
  sentiment: Schema.Literal("positive", "neutral", "negative", "mixed").annotations({
    description: "Overall sentiment of the content",
  }),
});

export const ActionItemSchema = Schema.Struct({
  text: Schema.String.annotations({ description: "Description of the action item" }),
  timestamp: Schema.optional(Schema.Number).annotations({ description: "Timestamp in seconds where this was mentioned" }),
  priority: Schema.Literal("high", "medium", "low").annotations({ description: "Priority level based on urgency" }),
  assignee: Schema.optional(Schema.String).annotations({ description: "Person assigned if mentioned" }),
  dueDate: Schema.optional(Schema.String).annotations({ description: "Due date if mentioned" }),
});

export const ActionItemsSchema = Schema.Struct({
  actionItems: Schema.Array(ActionItemSchema).annotations({
    description: "List of action items extracted from the transcript",
  }),
  hasDeadlines: Schema.Boolean.annotations({ description: "Whether any action items have explicit deadlines" }),
  totalCount: Schema.Number.annotations({ description: "Total number of action items found" }),
});

export const ChapterSchema = Schema.Struct({
  title: Schema.String.pipe(Schema.maxLength(100)).annotations({ description: "Chapter title" }),
  summary: Schema.optional(Schema.String.pipe(Schema.maxLength(500))).annotations({
    description: "Brief summary of the chapter",
  }),
  startTime: Schema.Number.annotations({ description: "Start time in seconds" }),
  endTime: Schema.optional(Schema.Number).annotations({ description: "End time in seconds" }),
  keyMoments: Schema.optional(Schema.Array(Schema.String).pipe(Schema.maxItems(3))).annotations({
    description: "Key moments in this chapter",
  }),
});

export const ChaptersSchema = Schema.Struct({
  chapters: Schema.Array(ChapterSchema).pipe(
    Schema.minItems(1),
    Schema.maxItems(15),
    Schema.annotations({ description: "Video chapters" }),
  ),
  totalDuration: Schema.Number.annotations({ description: "Total video duration in seconds" }),
});

const ProgrammingLanguage = Schema.Literal(
  "javascript",
  "typescript",
  "python",
  "rust",
  "go",
  "java",
  "csharp",
  "cpp",
  "ruby",
  "php",
  "swift",
  "kotlin",
  "shell",
  "sql",
  "html",
  "css",
  "json",
  "yaml",
  "markdown",
  "other",
);

export const CodeSnippetSchema = Schema.Struct({
  language: ProgrammingLanguage.annotations({ description: "Programming language" }),
  code: Schema.String.annotations({ description: "The code snippet" }),
  title: Schema.optional(Schema.String.pipe(Schema.maxLength(100))).annotations({
    description: "Title describing what the code does",
  }),
  description: Schema.optional(Schema.String.pipe(Schema.maxLength(500))).annotations({
    description: "Explanation of the code",
  }),
  timestamp: Schema.optional(Schema.Number).annotations({
    description: "Timestamp in seconds where this code was mentioned",
  }),
  context: Schema.optional(Schema.String).annotations({ description: "Context or use case for this code" }),
});

export const CodeSnippetsSchema = Schema.Struct({
  snippets: Schema.Array(CodeSnippetSchema).annotations({ description: "Code snippets detected in the transcript" }),
  primaryLanguage: Schema.optional(Schema.String).annotations({
    description: "The primary programming language discussed",
  }),
  hasCommands: Schema.Boolean.annotations({ description: "Whether any terminal/CLI commands were detected" }),
});

const VideoCategory = Schema.Literal(
  "tutorial",
  "demo",
  "presentation",
  "meeting",
  "interview",
  "review",
  "announcement",
  "discussion",
  "other",
);

const TechnicalLevel = Schema.Literal("beginner", "intermediate", "advanced", "expert");

export const VideoTagsSchema = Schema.Struct({
  tags: Schema.Array(Schema.String).pipe(
    Schema.minItems(3),
    Schema.maxItems(10),
    Schema.annotations({ description: "Relevant tags for the video" }),
  ),
  category: VideoCategory.annotations({ description: "Primary category of the video" }),
  technicalLevel: Schema.optional(TechnicalLevel).annotations({ description: "Technical level of the content" }),
});

// =============================================================================
// Types derived from Effect schemas
// =============================================================================

export type VideoSummary = typeof VideoSummarySchema.Type;
export type ActionItemResult = typeof ActionItemSchema.Type;
export type ActionItemsResult = typeof ActionItemsSchema.Type;
export type ChapterResult = typeof ChapterSchema.Type;
export type ChaptersResult = typeof ChaptersSchema.Type;
export type CodeSnippetResult = typeof CodeSnippetSchema.Type;
export type CodeSnippetsResult = typeof CodeSnippetsSchema.Type;
export type VideoTagsResult = typeof VideoTagsSchema.Type;

// =============================================================================
// JSON Schema conversions for AI SDK
// =============================================================================

const videoSummaryJsonSchema = jsonSchema(JSONSchema.make(VideoSummarySchema));
const actionItemsJsonSchema = jsonSchema(JSONSchema.make(ActionItemsSchema));
const chaptersJsonSchema = jsonSchema(JSONSchema.make(ChaptersSchema));
const codeSnippetsJsonSchema = jsonSchema(JSONSchema.make(CodeSnippetsSchema));
const videoTagsJsonSchema = jsonSchema(JSONSchema.make(VideoTagsSchema));

// =============================================================================
// Service Interface
// =============================================================================

export interface AIStructuredServiceInterface {
  /**
   * Generate a structured video summary with key points and action items
   */
  readonly generateVideoSummary: (transcript: string) => Effect.Effect<VideoSummary, AIServiceError>;

  /**
   * Generate structured tags and category for a video
   */
  readonly generateVideoTags: (
    title: string,
    description?: string,
    transcript?: string,
  ) => Effect.Effect<VideoTagsResult, AIServiceError>;

  /**
   * Extract structured action items with timestamps and priorities
   */
  readonly extractActionItems: (
    segments: ReadonlyArray<TranscriptSegment>,
  ) => Effect.Effect<ActionItemsResult, AIServiceError>;

  /**
   * Detect and extract code snippets with language detection
   */
  readonly detectCodeSnippets: (
    transcript: string,
    segments?: ReadonlyArray<TranscriptSegment>,
  ) => Effect.Effect<CodeSnippetsResult, AIServiceError>;

  /**
   * Generate structured chapters with summaries
   */
  readonly generateChapters: (
    segments: ReadonlyArray<TranscriptSegment>,
    videoTitle?: string,
    totalDuration?: number,
  ) => Effect.Effect<ChaptersResult, AIServiceError>;

  /**
   * Create a streaming summary for real-time display
   */
  readonly createSummaryStream: (transcript: string) => Stream.Stream<string, AIServiceError>;

  /**
   * Generate simple text summary (for backwards compatibility)
   */
  readonly generateSimpleSummary: (transcript: string) => Effect.Effect<string, AIServiceError>;
}

// =============================================================================
// AI Structured Service Tag
// =============================================================================

export class AIStructured extends Context.Tag("AIStructured")<AIStructured, AIStructuredServiceInterface>() {}

// =============================================================================
// Retry Policy
// =============================================================================

const retryPolicy = Schedule.exponential("1 second").pipe(
  Schedule.union(Schedule.spaced("500 millis")),
  Schedule.upTo("30 seconds"),
  Schedule.jittered,
);

// =============================================================================
// AI Structured Service Implementation
// =============================================================================

const makeAIStructuredService = Effect.gen(function* () {
  const model = gateway("xai/grok-3");

  // Helper to format time
  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const generateVideoSummary = (transcript: string): Effect.Effect<VideoSummary, AIServiceError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await generateObject({
          model,
          schema: videoSummaryJsonSchema,
          prompt: `Analyze this video transcript and provide a structured summary.

Transcript:
${transcript.slice(0, 15000)}

Provide:
1. A concise 2-3 sentence summary
2. Key points (3-10 items)
3. Any action items mentioned
4. Main topics covered (up to 5)
5. Overall sentiment of the content`,
        });
        return Schema.decodeUnknownSync(VideoSummarySchema)(result.object);
      },
      catch: (error) =>
        new AIServiceError({
          message: "Failed to generate structured video summary",
          operation: "generateVideoSummary",
          cause: error,
        }),
    }).pipe(Effect.retry(retryPolicy));

  const generateVideoTags = (
    title: string,
    description?: string,
    transcript?: string,
  ): Effect.Effect<VideoTagsResult, AIServiceError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await generateObject({
          model,
          schema: videoTagsJsonSchema,
          prompt: `Generate relevant tags and categorization for this video.

Title: ${title}
${description ? `Description: ${description}` : ""}
${transcript ? `Transcript excerpt: ${transcript.slice(0, 2000)}` : ""}

Provide:
1. 3-10 relevant tags for discoverability
2. The primary category of this content
3. Technical level if applicable`,
        });
        return Schema.decodeUnknownSync(VideoTagsSchema)(result.object);
      },
      catch: (error) =>
        new AIServiceError({
          message: "Failed to generate video tags",
          operation: "generateVideoTags",
          cause: error,
        }),
    }).pipe(
      Effect.retry(retryPolicy),
      Effect.catchAll(() =>
        Effect.succeed({
          tags: [],
          category: "other" as const,
        }),
      ),
    );

  const extractActionItems = (
    segments: ReadonlyArray<TranscriptSegment>,
  ): Effect.Effect<ActionItemsResult, AIServiceError> =>
    Effect.tryPromise({
      try: async () => {
        const formattedTranscript = segments
          .map((seg) => `[${formatTime(seg.startTime)}] ${seg.text}`)
          .join("\n");

        const result = await generateObject({
          model,
          schema: actionItemsJsonSchema,
          prompt: `Extract all action items, tasks, and to-dos from this timestamped transcript.

Transcript:
${formattedTranscript}

For each action item:
1. Describe the task clearly
2. Include the timestamp where it was mentioned
3. Assign priority based on urgency indicators (words like "urgent", "ASAP", "important")
4. Note any assignees or due dates mentioned`,
        });
        return Schema.decodeUnknownSync(ActionItemsSchema)(result.object);
      },
      catch: (error) =>
        new AIServiceError({
          message: "Failed to extract action items",
          operation: "extractActionItems",
          cause: error,
        }),
    }).pipe(
      Effect.retry(retryPolicy),
      Effect.catchAll(() =>
        Effect.succeed({
          actionItems: [],
          hasDeadlines: false,
          totalCount: 0,
        }),
      ),
    );

  const detectCodeSnippets = (
    transcript: string,
    segments?: ReadonlyArray<TranscriptSegment>,
  ): Effect.Effect<CodeSnippetsResult, AIServiceError> =>
    Effect.tryPromise({
      try: async () => {
        const formattedTranscript = segments
          ? segments.map((seg) => `[${formatTime(seg.startTime)}] ${seg.text}`).join("\n")
          : transcript;

        const result = await generateObject({
          model,
          schema: codeSnippetsJsonSchema,
          prompt: `Detect and extract any code snippets, commands, or technical code mentioned in this transcript.

Transcript:
${formattedTranscript.slice(0, 10000)}

Look for:
1. Function definitions and class declarations
2. Variable assignments and API calls
3. Package manager commands (npm, pip, cargo, etc.)
4. Shell/CLI commands
5. Configuration snippets
6. Code that was dictated or explained

For each snippet:
- Reconstruct the actual code from spoken words
- Identify the programming language
- Provide a title and description
- Include the timestamp if available`,
        });
        return Schema.decodeUnknownSync(CodeSnippetsSchema)(result.object);
      },
      catch: (error) =>
        new AIServiceError({
          message: "Failed to detect code snippets",
          operation: "detectCodeSnippets",
          cause: error,
        }),
    }).pipe(
      Effect.retry(retryPolicy),
      Effect.catchAll(() =>
        Effect.succeed({
          snippets: [],
          hasCommands: false,
        }),
      ),
    );

  const generateChapters = (
    segments: ReadonlyArray<TranscriptSegment>,
    videoTitle?: string,
    totalDuration?: number,
  ): Effect.Effect<ChaptersResult, AIServiceError> =>
    Effect.tryPromise({
      try: async () => {
        if (segments.length === 0) {
          return {
            chapters: [],
            totalDuration: 0,
          };
        }

        const formattedTranscript = segments
          .map((seg) => `[${formatTime(seg.startTime)}] ${seg.text}`)
          .join("\n");

        const duration = totalDuration || Math.max(...segments.map((s) => s.endTime));

        const result = await generateObject({
          model,
          schema: chaptersJsonSchema,
          prompt: `Generate chapters (key moments) for this video based on the transcript.
${videoTitle ? `Video title: "${videoTitle}"` : ""}

Transcript (total duration: ${formatTime(duration)}):
${formattedTranscript}

Create 3-12 logical chapters:
1. Each chapter should cover a distinct topic or section
2. Include accurate start/end timestamps
3. Provide a concise title (max 100 chars)
4. Add a brief summary explaining what's covered
5. Identify 1-3 key moments per chapter

Ensure chapters cover the entire video without gaps.`,
        });
        return Schema.decodeUnknownSync(ChaptersSchema)(result.object);
      },
      catch: (error) =>
        new AIServiceError({
          message: "Failed to generate chapters",
          operation: "generateChapters",
          cause: error,
        }),
    }).pipe(
      Effect.retry(retryPolicy),
      Effect.catchAll(() =>
        Effect.succeed({
          chapters: [],
          totalDuration: 0,
        }),
      ),
    );

  const createSummaryStream = (transcript: string): Stream.Stream<string, AIServiceError> =>
    Stream.async<string, AIServiceError>((emit) => {
      const run = async () => {
        try {
          const result = streamText({
            model,
            prompt: `Analyze this video transcript and provide real-time insights:

${transcript.slice(0, 15000)}

Format your response with clear sections for:
- Summary
- Key Points
- Action Items (if any)
- Topics Covered`,
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

  const generateSimpleSummary = (transcript: string): Effect.Effect<string, AIServiceError> =>
    Effect.tryPromise({
      try: async () => {
        const { text } = await generateText({
          model,
          prompt: `Analyze this video transcript and provide a concise summary with key points and action items:

${transcript.slice(0, 15000)}

Format:
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
          message: "Failed to generate summary",
          operation: "generateSimpleSummary",
          cause: error,
        }),
    }).pipe(Effect.retry(retryPolicy));

  return {
    generateVideoSummary,
    generateVideoTags,
    extractActionItems,
    detectCodeSnippets,
    generateChapters,
    createSummaryStream,
    generateSimpleSummary,
  } satisfies AIStructuredServiceInterface;
});

// =============================================================================
// AI Structured Layer
// =============================================================================

export const AIStructuredLive = Layer.effect(AIStructured, makeAIStructuredService);

// =============================================================================
// Helper Functions
// =============================================================================

export const generateStructuredVideoSummary = (
  transcript: string,
): Effect.Effect<VideoSummary, AIServiceError, AIStructured> =>
  Effect.gen(function* () {
    const ai = yield* AIStructured;
    return yield* ai.generateVideoSummary(transcript);
  });

export const generateStructuredVideoTags = (
  title: string,
  description?: string,
  transcript?: string,
): Effect.Effect<VideoTagsResult, AIServiceError, AIStructured> =>
  Effect.gen(function* () {
    const ai = yield* AIStructured;
    return yield* ai.generateVideoTags(title, description, transcript);
  });

export const extractStructuredActionItems = (
  segments: ReadonlyArray<TranscriptSegment>,
): Effect.Effect<ActionItemsResult, AIServiceError, AIStructured> =>
  Effect.gen(function* () {
    const ai = yield* AIStructured;
    return yield* ai.extractActionItems(segments);
  });

export const detectStructuredCodeSnippets = (
  transcript: string,
  segments?: ReadonlyArray<TranscriptSegment>,
): Effect.Effect<CodeSnippetsResult, AIServiceError, AIStructured> =>
  Effect.gen(function* () {
    const ai = yield* AIStructured;
    return yield* ai.detectCodeSnippets(transcript, segments);
  });

export const generateStructuredChapters = (
  segments: ReadonlyArray<TranscriptSegment>,
  videoTitle?: string,
  totalDuration?: number,
): Effect.Effect<ChaptersResult, AIServiceError, AIStructured> =>
  Effect.gen(function* () {
    const ai = yield* AIStructured;
    return yield* ai.generateChapters(segments, videoTitle, totalDuration);
  });
