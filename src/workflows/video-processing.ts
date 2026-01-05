/**
 * Video Processing Workflow using Workflow DevKit
 *
 * Handles the complete video processing pipeline with durable execution:
 * 1. Transcription (audio to text)
 * 2. Speaker Diarization (who spoke when)
 * 3. AI Analysis (summary, tags, action items)
 * 4. Code snippet detection
 * 5. Chapter generation
 * 6. Decision extraction (knowledge graph)
 * 7. Database storage of results
 *
 * Benefits over fire-and-forget:
 * - Automatic retries on transient failures
 * - Resume from last successful step if server restarts
 * - Built-in observability for debugging
 * - No lost processing on deploy
 */

import { FatalError, sleep } from "workflow";
import type { ActionItem, DecisionStatus, DecisionType, ProcessingStatus, TranscriptSegment } from "@/lib/db/schema";
import { notifySlackMonitoring } from "@/lib/effect/services/slack-monitoring";
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
  readonly organizationId?: string;
  readonly skipDiarization?: boolean;
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

interface DiarizedSegment {
  speaker: string;
  start: number; // milliseconds
  end: number; // milliseconds
  text: string;
  confidence: number;
}

interface SpeakerSummary {
  speaker: string;
  totalSpeakingTime: number; // milliseconds
  segmentCount: number;
  speakingPercentage: number;
}

interface DiarizationResult {
  transcript: string;
  segments: DiarizedSegment[];
  speakers: SpeakerSummary[];
  duration: number;
  language?: string;
  speakerCount: number;
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

interface DetectedMoment {
  title: string;
  description?: string;
  startTime: number;
  endTime: number;
  momentType:
    | "decision"
    | "action_item"
    | "question"
    | "answer"
    | "emphasis"
    | "demonstration"
    | "conclusion"
    | "highlight";
  confidence: number;
  transcriptExcerpt: string;
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

async function detectKeyMoments(
  _transcript: string,
  segments: TranscriptSegment[],
  videoTitle?: string,
): Promise<DetectedMoment[]> {
  const { gateway } = await import("@ai-sdk/gateway");
  const { generateObject, jsonSchema } = await import("ai");

  // Use Vercel AI Gateway
  const model = gateway("xai/grok-3");

  // Schema for moment detection
  const momentsSchema = jsonSchema<{
    moments: Array<{
      title: string;
      description?: string;
      startTime: number;
      endTime: number;
      momentType:
        | "decision"
        | "action_item"
        | "question"
        | "answer"
        | "emphasis"
        | "demonstration"
        | "conclusion"
        | "highlight";
      confidence: number;
      transcriptExcerpt: string;
    }>;
  }>({
    type: "object",
    properties: {
      moments: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "A concise title for the moment (max 100 chars)" },
            description: { type: "string", description: "Brief description of what happens in this moment" },
            startTime: { type: "number", description: "Start time in seconds" },
            endTime: { type: "number", description: "End time in seconds" },
            momentType: {
              type: "string",
              enum: [
                "decision",
                "action_item",
                "question",
                "answer",
                "emphasis",
                "demonstration",
                "conclusion",
                "highlight",
              ],
              description: "Type of moment detected",
            },
            confidence: { type: "number", description: "Confidence score 0-100" },
            transcriptExcerpt: { type: "string", description: "The relevant transcript excerpt for this moment" },
          },
          required: ["title", "startTime", "endTime", "momentType", "confidence", "transcriptExcerpt"],
        },
        description: "Key moments detected in the video",
      },
    },
    required: ["moments"],
  });

  // Prepare transcript with timestamps
  const timestampedTranscript = segments
    .map((s) => `[${Math.floor(s.startTime)}s-${Math.floor(s.endTime)}s] ${s.text}`)
    .join("\n");

  try {
    const result = await generateObject({
      model,
      schema: momentsSchema,
      system: `You are an expert at analyzing video transcripts to identify key moments worth sharing or highlighting.

Detect the following types of moments:
- **decision**: Moments where a decision is made or announced (e.g., "We've decided to...", "Let's go with...")
- **action_item**: Tasks or next steps assigned (e.g., "I'll take care of...", "Next steps are...")
- **question**: Important questions raised
- **answer**: Key answers or explanations given
- **emphasis**: Points that are emphasized or repeated for importance
- **demonstration**: Moments where something is being shown or demonstrated (e.g., "Let me show you...", "As you can see...")
- **conclusion**: Summary statements or wrap-up points (e.g., "In summary...", "To wrap up...")
- **highlight**: Other noteworthy moments worth sharing

For each moment:
1. Identify the exact timestamp range from the transcript
2. Assign a confidence score (0-100) based on how clearly the moment fits its category
3. Extract the relevant transcript excerpt
4. Create a concise, descriptive title`,
      prompt: `Video Title: ${videoTitle || "Untitled"}

Transcript with timestamps:
${timestampedTranscript.slice(0, 15000)}

Analyze this transcript and identify key moments. Focus on finding:
1. Decision moments
2. Action items and next steps
3. Important Q&A exchanges
4. Points of emphasis
5. Demonstrations or walkthroughs
6. Conclusions and summaries

Return only moments with confidence >= 60.`,
    });

    return Array.isArray(result.object?.moments) ? result.object.moments : [];
  } catch (error) {
    log.error({ error }, "Failed to detect key moments");
    return [];
  }
}

async function saveKeyMoments(videoId: string, organizationId: string, moments: DetectedMoment[]): Promise<void> {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("@/lib/db");
  const { videoMoments } = await import("@/lib/db/schema");

  if (moments.length === 0) return;

  // Delete existing moments for this video
  await db.delete(videoMoments).where(eq(videoMoments.videoId, videoId));

  // Insert new moments
  await db.insert(videoMoments).values(
    moments.map((moment) => ({
      videoId,
      organizationId,
      title: moment.title.slice(0, 200), // Ensure title fits
      description: moment.description?.slice(0, 1000),
      startTime: Math.floor(moment.startTime),
      endTime: Math.floor(moment.endTime),
      momentType: moment.momentType,
      confidence: Math.min(100, Math.max(0, Math.floor(moment.confidence))),
      transcriptExcerpt: moment.transcriptExcerpt.slice(0, 5000),
    })),
  );
}

/**
 * Perform speaker diarization using AssemblyAI
 * Falls back gracefully if not configured
 */
async function diarizeVideo(videoUrl: string): Promise<DiarizationResult | null> {
  const apiKey = env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    log.info({}, "AssemblyAI not configured, skipping speaker diarization");
    return null;
  }

  const ASSEMBLYAI_API_URL = "https://api.assemblyai.com/v2";
  const MAX_POLLING_ATTEMPTS = 200; // ~10 minutes with 3-second intervals

  try {
    // Submit transcription request with speaker labels
    const submitResponse = await fetch(`${ASSEMBLYAI_API_URL}/transcript`, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audio_url: videoUrl,
        speaker_labels: true,
        punctuate: true,
        format_text: true,
      }),
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      throw new Error(`AssemblyAI submit error: ${submitResponse.status} - ${errorText}`);
    }

    const { id: transcriptId } = (await submitResponse.json()) as { id: string };

    // Poll for completion
    for (let attempt = 0; attempt < MAX_POLLING_ATTEMPTS; attempt++) {
      const statusResponse = await fetch(`${ASSEMBLYAI_API_URL}/transcript/${transcriptId}`, {
        headers: { Authorization: apiKey },
      });

      if (!statusResponse.ok) {
        throw new Error(`AssemblyAI status error: ${statusResponse.status}`);
      }

      const result = (await statusResponse.json()) as {
        status: "queued" | "processing" | "completed" | "error";
        text?: string;
        utterances?: Array<{
          speaker: string;
          start: number;
          end: number;
          text: string;
          confidence: number;
        }>;
        audio_duration?: number;
        language_code?: string;
        error?: string;
      };

      if (result.status === "completed") {
        const utterances = result.utterances || [];
        const durationMs = (result.audio_duration || 0) * 1000;

        // Convert to our format
        const segments: DiarizedSegment[] = utterances.map((u) => ({
          speaker: u.speaker,
          start: u.start,
          end: u.end,
          text: u.text,
          confidence: u.confidence,
        }));

        // Calculate speaker stats
        const speakerStats = new Map<string, { time: number; count: number }>();
        for (const segment of segments) {
          const duration = segment.end - segment.start;
          const existing = speakerStats.get(segment.speaker) || { time: 0, count: 0 };
          speakerStats.set(segment.speaker, {
            time: existing.time + duration,
            count: existing.count + 1,
          });
        }

        const totalSpeakingTime = Array.from(speakerStats.values()).reduce((sum, s) => sum + s.time, 0);

        const speakers: SpeakerSummary[] = Array.from(speakerStats.entries())
          .map(([speaker, stats]) => ({
            speaker,
            totalSpeakingTime: stats.time,
            segmentCount: stats.count,
            speakingPercentage: totalSpeakingTime > 0 ? Math.round((stats.time / totalSpeakingTime) * 100) : 0,
          }))
          .sort((a, b) => b.totalSpeakingTime - a.totalSpeakingTime);

        return {
          transcript: result.text || "",
          segments,
          speakers,
          duration: durationMs,
          language: result.language_code,
          speakerCount: speakers.length,
        };
      }

      if (result.status === "error") {
        throw new Error(result.error || "Diarization failed");
      }

      // Wait before next poll using workflow-native sleep (durable, no resource consumption)
      await sleep("3 seconds");
    }

    throw new Error("Diarization timed out");
  } catch (error) {
    log.error({ error }, "Speaker diarization failed, continuing without speaker data");
    return null;
  }
}

/**
 * Save speaker diarization results to the database
 */
async function saveSpeakerData(videoId: string, organizationId: string, diarization: DiarizationResult): Promise<void> {
  const { db } = await import("@/lib/db");
  const { speakerProfiles, videoSpeakers, speakerSegments } = await import("@/lib/db/schema");

  // Create video speakers and map speaker labels to IDs
  const speakerMap = new Map<string, string>();

  for (const speakerSummary of diarization.speakers) {
    // Check if a speaker profile already exists for this organization with matching label pattern
    // For now, we create anonymous speaker profiles that can be linked to users later
    const [profile] = await db
      .insert(speakerProfiles)
      .values({
        organizationId,
        displayName: `Speaker ${speakerSummary.speaker}`,
      })
      .returning();

    // Create the video speaker record
    const [videoSpeaker] = await db
      .insert(videoSpeakers)
      .values({
        videoId,
        speakerProfileId: profile.id,
        speakerLabel: speakerSummary.speaker,
        totalSpeakingTime: Math.round(speakerSummary.totalSpeakingTime / 1000), // Convert to seconds
        segmentCount: speakerSummary.segmentCount,
        speakingPercentage: speakerSummary.speakingPercentage,
      })
      .returning();

    speakerMap.set(speakerSummary.speaker, videoSpeaker.id);
  }

  // Save individual segments in batches
  const BATCH_SIZE = 100;
  const segmentsToInsert = diarization.segments
    .filter((seg) => speakerMap.has(seg.speaker))
    .map((seg) => ({
      videoId,
      videoSpeakerId: speakerMap.get(seg.speaker) as string,
      startTime: seg.start,
      endTime: seg.end,
      transcriptText: seg.text,
      confidence: Math.round(seg.confidence * 100),
    }));

  for (let i = 0; i < segmentsToInsert.length; i += BATCH_SIZE) {
    const batch = segmentsToInsert.slice(i, i + BATCH_SIZE);
    await db.insert(speakerSegments).values(batch);
  }

  log.info(
    { videoId, speakerCount: diarization.speakerCount, segmentCount: diarization.segments.length },
    "Saved speaker diarization data",
  );
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

async function extractDecisions(segments: TranscriptSegment[], videoTitle?: string): Promise<ExtractedDecisionResult> {
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
  const { decisions, decisionParticipants, decisionLinks } = await import("@/lib/db/schema");

  try {
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
        const participantData = extracted.participants.map(
          (p: { name: string; role: "decider" | "participant" | "mentioned"; attributedText?: string }) => ({
            decisionId: decision.id,
            userId: null,
            speakerName: p.name,
            role: p.role,
            attributedText: p.attributedText,
          }),
        );
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

    // Send Slack monitoring notification
    await notifySlackMonitoring(status === "completed" ? "video_processed" : "video_processing_failed", {
      videoId,
      videoTitle: video.title,
      organizationId: video.organizationId,
      userId: user.id,
      userName: user.name || undefined,
      errorMessage: status === "failed" ? errorMessage : undefined,
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
 * 4. Updates status to diarizing (if enabled)
 * 5. Runs speaker diarization (if configured)
 * 6. Saves speaker data to the database
 * 7. Updates status to analyzing
 * 8. Runs AI analysis (summary, tags, action items, chapters, code snippets)
 * 9. Saves all AI results to the database
 * 10. Detects and saves key moments for clip extraction
 * 11. Extracts decisions for knowledge graph
 * 12. Saves extracted decisions to database
 * 13. Updates status to completed
 * 14. Sends completion notification
 *
 * Each step is checkpointed, so if the server restarts, processing resumes
 * from the last successful step.
 */
export async function processVideoWorkflow(input: VideoProcessingInput): Promise<VideoProcessingResult> {
  "use workflow";

  const { videoId, videoUrl, videoTitle, organizationId, skipDiarization } = input;

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

    // Step 4: Speaker diarization (if enabled and configured)
    let diarization: DiarizationResult | null = null;
    if (!skipDiarization && organizationId) {
      // Update status to diarizing
      await updateProcessingStatus(videoId, "diarizing");
      ("use step");

      // Run speaker diarization
      diarization = await diarizeVideo(videoUrl);
      ("use step");

      // Save speaker data if diarization succeeded
      if (diarization) {
        await saveSpeakerData(videoId, organizationId, diarization);
        ("use step");
      }
    }

    // Step 5: Update status to analyzing
    await updateProcessingStatus(videoId, "analyzing");
    ("use step");

    // Step 6: Run AI analysis
    const analysis = await analyzeWithAI(transcription.transcript, transcription.segments, videoTitle);
    ("use step");

    // Step 7: Save AI analysis results
    await saveAIAnalysis(videoId, analysis);
    ("use step");

    // Step 8: Detect key moments for clip extraction
    const moments = await detectKeyMoments(transcription.transcript, transcription.segments, videoTitle);
    ("use step");

    // Step 9: Save key moments
    if (organizationId && moments.length > 0) {
      await saveKeyMoments(videoId, organizationId, moments);
    }
    ("use step");

    // Step 10: Extract decisions for knowledge graph
    const extractedDecisions = await extractDecisions(transcription.segments, videoTitle);
    ("use step");

    // Step 11: Save extracted decisions to database
    if (organizationId) {
      await saveDecisions(videoId, organizationId, extractedDecisions);
    } else {
      // Fallback: get organization ID from video if not provided in input
      const { db } = await import("@/lib/db");
      const video = await db.query.videos.findFirst({
        where: (v, { eq: eqOp }) => eqOp(v.id, videoId),
        columns: { organizationId: true },
      });
      if (video) {
        await saveDecisions(videoId, video.organizationId, extractedDecisions);
      }
    }
    ("use step");

    // Step 12: Update status to completed
    await updateProcessingStatus(videoId, "completed");
    ("use step");

    // Step 13: Send completion notification
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
