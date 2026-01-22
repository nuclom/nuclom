/**
 * Transcription Helpers
 *
 * Functions for transcribing video content using Replicate/Whisper.
 */

import type { TranscriptSegment } from '@nuclom/lib/db/schema';
import { FatalError } from 'workflow';
import { createWorkflowLogger } from '../workflow-logger';
import type { TranscriptionResult } from './types';

const log = createWorkflowLogger('video-processing:transcription');

/**
 * Transcribe a video using Replicate's Whisper model
 */
export async function transcribeVideo(
  videoUrl: string,
  options?: { vocabularyTerms?: string[]; participantNames?: string[] },
): Promise<TranscriptionResult> {
  'use step';

  const { env } = await import('@nuclom/lib/env/server');
  const replicateToken = env.REPLICATE_API_TOKEN;
  if (!replicateToken) {
    throw new FatalError('Replicate API token not configured. Please set REPLICATE_API_TOKEN.');
  }

  // Use Replicate's Whisper model for transcription
  // This keeps all AI services routed through managed gateways/services
  const { default: Replicate } = await import('replicate');
  const replicate = new Replicate({ auth: replicateToken });

  const WHISPER_MODEL = 'openai/whisper:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e';

  // Build initial_prompt from vocabulary terms and participant names
  // This biases Whisper toward recognizing these terms correctly
  const promptTerms: string[] = [];
  if (options?.vocabularyTerms && options.vocabularyTerms.length > 0) {
    promptTerms.push(...options.vocabularyTerms);
  }
  if (options?.participantNames && options.participantNames.length > 0) {
    promptTerms.push(...options.participantNames);
  }
  const initialPrompt = promptTerms.length > 0 ? promptTerms.join(', ') : undefined;

  if (initialPrompt) {
    log.info({ termCount: promptTerms.length }, 'Using vocabulary-aware transcription');
  }

  const output = (await replicate.run(WHISPER_MODEL as `${string}/${string}`, {
    input: {
      audio: videoUrl,
      model: 'large-v3',
      translate: false,
      temperature: 0,
      transcription: 'plain text',
      suppress_tokens: '-1',
      logprob_threshold: -1,
      no_speech_threshold: 0.6,
      condition_on_previous_text: true,
      compression_ratio_threshold: 2.4,
      // Vocabulary injection: initial_prompt biases the model toward these terms
      ...(initialPrompt && { initial_prompt: initialPrompt }),
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
    transcript: output.transcription || '',
    segments,
    duration,
    language: output.detected_language,
  };
}

/**
 * Save transcript and duration to the video record
 */
export async function saveTranscript(
  videoId: string,
  transcript: string,
  segments: TranscriptSegment[],
  durationSeconds: number,
): Promise<void> {
  'use step';

  const { eq } = await import('drizzle-orm');
  const { db } = await import('@nuclom/lib/db');
  const { videos } = await import('@nuclom/lib/db/schema');
  const { formatDuration } = await import('@nuclom/lib/format-utils');

  await db
    .update(videos)
    .set({
      transcript,
      transcriptSegments: segments,
      duration: formatDuration(durationSeconds),
      updatedAt: new Date(),
    })
    .where(eq(videos.id, videoId));
}
