/**
 * Notifications
 *
 * Functions for sending video processing completion notifications.
 */

import { createWorkflowLogger } from '../workflow-logger';
import type { VideoProcessingResult } from './types';

const log = createWorkflowLogger('video-processing:notifications');

/**
 * Send completion notification (in-app, email, and Slack)
 */
export async function sendCompletionNotification(
  videoId: string,
  status: 'completed' | 'failed',
  errorMessage?: string,
): Promise<void> {
  'use step';

  try {
    const { db } = await import('@nuclom/lib/db');
    const { notifications } = await import('@nuclom/lib/db/schema');
    const { resend } = await import('@nuclom/lib/email');
    const { env, getAppUrl } = await import('@nuclom/lib/env/server');
    const { notifySlackMonitoring } = await import('@nuclom/lib/effect/services/slack-monitoring');

    const video = await db.query.videos.findFirst({
      where: (v, { eq: eqOp }) => eqOp(v.id, videoId),
    });

    if (!video || !video.authorId) return;

    const authorId = video.authorId;
    const user = await db.query.users.findFirst({
      where: (u, { eq: eqOp }) => eqOp(u.id, authorId),
    });

    if (!user?.email) return;

    const baseUrl = getAppUrl();

    // Create in-app notification
    await db.insert(notifications).values({
      userId: user.id,
      type: status === 'completed' ? 'video_processing_complete' : 'video_processing_failed',
      title: status === 'completed' ? 'Video processing complete' : 'Video processing failed',
      body:
        status === 'completed'
          ? `"${video.title}" has finished processing and is now ready to view with AI insights.`
          : `"${video.title}" failed to process. ${errorMessage || 'Please try again.'}`,
      resourceType: 'video',
      resourceId: videoId,
    });

    // Send email notification
    const fromEmail = env.RESEND_FROM_EMAIL ?? 'notifications@nuclom.com';
    await resend.emails.send({
      from: fromEmail,
      to: user.email,
      subject:
        status === 'completed' ? `Your video "${video.title}" is ready!` : `Video processing failed: "${video.title}"`,
      html: `
        <h2>${status === 'completed' ? 'Video Processing Complete' : 'Video Processing Failed'}</h2>
        <p>Hi ${user.name || 'there'},</p>
        <p>${
          status === 'completed'
            ? `Your video "${video.title}" has finished processing and is now ready with AI-generated summaries, transcriptions, and more.`
            : `Your video "${video.title}" failed to process. ${errorMessage || 'Please try again.'}`
        }</p>
        <p><a href="${baseUrl}/videos/${videoId}">View Video</a></p>
      `,
    });

    // Send Slack monitoring notification
    await notifySlackMonitoring(status === 'completed' ? 'video_processed' : 'video_processing_failed', {
      videoId,
      videoTitle: video.title,
      organizationId: video.organizationId,
      userId: user.id,
      userName: user.name || undefined,
      errorMessage: status === 'failed' ? errorMessage : undefined,
    });
  } catch (error) {
    log.error({ videoId, status, error }, 'Failed to send notification');
  }
}

/**
 * Handle workflow failure by updating status and sending notification.
 * This is a separate step so the static analyzer can trace it.
 */
export async function handleWorkflowFailure(
  videoId: string,
  errorMessage: string,
  stackTrace?: string,
): Promise<VideoProcessingResult> {
  'use step';

  try {
    const { eq } = await import('drizzle-orm');
    const { db } = await import('@nuclom/lib/db');
    const { videos, notifications } = await import('@nuclom/lib/db/schema');
    const { resend } = await import('@nuclom/lib/email');
    const { env, getAppUrl } = await import('@nuclom/lib/env/server');
    const { notifySlackMonitoring } = await import('@nuclom/lib/effect/services/slack-monitoring');

    // Update video status to failed
    await db
      .update(videos)
      .set({
        processingStatus: 'failed',
        processingError: errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(videos.id, videoId));

    // Get video and user info for notification
    const video = await db.query.videos.findFirst({
      where: (v, { eq: eqOp }) => eqOp(v.id, videoId),
    });

    if (video?.authorId) {
      const authorId = video.authorId;
      const user = await db.query.users.findFirst({
        where: (u, { eq: eqOp }) => eqOp(u.id, authorId),
      });

      if (user?.email) {
        const baseUrl = getAppUrl();

        // Create in-app notification
        await db.insert(notifications).values({
          userId: user.id,
          type: 'video_processing_failed',
          title: 'Video processing failed',
          body: `"${video.title}" failed to process. ${errorMessage}`,
          resourceType: 'video',
          resourceId: videoId,
        });

        // Send email notification
        const fromEmail = env.RESEND_FROM_EMAIL ?? 'notifications@nuclom.com';
        await resend.emails.send({
          from: fromEmail,
          to: user.email,
          subject: `Video processing failed: "${video.title}"`,
          html: `
            <h2>Video Processing Failed</h2>
            <p>Hi ${user.name || 'there'},</p>
            <p>Your video "${video.title}" failed to process. ${errorMessage}</p>
            <p><a href="${baseUrl}/videos/${videoId}">View Video</a></p>
          `,
        });

        // Send Slack monitoring notification with stack trace
        await notifySlackMonitoring('video_processing_failed', {
          videoId,
          videoTitle: video.title,
          organizationId: video.organizationId,
          userId: user.id,
          userName: user.name || undefined,
          userEmail: user.email,
          errorMessage,
          stackTrace,
        });
      }
    }
  } catch (notifyError) {
    log.error({ videoId, notifyError }, 'Failed to send failure notification');
  }

  return {
    videoId,
    success: false,
    error: errorMessage,
  };
}
