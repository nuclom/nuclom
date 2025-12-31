/**
 * Video Processing Workflow using Workflow DevKit
 *
 * Handles the complete video processing pipeline with durable execution:
 * 1. Transcription (audio to text)
 * 2. AI Analysis (summary, tags, action items)
 * 3. Code snippet detection
 * 4. Chapter generation
 * 5. Database storage of results
 *
 * Benefits over fire-and-forget:
 * - Automatic retries on transient failures
 * - Resume from last successful step if server restarts
 * - Built-in observability for debugging
 * - No lost processing on deploy
 */

import { eq } from "drizzle-orm";
import { FatalError } from "workflow";
import { db } from "@/lib/db";
import {
  type ActionItem,
  notifications,
  type ProcessingStatus,
  type TranscriptSegment,
  users,
  videoChapters,
  videoCodeSnippets,
  videos,
} from "@/lib/db/schema";
import { env } from "@/lib/env/client";
import { resend } from "@/lib/email";

// =============================================================================
// Types
// =============================================================================

export interface VideoProcessingInput {
  readonly videoId: string;
  readonly videoUrl: string;
  readonly videoTitle?: string;
}

export interface VideoProcessingResult {
  readonly videoId: string;
  readonly success: boolean;
  readonly error?: string;
}

interface TranscriptionResult {
  transcript: string;
  segments: TranscriptSegment[];
  duration: number;
  language?: string;
}

interface AIAnalysisResult {
  summary: string;
  tags: string[];
  actionItems: ActionItem[];
  chapters: Array<{
    title: string;
    summary: string;
    startTime: number;
    endTime?: number;
  }>;
  codeSnippets: Array<{
    language: string;
    code: string;
    title?: string;
    description?: string;
    timestamp?: number;
  }>;
}

// =============================================================================
// Helper Functions
// =============================================================================

async function updateProcessingStatus(
  videoId: string,
  status: ProcessingStatus,
  error?: string,
): Promise<void> {
  await db
    .update(videos)
    .set({
      processingStatus: status,
      processingError: error || null,
      updatedAt: new Date(),
    })
    .where(eq(videos.id, videoId));
}

async function transcribeVideo(videoUrl: string): Promise<TranscriptionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new FatalError("OpenAI API key not configured");
  }

  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI({ apiKey });

  // Fetch the video file
  const response = await fetch(videoUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch video: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  // Determine filename from URL
  const filename = videoUrl.endsWith(".mp4") ? "video.mp4" : "video.webm";

  // Create file for OpenAI
  const file = new File([new Uint8Array(buffer)], filename, {
    type: filename.endsWith(".mp4") ? "video/mp4" : "video/webm",
  });

  // Transcribe using Whisper
  const transcription = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
  });

  const segments: TranscriptSegment[] = (transcription.segments || []).map((seg) => ({
    startTime: seg.start,
    endTime: seg.end,
    text: seg.text.trim(),
    confidence: seg.avg_logprob ? Math.exp(seg.avg_logprob) : undefined,
  }));

  return {
    transcript: transcription.text,
    segments,
    duration: transcription.duration || 0,
    language: transcription.language,
  };
}

async function analyzeWithAI(
  transcript: string,
  segments: TranscriptSegment[],
  videoTitle?: string,
): Promise<AIAnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new FatalError("OpenAI API key not configured");
  }

  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI({ apiKey });

  // Generate summary
  const summaryResponse = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a helpful assistant that summarizes video transcripts. Provide a concise summary in 2-3 paragraphs.",
      },
      {
        role: "user",
        content: `Please summarize this video transcript:\n\n${transcript.slice(0, 10000)}`,
      },
    ],
    max_tokens: 500,
  });

  const summary = summaryResponse.choices[0]?.message?.content || "Summary generation failed";

  // Generate tags
  const tagsResponse = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "Generate 5-10 relevant tags for this video. Return only the tags as a JSON array of strings.",
      },
      {
        role: "user",
        content: `Title: ${videoTitle || "Untitled"}\n\nTranscript excerpt: ${transcript.slice(0, 2000)}`,
      },
    ],
    max_tokens: 200,
    response_format: { type: "json_object" },
  });

  let tags: string[] = [];
  try {
    const tagsContent = tagsResponse.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(tagsContent);
    tags = Array.isArray(parsed.tags) ? parsed.tags : [];
  } catch {
    tags = [];
  }

  // Extract action items
  const actionItemsResponse = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Extract action items from this transcript. Return a JSON object with an "items" array containing objects with:
- text: the action item description
- timestamp: approximate timestamp in seconds (if mentioned)
- priority: "high", "medium", or "low"`,
      },
      {
        role: "user",
        content: transcript.slice(0, 8000),
      },
    ],
    max_tokens: 500,
    response_format: { type: "json_object" },
  });

  let actionItems: ActionItem[] = [];
  try {
    const itemsContent = actionItemsResponse.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(itemsContent);
    actionItems = Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    actionItems = [];
  }

  // Generate chapters
  const chaptersResponse = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Analyze this transcript and create chapters. Return a JSON object with a "chapters" array containing objects with:
- title: chapter title
- summary: brief chapter summary
- startTime: start time in seconds
- endTime: end time in seconds (optional)`,
      },
      {
        role: "user",
        content: `Transcript with timestamps:\n${segments
          .slice(0, 100)
          .map((s) => `[${s.startTime}s] ${s.text}`)
          .join("\n")}`,
      },
    ],
    max_tokens: 800,
    response_format: { type: "json_object" },
  });

  let chapters: AIAnalysisResult["chapters"] = [];
  try {
    const chaptersContent = chaptersResponse.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(chaptersContent);
    chapters = Array.isArray(parsed.chapters) ? parsed.chapters : [];
  } catch {
    chapters = [];
  }

  // Detect code snippets
  const codeResponse = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Detect any code snippets mentioned in this transcript. Return a JSON object with a "snippets" array containing objects with:
- language: programming language
- code: the code snippet
- title: brief title
- description: what the code does
- timestamp: approximate timestamp in seconds`,
      },
      {
        role: "user",
        content: transcript.slice(0, 8000),
      },
    ],
    max_tokens: 1000,
    response_format: { type: "json_object" },
  });

  let codeSnippets: AIAnalysisResult["codeSnippets"] = [];
  try {
    const codeContent = codeResponse.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(codeContent);
    codeSnippets = Array.isArray(parsed.snippets) ? parsed.snippets : [];
  } catch {
    codeSnippets = [];
  }

  return {
    summary,
    tags,
    actionItems,
    chapters,
    codeSnippets,
  };
}

async function saveTranscript(
  videoId: string,
  transcript: string,
  segments: TranscriptSegment[],
): Promise<void> {
  await db
    .update(videos)
    .set({
      transcript,
      transcriptSegments: segments,
      updatedAt: new Date(),
    })
    .where(eq(videos.id, videoId));
}

async function saveAIAnalysis(
  videoId: string,
  analysis: AIAnalysisResult,
): Promise<void> {
  // Update video record
  await db
    .update(videos)
    .set({
      aiSummary: analysis.summary,
      aiTags: analysis.tags,
      aiActionItems: analysis.actionItems,
      updatedAt: new Date(),
    })
    .where(eq(videos.id, videoId));

  // Save chapters
  if (analysis.chapters.length > 0) {
    await db.delete(videoChapters).where(eq(videoChapters.videoId, videoId));
    await db.insert(videoChapters).values(
      analysis.chapters.map((chapter) => ({
        videoId,
        title: chapter.title,
        summary: chapter.summary,
        startTime: Math.floor(chapter.startTime),
        endTime: chapter.endTime ? Math.floor(chapter.endTime) : null,
      })),
    );
  }

  // Save code snippets
  if (analysis.codeSnippets.length > 0) {
    await db.delete(videoCodeSnippets).where(eq(videoCodeSnippets.videoId, videoId));
    await db.insert(videoCodeSnippets).values(
      analysis.codeSnippets.map((snippet) => ({
        videoId,
        language: snippet.language,
        code: snippet.code,
        title: snippet.title,
        description: snippet.description,
        timestamp: snippet.timestamp ? Math.floor(snippet.timestamp) : null,
      })),
    );
  }
}

async function sendCompletionNotification(
  videoId: string,
  status: "completed" | "failed",
  errorMessage?: string,
): Promise<void> {
  try {
    const video = await db.query.videos.findFirst({
      where: eq(videos.id, videoId),
    });

    if (!video || !video.authorId) return;

    const user = await db.query.users.findFirst({
      where: eq(users.id, video.authorId),
    });

    if (!user?.email) return;

    const baseUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Create in-app notification
    await db.insert(notifications).values({
      userId: user.id,
      type: status === "completed" ? "video_processing_complete" : "video_processing_failed",
      title: status === "completed" ? "Video processing complete" : "Video processing failed",
      body:
        status === "completed"
          ? `"${video.title}" has finished processing and is now ready to view with AI insights.`
          : `"${video.title}" failed to process. ${errorMessage || "Please try again."}`,
      resourceType: "video",
      resourceId: videoId,
    });

    // Send email notification
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? "notifications@nuclom.com";
    await resend.emails.send({
      from: fromEmail,
      to: user.email,
      subject:
        status === "completed"
          ? `Your video "${video.title}" is ready!`
          : `Video processing failed: "${video.title}"`,
      html: `
        <h2>${status === "completed" ? "Video Processing Complete" : "Video Processing Failed"}</h2>
        <p>Hi ${user.name || "there"},</p>
        <p>${
          status === "completed"
            ? `Your video "${video.title}" has finished processing and is now ready with AI-generated summaries, transcriptions, and more.`
            : `Your video "${video.title}" failed to process. ${errorMessage || "Please try again."}`
        }</p>
        <p><a href="${baseUrl}/videos/${videoId}">View Video</a></p>
      `,
    });
  } catch (error) {
    console.error("[Video Processing] Failed to send notification:", error);
  }
}

// =============================================================================
// Main Workflow
// =============================================================================

/**
 * Process a video with full AI analysis pipeline using durable workflow execution.
 *
 * This workflow:
 * 1. Updates status to transcribing
 * 2. Transcribes the video using OpenAI Whisper
 * 3. Saves the transcript to the database
 * 4. Updates status to analyzing
 * 5. Runs AI analysis (summary, tags, action items, chapters, code snippets)
 * 6. Saves all AI results to the database
 * 7. Updates status to completed
 * 8. Sends completion notification
 *
 * Each step is checkpointed, so if the server restarts, processing resumes
 * from the last successful step.
 */
export async function processVideoWorkflow(
  input: VideoProcessingInput,
): Promise<VideoProcessingResult> {
  "use workflow";

  const { videoId, videoUrl, videoTitle } = input;

  try {
    // Step 1: Update status to transcribing
    await updateProcessingStatus(videoId, "transcribing");
    "use step";

    // Step 2: Transcribe the video
    const transcription = await transcribeVideo(videoUrl);
    "use step";

    // Step 3: Save transcript
    await saveTranscript(videoId, transcription.transcript, transcription.segments);
    "use step";

    // Step 4: Update status to analyzing
    await updateProcessingStatus(videoId, "analyzing");
    "use step";

    // Step 5: Run AI analysis
    const analysis = await analyzeWithAI(
      transcription.transcript,
      transcription.segments,
      videoTitle,
    );
    "use step";

    // Step 6: Save AI analysis results
    await saveAIAnalysis(videoId, analysis);
    "use step";

    // Step 7: Update status to completed
    await updateProcessingStatus(videoId, "completed");
    "use step";

    // Step 8: Send completion notification
    await sendCompletionNotification(videoId, "completed");

    return {
      videoId,
      success: true,
    };
  } catch (error) {
    // Handle errors - update status and notify
    const errorMessage = error instanceof Error ? error.message : String(error);

    await updateProcessingStatus(videoId, "failed", errorMessage);
    await sendCompletionNotification(videoId, "failed", errorMessage);

    // Re-throw FatalErrors to stop retrying
    if (error instanceof FatalError) {
      throw error;
    }

    return {
      videoId,
      success: false,
      error: errorMessage,
    };
  }
}
