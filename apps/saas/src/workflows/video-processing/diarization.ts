/**
 * Speaker Diarization
 *
 * Functions for performing speaker diarization using AssemblyAI.
 */

import { sleep } from 'workflow';
import { createWorkflowLogger } from '../workflow-logger';
import type { DiarizationResult, DiarizedSegment, SpeakerSummary } from './types';

const log = createWorkflowLogger('video-processing:diarization');

/**
 * Perform speaker diarization using AssemblyAI
 * Falls back gracefully if not configured
 */
export async function diarizeVideo(videoUrl: string): Promise<DiarizationResult | null> {
  'use step';

  const { env } = await import('@nuclom/lib/env/server');
  const apiKey = env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    log.info({}, 'AssemblyAI not configured, skipping speaker diarization');
    return null;
  }

  const ASSEMBLYAI_API_URL = 'https://api.assemblyai.com/v2';
  const MAX_POLLING_ATTEMPTS = 200; // ~10 minutes with 3-second intervals

  try {
    // Submit transcription request with speaker labels
    const submitResponse = await fetch(`${ASSEMBLYAI_API_URL}/transcript`, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
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
        status: 'queued' | 'processing' | 'completed' | 'error';
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

      if (result.status === 'completed') {
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
          transcript: result.text || '',
          segments,
          speakers,
          duration: durationMs,
          language: result.language_code,
          speakerCount: speakers.length,
        };
      }

      if (result.status === 'error') {
        throw new Error(result.error || 'Diarization failed');
      }

      // Wait before next poll using workflow-native sleep (durable, no resource consumption)
      await sleep('3 seconds');
    }

    throw new Error('Diarization timed out');
  } catch (error) {
    log.error({ error }, 'Speaker diarization failed, continuing without speaker data');
    return null;
  }
}

/**
 * Save speaker diarization results to the database
 */
export async function saveSpeakerData(
  videoId: string,
  organizationId: string,
  diarization: DiarizationResult,
): Promise<void> {
  'use step';

  const { db } = await import('@nuclom/lib/db');
  const { speakerProfiles, videoSpeakers, speakerSegments } = await import('@nuclom/lib/db/schema');

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
    'Saved speaker diarization data',
  );
}
