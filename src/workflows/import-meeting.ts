/**
 * Meeting Import Workflow using Workflow DevKit
 *
 * Handles the async import of meeting recordings from Zoom and Google Meet
 * with durable execution for reliability.
 *
 * Steps:
 * 1. Update import status to downloading
 * 2. Download recording from provider (Zoom/Google)
 * 3. Upload to Cloudflare R2
 * 4. Create video record in database
 * 5. Trigger video processing workflow
 * 6. Update import status to completed
 *
 * Benefits:
 * - Automatic retries on network failures
 * - Resume from last step on server restart
 * - Built-in observability
 */

import { FatalError } from "workflow";
import type { IntegrationProvider } from "@/lib/db/schema";
import { env } from "@/lib/env/server";
import { processVideoWorkflow } from "./video-processing";

// =============================================================================
// Types
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
// Helper Functions
// =============================================================================

async function updateImportStatus(
  importedMeetingId: string,
  status: "pending" | "downloading" | "processing" | "completed" | "failed",
  updates?: {
    videoId?: string;
    importError?: string;
    importedAt?: Date;
  },
): Promise<void> {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("@/lib/db");
  const { importedMeetings } = await import("@/lib/db/schema");

  await db
    .update(importedMeetings)
    .set({
      importStatus: status,
      ...updates,
    })
    .where(eq(importedMeetings.id, importedMeetingId));
}

async function downloadZoomRecording(
  downloadUrl: string,
  accessToken: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  // Zoom requires access token in query params
  const fullUrl = `${downloadUrl}?access_token=${accessToken}`;

  const response = await fetch(fullUrl);
  if (!response.ok) {
    throw new Error(`Failed to download Zoom recording: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") || "video/mp4";

  return {
    buffer: Buffer.from(arrayBuffer),
    contentType,
  };
}

async function downloadGoogleMeetRecording(
  fileId: string,
  accessToken: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  // Google Drive file download
  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  const response = await fetch(downloadUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download Google Meet recording: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") || "video/mp4";

  return {
    buffer: Buffer.from(arrayBuffer),
    contentType,
  };
}

async function uploadToR2(buffer: Buffer, key: string, contentType: string): Promise<{ url: string }> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");

  const accountId = env.R2_ACCOUNT_ID;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const bucketName = env.R2_BUCKET_NAME;
  const publicUrl = env.R2_PUBLIC_URL;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new FatalError("R2 storage not configured");
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  const url = publicUrl ? `${publicUrl}/${key}` : `https://${bucketName}.${accountId}.r2.dev/${key}`;

  return { url };
}

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
// Main Workflow
// =============================================================================

/**
 * Import a meeting recording from Zoom or Google Meet with durable execution.
 *
 * This workflow:
 * 1. Updates import status to downloading
 * 2. Downloads the recording from the provider
 * 3. Uploads it to Cloudflare R2
 * 4. Creates a video record in the database
 * 5. Triggers the video processing workflow
 * 6. Updates the import status to completed
 *
 * Each step is checkpointed, so if the server restarts or there's a
 * transient failure, processing resumes from the last successful step.
 */
export async function importMeetingWorkflow(input: ImportMeetingInput): Promise<ImportMeetingResult> {
  "use workflow";

  const { importedMeetingId, provider, externalId, downloadUrl, meetingTitle, userId, organizationId, accessToken } =
    input;

  try {
    // Step 1: Update import status to downloading
    await updateImportStatus(importedMeetingId, "downloading");
    ("use step");

    // Step 2: Download the recording from provider
    let downloadResult: { buffer: Buffer; contentType: string };

    if (provider === "zoom") {
      downloadResult = await downloadZoomRecording(downloadUrl, accessToken);
    } else {
      downloadResult = await downloadGoogleMeetRecording(externalId, accessToken);
    }
    ("use step");

    // Step 3: Upload to R2 storage
    const filename = `${externalId}.mp4`;
    const key = `videos/${organizationId}/${filename}`;
    const uploadResult = await uploadToR2(downloadResult.buffer, key, downloadResult.contentType);
    ("use step");

    // Step 4: Update status to processing
    await updateImportStatus(importedMeetingId, "processing");
    ("use step");

    // Step 5: Create video record
    const estimatedDuration = Math.round(downloadResult.buffer.length / 100000);

    const { db } = await import("@/lib/db");
    const { videos } = await import("@/lib/db/schema");

    const [video] = await db
      .insert(videos)
      .values({
        title: meetingTitle || "Meeting Recording",
        description: `Imported from ${provider === "zoom" ? "Zoom" : "Google Meet"}`,
        duration: formatDuration(estimatedDuration),
        videoUrl: uploadResult.url,
        authorId: userId,
        organizationId,
        processingStatus: "pending",
      })
      .returning();
    ("use step");

    // Step 6: Update imported meeting with video ID
    await updateImportStatus(importedMeetingId, "completed", {
      videoId: video.id,
      importedAt: new Date(),
    });
    ("use step");

    // Step 7: Trigger video processing workflow
    // This is a separate durable workflow that will handle transcription and AI analysis
    await processVideoWorkflow({
      videoId: video.id,
      videoUrl: uploadResult.url,
      videoTitle: meetingTitle,
      organizationId,
    });

    return {
      success: true,
      videoId: video.id,
    };
  } catch (error) {
    // Handle errors
    const errorMessage = error instanceof Error ? error.message : String(error);

    await updateImportStatus(importedMeetingId, "failed", {
      importError: errorMessage,
    });

    // Re-throw FatalErrors to stop retrying
    if (error instanceof FatalError) {
      throw error;
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}
