/**
 * Vocabulary Helpers
 *
 * Functions for fetching and applying organization vocabulary corrections
 * to improve transcription accuracy.
 */

import type { TranscriptSegment } from '@nuclom/lib/db/schema';
import { createWorkflowLogger } from '../workflow-logger';

const log = createWorkflowLogger('video-processing:vocabulary');

/**
 * Escape special regex characters in a string
 */
export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Fetch vocabulary terms for an organization to improve transcription accuracy
 */
export async function getVocabularyTerms(organizationId: string): Promise<string[]> {
  'use step';

  const { db } = await import('@nuclom/lib/db');
  const { organizationVocabulary } = await import('@nuclom/lib/db/schema');
  const { eq } = await import('drizzle-orm');

  try {
    const vocabulary = await db.query.organizationVocabulary.findMany({
      where: eq(organizationVocabulary.organizationId, organizationId),
      columns: { term: true },
    });

    return vocabulary.map((v) => v.term);
  } catch (error) {
    log.warn({ organizationId, error }, 'Failed to fetch vocabulary terms');
    return [];
  }
}

/**
 * Apply vocabulary corrections to transcript text and segments
 */
export async function applyVocabularyCorrections(
  organizationId: string,
  transcript: string,
  segments: TranscriptSegment[],
): Promise<{ transcript: string; segments: TranscriptSegment[] }> {
  'use step';

  const { db } = await import('@nuclom/lib/db');
  const { organizationVocabulary } = await import('@nuclom/lib/db/schema');
  const { eq } = await import('drizzle-orm');

  try {
    const vocabulary = await db.query.organizationVocabulary.findMany({
      where: eq(organizationVocabulary.organizationId, organizationId),
      columns: { term: true, variations: true },
    });

    if (vocabulary.length === 0) {
      return { transcript, segments };
    }

    // Apply corrections to transcript
    let correctedTranscript = transcript;
    for (const vocab of vocabulary) {
      for (const variation of vocab.variations) {
        // Case-insensitive word boundary replacement
        const regex = new RegExp(`\\b${escapeRegExp(variation)}\\b`, 'gi');
        correctedTranscript = correctedTranscript.replace(regex, vocab.term);
      }
    }

    // Apply corrections to segments
    const correctedSegments = segments.map((segment) => {
      let correctedText = segment.text;
      for (const vocab of vocabulary) {
        for (const variation of vocab.variations) {
          const regex = new RegExp(`\\b${escapeRegExp(variation)}\\b`, 'gi');
          correctedText = correctedText.replace(regex, vocab.term);
        }
      }
      return { ...segment, text: correctedText };
    });

    log.info({ organizationId, correctionCount: vocabulary.length }, 'Applied vocabulary corrections');

    return { transcript: correctedTranscript, segments: correctedSegments };
  } catch (error) {
    log.warn({ organizationId, error }, 'Failed to apply vocabulary corrections');
    return { transcript, segments };
  }
}
