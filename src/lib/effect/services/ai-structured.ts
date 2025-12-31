/**
 * AI Service with Structured Outputs using Effect-TS and Zod
 *
 * Provides type-safe AI operations with guaranteed structured outputs.
 * Uses Vercel AI SDK with XAI Grok-3 model and Zod schemas for validation.
 */

import { gateway } from "@ai-sdk/gateway";
import { generateObject, generateText, streamText } from "ai";
import { Context, Effect, Layer, Schedule, Stream } from "effect";
import { z } from "zod";
import type { TranscriptSegment } from "@/lib/db/schema";
import { AIServiceError } from "../errors";

// =============================================================================
// Zod Schemas for Structured AI Outputs
// =============================================================================

export const VideoSummarySchema = z.object({
  summary: z.string().describe("A concise 2-3 sentence summary of the video content"),
  keyPoints: z
    .array(z.string())
    .min(1)
    .max(10)
    .describe("Key points discussed in the video"),
  actionItems: z
    .array(z.string())
    .describe("Action items or tasks mentioned in the video"),
  topics: z
    .array(z.string())
    .max(5)
    .describe("Main topics covered in the video"),
  sentiment: z
    .enum(["positive", "neutral", "negative", "mixed"])
    .describe("Overall sentiment of the content"),
});

export const ActionItemSchema = z.object({
  text: z.string().describe("Description of the action item"),
  timestamp: z.number().optional().describe("Timestamp in seconds where this was mentioned"),
  priority: z.enum(["high", "medium", "low"]).describe("Priority level based on urgency"),
  assignee: z.string().optional().describe("Person assigned if mentioned"),
  dueDate: z.string().optional().describe("Due date if mentioned"),
});

export const ActionItemsSchema = z.object({
  actionItems: z.array(ActionItemSchema).describe("List of action items extracted from the transcript"),
  hasDeadlines: z.boolean().describe("Whether any action items have explicit deadlines"),
  totalCount: z.number().describe("Total number of action items found"),
});

export const ChapterSchema = z.object({
  title: z.string().max(100).describe("Chapter title"),
  summary: z.string().max(500).optional().describe("Brief summary of the chapter"),
  startTime: z.number().describe("Start time in seconds"),
  endTime: z.number().optional().describe("End time in seconds"),
  keyMoments: z.array(z.string()).max(3).optional().describe("Key moments in this chapter"),
});

export const ChaptersSchema = z.object({
  chapters: z.array(ChapterSchema).min(1).max(15).describe("Video chapters"),
  totalDuration: z.number().describe("Total video duration in seconds"),
});

export const CodeSnippetSchema = z.object({
  language: z
    .enum([
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
    ])
    .describe("Programming language"),
  code: z.string().describe("The code snippet"),
  title: z.string().max(100).optional().describe("Title describing what the code does"),
  description: z.string().max(500).optional().describe("Explanation of the code"),
  timestamp: z.number().optional().describe("Timestamp in seconds where this code was mentioned"),
  context: z.string().optional().describe("Context or use case for this code"),
});

export const CodeSnippetsSchema = z.object({
  snippets: z.array(CodeSnippetSchema).describe("Code snippets detected in the transcript"),
  primaryLanguage: z.string().optional().describe("The primary programming language discussed"),
  hasCommands: z.boolean().describe("Whether any terminal/CLI commands were detected"),
});

export const VideoTagsSchema = z.object({
  tags: z.array(z.string()).min(3).max(10).describe("Relevant tags for the video"),
  category: z
    .enum([
      "tutorial",
      "demo",
      "presentation",
      "meeting",
      "interview",
      "review",
      "announcement",
      "discussion",
      "other",
    ])
    .describe("Primary category of the video"),
  technicalLevel: z
    .enum(["beginner", "intermediate", "advanced", "expert"])
    .optional()
    .describe("Technical level of the content"),
});

// =============================================================================
// Types derived from Zod schemas
// =============================================================================

export type VideoSummary = z.infer<typeof VideoSummarySchema>;
export type ActionItemResult = z.infer<typeof ActionItemSchema>;
export type ActionItemsResult = z.infer<typeof ActionItemsSchema>;
export type ChapterResult = z.infer<typeof ChapterSchema>;
export type ChaptersResult = z.infer<typeof ChaptersSchema>;
export type CodeSnippetResult = z.infer<typeof CodeSnippetSchema>;
export type CodeSnippetsResult = z.infer<typeof CodeSnippetsSchema>;
export type VideoTagsResult = z.infer<typeof VideoTagsSchema>;

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
          schema: VideoSummarySchema,
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
        return result.object;
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
          schema: VideoTagsSchema,
          prompt: `Generate relevant tags and categorization for this video.

Title: ${title}
${description ? `Description: ${description}` : ""}
${transcript ? `Transcript excerpt: ${transcript.slice(0, 2000)}` : ""}

Provide:
1. 3-10 relevant tags for discoverability
2. The primary category of this content
3. Technical level if applicable`,
        });
        return result.object;
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
          schema: ActionItemsSchema,
          prompt: `Extract all action items, tasks, and to-dos from this timestamped transcript.

Transcript:
${formattedTranscript}

For each action item:
1. Describe the task clearly
2. Include the timestamp where it was mentioned
3. Assign priority based on urgency indicators (words like "urgent", "ASAP", "important")
4. Note any assignees or due dates mentioned`,
        });
        return result.object;
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
          schema: CodeSnippetsSchema,
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
        return result.object;
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
          schema: ChaptersSchema,
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
        return result.object;
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
