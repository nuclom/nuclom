/**
 * Title Generation
 *
 * Functions for generating AI-powered video titles from transcripts.
 */

import { createWorkflowLogger } from '../workflow-logger';

const log = createWorkflowLogger('video-processing:title');

/**
 * Check if a title looks like a filename or is missing/empty
 */
export function needsTitleGeneration(title?: string): boolean {
  if (!title || title.trim() === '') return true;

  // Common filename patterns to detect
  const filenamePatterns = [
    /\.(mp4|mov|webm|avi|mkv|m4v)$/i, // File extensions
    /^(video|recording|screen|capture|clip|untitled)[-_\s]?\d*/i, // Common auto-names
    /^\d{8,}[-_]?\d*$/, // Timestamp-only names like 20240115 or 20240115_143022
    /^[a-f0-9]{8,}$/i, // Hash-like names
    /^IMG_?\d+$/i, // Camera roll names
    /^VID_?\d+$/i, // Video camera names
    /^Screen\s*(Shot|Recording)/i, // Screen recordings
  ];

  return filenamePatterns.some((pattern) => pattern.test(title.trim()));
}

/**
 * Generate a descriptive title from the transcript using AI
 */
export async function generateVideoTitle(transcript: string): Promise<string | null> {
  'use step';

  if (!transcript || transcript.trim().length < 50) {
    return null; // Not enough content to generate a meaningful title
  }

  const { gateway } = await import('@ai-sdk/gateway');
  const { generateObject, jsonSchema } = await import('ai');

  const model = gateway('xai/grok-3');

  const titleSchema = jsonSchema<{ title: string }>({
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'A concise, descriptive title for the video (5-10 words max)',
      },
    },
    required: ['title'],
  });

  try {
    const result = await generateObject({
      model,
      schema: titleSchema,
      system: `Generate a concise, descriptive title for a video based on its transcript.

Guidelines:
- Keep it under 10 words
- Focus on the main topic or purpose of the video
- Use title case
- Don't include generic words like "Video", "Recording", or "Meeting" unless necessary for context
- Make it specific and informative
- If it's a meeting, mention the key topic discussed
- If it's a tutorial/demo, mention what's being demonstrated`,
      prompt: `Generate a title for this video based on its transcript:\n\n${transcript.slice(0, 3000)}`,
    });

    return result.object?.title || null;
  } catch (error) {
    log.warn({ error }, 'Failed to generate video title');
    return null;
  }
}

/**
 * Save an AI-generated title to the video record
 */
export async function saveVideoTitle(videoId: string, title: string): Promise<void> {
  'use step';

  const { eq } = await import('drizzle-orm');
  const { db } = await import('@nuclom/lib/db');
  const { videos } = await import('@nuclom/lib/db/schema');

  await db
    .update(videos)
    .set({
      title,
      updatedAt: new Date(),
    })
    .where(eq(videos.id, videoId));

  log.info({ videoId, title }, 'Saved AI-generated video title');
}
