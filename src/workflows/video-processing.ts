/**
 * Video Processing Workflow using Workflow DevKit
 *
 * Handles the complete video processing pipeline with durable execution:
 * 1. Transcription (audio to text)
 * 2. AI Analysis (summary, tags, action items)
 * 3. Code snippet detection
 * 4. Chapter generation
 * 5. Decision extraction (knowledge graph)
 * 6. Database storage of results
 *
 * Benefits over fire-and-forget:
 * - Automatic retries on transient failures
 * - Resume from last successful step if server restarts
 * - Built-in observability for debugging
 * - No lost processing on deploy
 */

import { FatalError } from "workflow";
import type { ActionItem, DecisionStatus, DecisionType, ProcessingStatus, TranscriptSegment } from "@/lib/db/schema";
import { env } from "@/lib/env/server";
import { createWorkflowLogger } from "./workflow-logger";

const log = createWorkflowLogger("video-processing");

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

interface ExtractedDecisionResult {
  decisions: Array<{
    summary: string;
    context?: string;
    reasoning?: string;
    timestampStart: number;
    timestampEnd?: number;
    decisionType: DecisionType;
    status: DecisionStatus;
    confidence: number;
    tags: string[];
    participants: Array<{
      name: string;
      role: "decider" | "participant" | "mentioned";
      attributedText?: string;
    }>;
    externalRefs?: Array<{
      type: string;
      id: string;
      url?: string;
    }>;
  }>;
  totalDecisions: number;
  primaryTopics: string[];
}

// =============================================================================
// Helper Functions
// =============================================================================

async function updateProcessingStatus(videoId: string, status: ProcessingStatus, error?: string): Promise<void> {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("@/lib/db");
  const { videos } = await import("@/lib/db/schema");

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
  const replicateToken = env.REPLICATE_API_TOKEN;
  if (!replicateToken) {
    throw new FatalError("Replicate API token not configured. Please set REPLICATE_API_TOKEN.");
  }

  // Use Replicate's Whisper model for transcription
  // This keeps all AI services routed through managed gateways/services
  const { default: Replicate } = await import("replicate");
  const replicate = new Replicate({ auth: replicateToken });

  const WHISPER_MODEL = "openai/whisper:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef62317f8ff4334";

  const output = (await replicate.run(WHISPER_MODEL as `${string}/${string}`, {
    input: {
      audio: videoUrl,
      model: "large-v3",
      translate: false,
      temperature: 0,
      transcription: "plain text",
      suppress_tokens: "-1",
      logprob_threshold: -1,
      no_speech_threshold: 0.6,
      condition_on_previous_text: true,
      compression_ratio_threshold: 2.4,
    },
  })) as {
    transcription?: string;
    segments?: Array<{ start: number; end: number; text: string }>;
    detected_language?: string;
  };

  const segments: TranscriptSegment[] = (output.segments || []).map((seg) => ({
    startTime: seg.start,
    endTime: seg.end,
    text: seg.text.trim(),
  }));

  // Calculate duration from segments if available
  const duration = segments.length > 0 ? Math.max(...segments.map((s) => s.endTime)) : 0;

  return {
    transcript: output.transcription || "",
    segments,
    duration,
    language: output.detected_language,
  };
}

async function analyzeWithAI(
  transcript: string,
  segments: TranscriptSegment[],
  videoTitle?: string,
): Promise<AIAnalysisResult> {
  const { gateway } = await import("@ai-sdk/gateway");
  const { generateText, generateObject, jsonSchema } = await import("ai");

  // Use Vercel AI Gateway for all AI operations
  const model = gateway("xai/grok-3");

  // Define schemas for structured outputs
  const tagsSchema = jsonSchema<{ tags: string[] }>({
    type: "object",
    properties: {
      tags: {
        type: "array",
        items: { type: "string" },
        description: "5-10 relevant tags for the video",
      },
    },
    required: ["tags"],
  });

  const actionItemsSchema = jsonSchema<{
    items: Array<{ text: string; timestamp?: number; priority?: "high" | "medium" | "low" }>;
  }>({
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string", description: "The action item description" },
            timestamp: { type: "number", description: "Approximate timestamp in seconds" },
            priority: { type: "string", enum: ["high", "medium", "low"], description: "Priority level" },
          },
          required: ["text"],
        },
        description: "List of action items extracted from the transcript",
      },
    },
    required: ["items"],
  });

  const chaptersSchema = jsonSchema<{
    chapters: Array<{ title: string; summary: string; startTime: number; endTime?: number }>;
  }>({
    type: "object",
    properties: {
      chapters: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Chapter title" },
            summary: { type: "string", description: "Brief chapter summary" },
            startTime: { type: "number", description: "Start time in seconds" },
            endTime: { type: "number", description: "End time in seconds" },
          },
          required: ["title", "summary", "startTime"],
        },
        description: "Video chapters based on topic changes",
      },
    },
    required: ["chapters"],
  });

  const codeSnippetsSchema = jsonSchema<{
    snippets: Array<{ language: string; code: string; title?: string; description?: string; timestamp?: number }>;
  }>({
    type: "object",
    properties: {
      snippets: {
        type: "array",
        items: {
          type: "object",
          properties: {
            language: { type: "string", description: "Programming language" },
            code: { type: "string", description: "The code snippet" },
            title: { type: "string", description: "Brief title" },
            description: { type: "string", description: "What the code does" },
            timestamp: { type: "number", description: "Approximate timestamp in seconds" },
          },
          required: ["language", "code"],
        },
        description: "Code snippets detected in the transcript",
      },
    },
    required: ["snippets"],
  });

  // Generate summary using Vercel AI SDK
  const summaryResult = await generateText({
    model,
    system:
      "You are a helpful assistant that summarizes video transcripts. Provide a concise summary in 2-3 paragraphs.",
    prompt: `Please summarize this video transcript:\n\n${transcript.slice(0, 10000)}`,
  });

  const summary = summaryResult.text || "Summary generation failed";

  // Generate tags using structured output
  let tags: string[] = [];
  try {
    const tagsResult = await generateObject({
      model,
      schema: tagsSchema,
      system: "Generate 5-10 relevant tags for this video based on its title and content.",
      prompt: `Title: ${videoTitle || "Untitled"}\n\nTranscript excerpt: ${transcript.slice(0, 2000)}`,
    });
    tags = Array.isArray(tagsResult.object?.tags) ? tagsResult.object.tags : [];
  } catch {
    tags = [];
  }

  // Extract action items using structured output
  let actionItems: ActionItem[] = [];
  try {
    const actionItemsResult = await generateObject({
      model,
      schema: actionItemsSchema,
      system: `Extract action items from this transcript. Include:
- text: the action item description
- timestamp: approximate timestamp in seconds (if mentioned)
- priority: "high", "medium", or "low" based on urgency`,
      prompt: transcript.slice(0, 8000),
    });
    actionItems = Array.isArray(actionItemsResult.object?.items) ? actionItemsResult.object.items : [];
  } catch {
    actionItems = [];
  }

  // Generate chapters using structured output
  let chapters: AIAnalysisResult["chapters"] = [];
  try {
    const chaptersResult = await generateObject({
      model,
      schema: chaptersSchema,
      system: `Analyze this transcript and create chapters. For each chapter include:
- title: chapter title
- summary: brief chapter summary
- startTime: start time in seconds
- endTime: end time in seconds (optional)`,
      prompt: `Transcript with timestamps:\n${segments
        .slice(0, 100)
        .map((s) => `[${s.startTime}s] ${s.text}`)
        .join("\n")}`,
    });
    chapters = Array.isArray(chaptersResult.object?.chapters) ? chaptersResult.object.chapters : [];
  } catch {
    chapters = [];
  }

  // Detect code snippets using structured output
  let codeSnippets: AIAnalysisResult["codeSnippets"] = [];
  try {
    const codeResult = await generateObject({
      model,
      schema: codeSnippetsSchema,
      system: `Detect any code snippets, commands, or technical code mentioned in this transcript. For each snippet include:
- language: programming language
- code: the code snippet
- title: brief title
- description: what the code does
- timestamp: approximate timestamp in seconds`,
      prompt: transcript.slice(0, 8000),
    });
    codeSnippets = Array.isArray(codeResult.object?.snippets) ? codeResult.object.snippets : [];
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

async function saveTranscript(videoId: string, transcript: string, segments: TranscriptSegment[]): Promise<void> {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("@/lib/db");
  const { videos } = await import("@/lib/db/schema");

  await db
    .update(videos)
    .set({
      transcript,
      transcriptSegments: segments,
      updatedAt: new Date(),
    })
    .where(eq(videos.id, videoId));
}

async function saveAIAnalysis(videoId: string, analysis: AIAnalysisResult): Promise<void> {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("@/lib/db");
  const { videos, videoChapters, videoCodeSnippets } = await import("@/lib/db/schema");

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

async function extractDecisions(
  segments: TranscriptSegment[],
  videoTitle?: string,
): Promise<ExtractedDecisionResult> {
  const { gateway } = await import("@ai-sdk/gateway");
  const { generateObject, jsonSchema } = await import("ai");

  // Use Vercel AI Gateway
  const model = gateway("xai/grok-3");

  const decisionSchema = jsonSchema<ExtractedDecisionResult>({
    type: "object",
    properties: {
      decisions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            summary: { type: "string", description: "Clear summary of what was decided" },
            context: { type: "string", description: "Discussion context that led to the decision" },
            reasoning: { type: "string", description: "Why this decision was made" },
            timestampStart: { type: "number", description: "Start time in seconds" },
            timestampEnd: { type: "number", description: "End time in seconds" },
            decisionType: {
              type: "string",
              enum: ["technical", "process", "product", "team", "other"],
              description: "Type of decision",
            },
            status: {
              type: "string",
              enum: ["proposed", "decided", "revisited", "superseded"],
              description: "Decision status",
            },
            confidence: { type: "number", description: "AI confidence 0-100" },
            tags: { type: "array", items: { type: "string" }, description: "Topic tags" },
            participants: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Participant name" },
                  role: {
                    type: "string",
                    enum: ["decider", "participant", "mentioned"],
                    description: "Role in decision",
                  },
                  attributedText: { type: "string", description: "What they said" },
                },
                required: ["name", "role"],
              },
              description: "Decision participants",
            },
            externalRefs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string", description: "Reference type (github:pr, linear:issue, etc.)" },
                  id: { type: "string", description: "Reference identifier" },
                  url: { type: "string", description: "URL if available" },
                },
                required: ["type", "id"],
              },
              description: "External references mentioned",
            },
          },
          required: ["summary", "timestampStart", "decisionType", "status", "confidence", "tags", "participants"],
        },
        description: "Extracted decisions",
      },
      totalDecisions: { type: "number", description: "Total decisions found" },
      primaryTopics: {
        type: "array",
        items: { type: "string" },
        description: "Main topics discussed",
      },
    },
    required: ["decisions", "totalDecisions", "primaryTopics"],
  });

  // Format transcript with timestamps
  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formattedTranscript = segments.map((seg) => `[${formatTime(seg.startTime)}] ${seg.text}`).join("\n");

  try {
    const result = await generateObject({
      model,
      schema: decisionSchema,
      prompt: `Analyze this video transcript and extract all decisions made.

For each decision, identify:
1. What was decided (clear, actionable summary)
2. When in the video (timestamp)
3. Who was involved (speakers and their roles)
4. The context and reasoning behind the decision
5. Whether it's final (decided), proposed, revisiting a previous decision, or superseding one
6. Any alternatives that were considered
7. External references mentioned (PRs, issues, documents, files)

Focus on extracting:
- **Technical decisions**: Architecture choices, technology/tool selections, implementation approaches
- **Process decisions**: Workflow changes, policies, procedures
- **Product decisions**: Features, priorities, scope changes
- **Team decisions**: Assignments, timelines, resource allocation

For each decision:
- Provide a clear, standalone summary (someone should understand the decision without context)
- Include the reasoning and factors that led to the decision
- Identify all participants and their roles
- Assign a confidence score (0-100)

${videoTitle ? `Video Title: "${videoTitle}"` : ""}

Transcript:
${formattedTranscript}`,
    });

    return result.object as ExtractedDecisionResult;
  } catch (error) {
    log.error({ error }, "Failed to extract decisions");
    return {
      decisions: [],
      totalDecisions: 0,
      primaryTopics: [],
    };
  }
}

async function saveDecisions(
  videoId: string,
  organizationId: string,
  extractedDecisions: ExtractedDecisionResult,
): Promise<void> {
  if (extractedDecisions.decisions.length === 0) {
    return;
  }

  const { db } = await import("@/lib/db");
  const { decisions, decisionParticipants, decisionLinks, members } = await import("@/lib/db/schema");

  try {
    // Get organization members to match participants to users
    const orgMembers = await db.query.members.findMany({
      where: (m, { eq: eqOp }) => eqOp(m.organizationId, organizationId),
      with: {
        user: true,
      },
    });

    for (const extracted of extractedDecisions.decisions) {
      // Only save decisions with sufficient confidence
      if (extracted.confidence < 50) {
        continue;
      }

      // Create the decision record
      const [decision] = await db
        .insert(decisions)
        .values({
          organizationId,
          videoId,
          summary: extracted.summary,
          context: extracted.context,
          reasoning: extracted.reasoning,
          timestampStart: extracted.timestampStart,
          timestampEnd: extracted.timestampEnd,
          decisionType: extracted.decisionType,
          status: extracted.status,
          confidence: extracted.confidence,
          tags: extracted.tags,
          metadata: extracted.externalRefs ? { externalRefs: extracted.externalRefs } : undefined,
        })
        .returning();

      // Add participants
      if (extracted.participants.length > 0) {
        const participantData = extracted.participants.map((p) => {
          // Try to match to a user in the organization
          const matchedMember = orgMembers.find(
            (m) => m.user?.name?.toLowerCase() === p.name.toLowerCase(),
          );
          return {
            decisionId: decision.id,
            userId: matchedMember?.userId ?? null,
            speakerName: p.name,
            role: p.role,
            attributedText: p.attributedText,
          };
        });
        await db.insert(decisionParticipants).values(participantData);
      }

      // Add links for external references
      if (extracted.externalRefs && extracted.externalRefs.length > 0) {
        const linkData = extracted.externalRefs.map((ref) => ({
          decisionId: decision.id,
          entityType: ref.type.split(":")[0] ?? ref.type,
          entityId: ref.id,
          entityRef: ref.id,
          linkType: "references",
          url: ref.url,
        }));
        await db.insert(decisionLinks).values(linkData);
      }
    }

    log.info(
      { videoId, decisionCount: extractedDecisions.decisions.filter((d) => d.confidence >= 50).length },
      "Saved extracted decisions",
    );
  } catch (error) {
    log.error({ error, videoId }, "Failed to save decisions");
  }
}

async function sendCompletionNotification(
  videoId: string,
  status: "completed" | "failed",
  errorMessage?: string,
): Promise<void> {
  try {
    const { db } = await import("@/lib/db");
    const { notifications } = await import("@/lib/db/schema");
    const { resend } = await import("@/lib/email");

    const video = await db.query.videos.findFirst({
      where: (v, { eq: eqOp }) => eqOp(v.id, videoId),
    });

    if (!video || !video.authorId) return;

    const authorId = video.authorId;
    const user = await db.query.users.findFirst({
      where: (u, { eq: eqOp }) => eqOp(u.id, authorId),
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
    const fromEmail = env.RESEND_FROM_EMAIL ?? "notifications@nuclom.com";
    await resend.emails.send({
      from: fromEmail,
      to: user.email,
      subject:
        status === "completed" ? `Your video "${video.title}" is ready!` : `Video processing failed: "${video.title}"`,
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
    log.error({ videoId, status, error }, "Failed to send notification");
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
 * 7. Extracts decisions for knowledge graph
 * 8. Saves extracted decisions to database
 * 9. Updates status to completed
 * 10. Sends completion notification
 *
 * Each step is checkpointed, so if the server restarts, processing resumes
 * from the last successful step.
 */
export async function processVideoWorkflow(input: VideoProcessingInput): Promise<VideoProcessingResult> {
  "use workflow";

  const { videoId, videoUrl, videoTitle } = input;

  try {
    // Step 1: Update status to transcribing
    await updateProcessingStatus(videoId, "transcribing");
    ("use step");

    // Step 2: Transcribe the video
    const transcription = await transcribeVideo(videoUrl);
    ("use step");

    // Step 3: Save transcript
    await saveTranscript(videoId, transcription.transcript, transcription.segments);
    ("use step");

    // Step 4: Update status to analyzing
    await updateProcessingStatus(videoId, "analyzing");
    ("use step");

    // Step 5: Run AI analysis
    const analysis = await analyzeWithAI(transcription.transcript, transcription.segments, videoTitle);
    ("use step");

    // Step 6: Save AI analysis results
    await saveAIAnalysis(videoId, analysis);
    ("use step");

    // Step 7: Extract decisions for knowledge graph
    const extractedDecisions = await extractDecisions(transcription.segments, videoTitle);
    ("use step");

    // Step 8: Save extracted decisions to database
    // We need to get the organization ID from the video
    const { db } = await import("@/lib/db");
    const video = await db.query.videos.findFirst({
      where: (v, { eq: eqOp }) => eqOp(v.id, videoId),
      columns: { organizationId: true },
    });
    if (video) {
      await saveDecisions(videoId, video.organizationId, extractedDecisions);
    }
    ("use step");

    // Step 9: Update status to completed
    await updateProcessingStatus(videoId, "completed");
    ("use step");

    // Step 10: Send completion notification
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
