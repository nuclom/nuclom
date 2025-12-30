/**
 * Video Processing Workflow
 *
 * Durable workflow for processing uploaded videos.
 * Uses Vercel Workflow DevKit for reliable, resumable processing.
 */

import { sleep, FatalError } from "workflow";
import Replicate from "replicate";

// =============================================================================
// Types
// =============================================================================

interface VideoProcessingInput {
  videoId: string;
  videoUrl: string;
  organizationId: string;
  title: string;
  description?: string;
  fileSize: number;
}

interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  codec: string;
  fps: number;
  bitrate: number;
}

interface ThumbnailResult {
  primary: string;
  alternates: string[];
}

interface TranscriptionResult {
  text: string;
  segments?: Array<{ start: number; end: number; text: string }>;
  language?: string;
}

interface ProcessingResult {
  videoId: string;
  status: "completed" | "failed";
  metadata?: VideoMetadata;
  thumbnails?: ThumbnailResult;
  transcription?: TranscriptionResult;
  aiSummary?: string;
  error?: string;
}

// =============================================================================
// Step Functions
// =============================================================================

async function updateProcessingStatus(
  videoId: string,
  status: string,
  progress: number,
  error?: string,
) {
  "use step";

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "http://localhost:3000"}/api/videos/${videoId}/processing-status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, progress, error }),
    },
  );

  if (!response.ok) {
    console.error(`Failed to update processing status: ${response.statusText}`);
  }

  return { updated: true };
}

async function extractVideoMetadata(
  videoUrl: string,
  fileSize: number,
): Promise<VideoMetadata> {
  "use step";

  // Use heuristics for metadata extraction
  // In production, this would use FFprobe or a dedicated service
  const estimatedDuration = Math.max(10, Math.floor(fileSize / (1024 * 1024)) * 60);

  // TODO: Integrate with actual video analysis service
  // For now, return estimated values that will be refined
  return {
    duration: estimatedDuration,
    width: 1920,
    height: 1080,
    codec: "h264",
    fps: 30,
    bitrate: Math.floor((fileSize * 8) / estimatedDuration),
  };
}

async function generateVideoThumbnails(
  videoUrl: string,
  duration: number,
): Promise<ThumbnailResult> {
  "use step";

  const replicateApiToken = process.env.REPLICATE_API_TOKEN;

  if (!replicateApiToken) {
    console.warn("REPLICATE_API_TOKEN not configured, using placeholder thumbnails");
    return {
      primary: "",
      alternates: [],
    };
  }

  try {
    const replicate = new Replicate({ auth: replicateApiToken });

    // Generate thumbnails at 10%, 30%, and 50% of the video
    const timestamps = [
      Math.floor(duration * 0.1),
      Math.floor(duration * 0.3),
      Math.floor(duration * 0.5),
    ];

    const thumbnailUrls: string[] = [];

    for (const timestamp of timestamps) {
      try {
        // Use video-to-gif to extract frames
        const output = await replicate.run(
          "fofr/video-to-gif:79bdd53be0a7a5f7c2f4813aba9c2a33e29e5dcf82d01f988d4e5c1c2a17c10e" as `${string}/${string}`,
          {
            input: {
              video: videoUrl,
              start_time: Math.max(0, timestamp),
              duration: 0.1,
              fps: 1,
              width: 1280,
            },
          },
        );

        const url = typeof output === "string"
          ? output
          : Array.isArray(output) && output.length > 0
            ? String(output[0])
            : "";

        if (url) {
          thumbnailUrls.push(url);
        }
      } catch (err) {
        console.error(`Failed to generate thumbnail at ${timestamp}s:`, err);
      }
    }

    return {
      primary: thumbnailUrls[0] || "",
      alternates: thumbnailUrls.slice(1),
    };
  } catch (error) {
    console.error("Thumbnail generation failed:", error);
    return {
      primary: "",
      alternates: [],
    };
  }
}

async function transcribeVideo(videoUrl: string): Promise<TranscriptionResult> {
  "use step";

  const replicateApiToken = process.env.REPLICATE_API_TOKEN;

  if (!replicateApiToken) {
    console.warn("REPLICATE_API_TOKEN not configured, skipping transcription");
    return { text: "" };
  }

  try {
    const replicate = new Replicate({ auth: replicateApiToken });

    const output = await replicate.run(
      "openai/whisper:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef62317f8ff4334" as `${string}/${string}`,
      {
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
      },
    ) as {
      transcription?: string;
      segments?: Array<{ start: number; end: number; text: string }>;
      detected_language?: string;
    };

    return {
      text: output.transcription || "",
      segments: output.segments?.map((seg) => ({
        start: seg.start,
        end: seg.end,
        text: seg.text,
      })),
      language: output.detected_language,
    };
  } catch (error) {
    console.error("Transcription failed:", error);
    return { text: "" };
  }
}

async function generateAISummary(
  transcript: string,
  title: string,
  description?: string,
): Promise<string> {
  "use step";

  if (!transcript || transcript.trim().length < 50) {
    return "";
  }

  try {
    // Use the AI SDK or OpenAI to generate summary
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "grok-3",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that summarizes video content. Provide concise, informative summaries.",
          },
          {
            role: "user",
            content: `Please summarize this video transcript. Title: "${title}"${description ? `. Description: "${description}"` : ""}

Transcript:
${transcript.substring(0, 4000)}

Provide:
1. A brief summary (2-3 sentences)
2. Key points (3-5 bullet points)
3. Any action items mentioned`,
          },
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      console.error("AI summary generation failed:", response.statusText);
      return "";
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (error) {
    console.error("AI summary generation failed:", error);
    return "";
  }
}

async function updateVideoRecord(
  videoId: string,
  data: {
    duration: string;
    width?: number;
    height?: number;
    codec?: string;
    fps?: number;
    bitrate?: number;
    thumbnailUrl?: string;
    thumbnailAlternates?: string[];
    transcript?: string;
    aiSummary?: string;
    processingStatus: string;
    processingProgress: number;
    processedAt?: Date;
    processingError?: string;
  },
) {
  "use step";

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "http://localhost:3000"}/api/videos/${videoId}/processing-complete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );

  if (!response.ok) {
    throw new FatalError(`Failed to update video record: ${response.statusText}`);
  }

  return { success: true };
}

// =============================================================================
// Main Workflow
// =============================================================================

export async function processVideoWorkflow(
  input: VideoProcessingInput,
): Promise<ProcessingResult> {
  "use workflow";

  const { videoId, videoUrl, title, description, fileSize } = input;

  try {
    // Step 1: Update status to processing
    await updateProcessingStatus(videoId, "processing", 10);

    // Step 2: Extract metadata
    await updateProcessingStatus(videoId, "extracting_metadata", 20);
    const metadata = await extractVideoMetadata(videoUrl, fileSize);

    // Step 3: Generate thumbnails
    await updateProcessingStatus(videoId, "generating_thumbnails", 40);
    const thumbnails = await generateVideoThumbnails(videoUrl, metadata.duration);

    // Step 4: Transcribe video (this can take a while)
    await updateProcessingStatus(videoId, "transcribing", 60);
    const transcription = await transcribeVideo(videoUrl);

    // Step 5: Generate AI summary if we have a transcript
    await updateProcessingStatus(videoId, "analyzing", 80);
    let aiSummary = "";
    if (transcription.text) {
      aiSummary = await generateAISummary(transcription.text, title, description);
    }

    // Step 6: Format duration
    const hours = Math.floor(metadata.duration / 3600);
    const minutes = Math.floor((metadata.duration % 3600) / 60);
    const seconds = Math.floor(metadata.duration % 60);
    const formattedDuration =
      hours > 0
        ? `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
        : `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

    // Step 7: Update video record with all processed data
    await updateVideoRecord(videoId, {
      duration: formattedDuration,
      width: metadata.width,
      height: metadata.height,
      codec: metadata.codec,
      fps: metadata.fps,
      bitrate: metadata.bitrate,
      thumbnailUrl: thumbnails.primary || undefined,
      thumbnailAlternates: thumbnails.alternates.length > 0 ? thumbnails.alternates : undefined,
      transcript: transcription.text || undefined,
      aiSummary: aiSummary || undefined,
      processingStatus: "completed",
      processingProgress: 100,
      processedAt: new Date(),
    });

    return {
      videoId,
      status: "completed",
      metadata,
      thumbnails,
      transcription,
      aiSummary,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error during video processing";

    // Update status to failed
    await updateProcessingStatus(videoId, "failed", 0, errorMessage);

    return {
      videoId,
      status: "failed",
      error: errorMessage,
    };
  }
}

// =============================================================================
// Workflow Trigger
// =============================================================================

export async function triggerVideoProcessing(input: VideoProcessingInput): Promise<void> {
  // Import dynamically to avoid bundling issues
  const { start } = await import("workflow/api");
  await start(processVideoWorkflow, [input]);
}
