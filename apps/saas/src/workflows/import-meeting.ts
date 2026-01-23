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

import type { IntegrationProvider } from '@nuclom/lib/db/schema';
import { FatalError } from 'workflow';
import { processVideoWorkflow } from './video-processing/workflow';
import { createWorkflowLogger } from './workflow-logger';

const logger = createWorkflowLogger('import-meeting');

// =============================================================================
// Types
// =============================================================================

export interface MeetingParticipant {
  readonly name: string;
  readonly email?: string;
  readonly joinTime?: string;
  readonly leaveTime?: string;
}

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
  /** Meeting participants for speaker identification */
  readonly participants?: MeetingParticipant[];
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
  status: 'pending' | 'downloading' | 'processing' | 'completed' | 'failed',
  updates?: {
    videoId?: string;
    importError?: string;
    importedAt?: Date;
  },
): Promise<void> {
  'use step';

  const { eq } = await import('drizzle-orm');
  const { db } = await import('@nuclom/lib/db');
  const { importedMeetings } = await import('@nuclom/lib/db/schema');

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
  'use step';

  // Zoom requires access token in query params
  const fullUrl = `${downloadUrl}?access_token=${accessToken}`;

  const response = await fetch(fullUrl);
  if (!response.ok) {
    throw new Error(`Failed to download Zoom recording: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get('content-type') || 'video/mp4';

  return {
    buffer: Buffer.from(arrayBuffer),
    contentType,
  };
}

async function downloadGoogleMeetRecording(
  fileId: string,
  accessToken: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  'use step';

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
  const contentType = response.headers.get('content-type') || 'video/mp4';

  return {
    buffer: Buffer.from(arrayBuffer),
    contentType,
  };
}

async function uploadToR2(buffer: Buffer, key: string, contentType: string): Promise<{ key: string }> {
  'use step';

  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const { env } = await import('@nuclom/lib/env/server');

  const accountId = env.R2_ACCOUNT_ID;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const bucketName = env.R2_BUCKET_NAME;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new FatalError('R2 storage not configured');
  }

  const client = new S3Client({
    region: 'auto',
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

  return { key };
}

/**
 * Generate a presigned download URL for a stored file key.
 * Used to get a temporary URL for processing workflows.
 */
async function generatePresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  'use step';

  const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
  const { env } = await import('@nuclom/lib/env/server');

  const accountId = env.R2_ACCOUNT_ID;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const bucketName = env.R2_BUCKET_NAME;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new FatalError('R2 storage not configured');
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Create speaker profiles from meeting participants.
 * This pre-populates speaker data before diarization for easier matching.
 */
async function createSpeakerProfilesFromParticipants(
  _videoId: string,
  organizationId: string,
  participants: MeetingParticipant[],
): Promise<void> {
  'use step';

  if (participants.length === 0) return;

  const { db } = await import('@nuclom/lib/db');
  const { speakerProfiles, members, users } = await import('@nuclom/lib/db/schema');
  const { eq, and } = await import('drizzle-orm');

  try {
    for (const participant of participants) {
      // Try to find existing org member by email
      let userId: string | null = null;
      let existingProfileId: string | null = null;

      if (participant.email) {
        // Look up user by email
        const user = await db.query.users.findFirst({
          where: eq(users.email, participant.email),
          columns: { id: true },
        });

        if (user) {
          userId = user.id;

          // Check if they're an org member
          const member = await db.query.members.findFirst({
            where: and(eq(members.userId, user.id), eq(members.organizationId, organizationId)),
          });

          if (member) {
            // Check if they already have a speaker profile
            const existingProfile = await db.query.speakerProfiles.findFirst({
              where: and(eq(speakerProfiles.userId, user.id), eq(speakerProfiles.organizationId, organizationId)),
            });

            if (existingProfile) {
              existingProfileId = existingProfile.id;
            }
          }
        }
      }

      // Create a new speaker profile if one doesn't exist for this user
      if (!existingProfileId) {
        await db.insert(speakerProfiles).values({
          organizationId,
          userId,
          displayName: participant.name,
        });
      }
    }
  } catch (error) {
    // Log but don't fail the import
    logger.warn({ error: String(error), organizationId }, 'Failed to create speaker profiles from participants');
  }
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// =============================================================================
// Main Workflow
// =============================================================================

/**
 * Handle workflow failure by updating status.
 * Separate step for static analyzer traceability.
 */
async function handleImportFailure(importedMeetingId: string, errorMessage: string): Promise<ImportMeetingResult> {
  'use step';

  const { eq } = await import('drizzle-orm');
  const { db } = await import('@nuclom/lib/db');
  const { importedMeetings } = await import('@nuclom/lib/db/schema');

  await db
    .update(importedMeetings)
    .set({
      importStatus: 'failed',
      importError: errorMessage,
    })
    .where(eq(importedMeetings.id, importedMeetingId));

  return {
    success: false,
    error: errorMessage,
  };
}

/**
 * Create video record step.
 * Separate step for static analyzer traceability.
 */
async function createVideoRecord(
  meetingTitle: string,
  provider: IntegrationProvider,
  videoKey: string,
  estimatedDuration: number,
  userId: string,
  organizationId: string,
): Promise<{ id: string }> {
  'use step';

  const { db } = await import('@nuclom/lib/db');
  const { videos } = await import('@nuclom/lib/db/schema');

  const [video] = await db
    .insert(videos)
    .values({
      title: meetingTitle || 'Meeting Recording',
      description: `Imported from ${provider === 'zoom' ? 'Zoom' : 'Google Meet'}`,
      duration: formatDuration(estimatedDuration),
      videoUrl: videoKey, // Store the key, presigned URLs are generated on access
      authorId: userId,
      organizationId,
      processingStatus: 'pending',
    })
    .returning();

  return video;
}

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
 *
 * Note: Step calls are at top level (not inside try/catch) so the workflow
 * static analyzer can trace them for the debug UI.
 */
export async function importMeetingWorkflow(input: ImportMeetingInput): Promise<ImportMeetingResult> {
  'use workflow';

  const {
    importedMeetingId,
    provider,
    externalId,
    downloadUrl,
    meetingTitle,
    userId,
    organizationId,
    accessToken,
    participants,
  } = input;

  // Step 1: Update import status to downloading
  const downloadingResult = await updateImportStatus(importedMeetingId, 'downloading').catch((error) => ({
    error: error instanceof Error ? error.message : String(error),
  }));
  if (downloadingResult && 'error' in downloadingResult) {
    return handleImportFailure(importedMeetingId, downloadingResult.error);
  }

  // Step 2: Download the recording from provider
  let downloadResult: { buffer: Buffer; contentType: string };

  if (provider === 'zoom') {
    const zoomResult = await downloadZoomRecording(downloadUrl, accessToken).catch((error) => ({
      error: error instanceof Error ? error.message : String(error),
    }));
    if ('error' in zoomResult) {
      return handleImportFailure(importedMeetingId, zoomResult.error);
    }
    downloadResult = zoomResult;
  } else {
    const googleResult = await downloadGoogleMeetRecording(externalId, accessToken).catch((error) => ({
      error: error instanceof Error ? error.message : String(error),
    }));
    if ('error' in googleResult) {
      return handleImportFailure(importedMeetingId, googleResult.error);
    }
    downloadResult = googleResult;
  }

  // Step 3: Upload to R2 storage
  const filename = `${externalId}.mp4`;
  const key = `videos/${organizationId}/${filename}`;
  const uploadResult = await uploadToR2(downloadResult.buffer, key, downloadResult.contentType).catch((error) => ({
    error: error instanceof Error ? error.message : String(error),
    isFatal: error instanceof FatalError,
  }));
  if ('error' in uploadResult) {
    if (uploadResult.isFatal) {
      await handleImportFailure(importedMeetingId, uploadResult.error);
      throw new FatalError(uploadResult.error);
    }
    return handleImportFailure(importedMeetingId, uploadResult.error);
  }

  // Step 4: Update status to processing
  await updateImportStatus(importedMeetingId, 'processing');

  // Step 5: Create video record (store the key, not a URL)
  const estimatedDuration = Math.round(downloadResult.buffer.length / 100000);
  const video = await createVideoRecord(
    meetingTitle,
    provider,
    uploadResult.key,
    estimatedDuration,
    userId,
    organizationId,
  );

  // Step 6: Update imported meeting with video ID
  await updateImportStatus(importedMeetingId, 'completed', {
    videoId: video.id,
    importedAt: new Date(),
  });

  // Step 7: Create speaker profiles from participants (if available)
  if (participants && participants.length > 0) {
    await createSpeakerProfilesFromParticipants(video.id, organizationId, participants);
  }

  // Step 8: Generate presigned URL for processing workflow
  const presignedUrl = await generatePresignedUrl(uploadResult.key);

  // Step 9: Trigger video processing workflow
  // This is a separate durable workflow that will handle transcription and AI analysis
  // Pass participant names for improved transcription accuracy
  const participantNames = participants?.map((p) => p.name) ?? [];

  await processVideoWorkflow({
    videoId: video.id,
    videoUrl: presignedUrl,
    videoTitle: meetingTitle,
    organizationId,
    participantNames,
  });

  return {
    success: true,
    videoId: video.id,
  };
}
