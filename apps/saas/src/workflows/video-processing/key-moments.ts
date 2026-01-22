/**
 * Key Moments Detection
 *
 * Functions for detecting and saving key moments in videos.
 */

import type { TranscriptSegment } from '@nuclom/lib/db/schema';
import { createWorkflowLogger } from '../workflow-logger';
import type { DetectedMoment } from './types';

const log = createWorkflowLogger('video-processing:moments');

/**
 * Detect key moments in a video transcript using AI
 */
export async function detectKeyMoments(
  _transcript: string,
  segments: TranscriptSegment[],
  videoTitle?: string,
): Promise<DetectedMoment[]> {
  'use step';

  const { gateway } = await import('@ai-sdk/gateway');
  const { generateObject, jsonSchema } = await import('ai');

  // Use Vercel AI Gateway
  const model = gateway('xai/grok-3');

  // Schema for moment detection
  const momentsSchema = jsonSchema<{
    moments: Array<{
      title: string;
      description?: string;
      startTime: number;
      endTime: number;
      momentType:
        | 'decision'
        | 'action_item'
        | 'question'
        | 'answer'
        | 'emphasis'
        | 'demonstration'
        | 'conclusion'
        | 'highlight';
      confidence: number;
      transcriptExcerpt: string;
    }>;
  }>({
    type: 'object',
    properties: {
      moments: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'A concise title for the moment (max 100 chars)' },
            description: { type: 'string', description: 'Brief description of what happens in this moment' },
            startTime: { type: 'number', description: 'Start time in seconds' },
            endTime: { type: 'number', description: 'End time in seconds' },
            momentType: {
              type: 'string',
              enum: [
                'decision',
                'action_item',
                'question',
                'answer',
                'emphasis',
                'demonstration',
                'conclusion',
                'highlight',
              ],
              description: 'Type of moment detected',
            },
            confidence: { type: 'number', description: 'Confidence score 0-100' },
            transcriptExcerpt: { type: 'string', description: 'The relevant transcript excerpt for this moment' },
          },
          required: ['title', 'startTime', 'endTime', 'momentType', 'confidence', 'transcriptExcerpt'],
        },
        description: 'Key moments detected in the video',
      },
    },
    required: ['moments'],
  });

  // Prepare transcript with timestamps
  const timestampedTranscript = segments
    .map((s) => `[${Math.floor(s.startTime)}s-${Math.floor(s.endTime)}s] ${s.text}`)
    .join('\n');

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
      prompt: `Video Title: ${videoTitle || 'Untitled'}

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
    log.error({ error }, 'Failed to detect key moments');
    return [];
  }
}

/**
 * Save detected key moments to the database
 */
export async function saveKeyMoments(
  videoId: string,
  organizationId: string,
  moments: DetectedMoment[],
): Promise<void> {
  'use step';

  const { eq } = await import('drizzle-orm');
  const { db } = await import('@nuclom/lib/db');
  const { videoMoments } = await import('@nuclom/lib/db/schema');

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
