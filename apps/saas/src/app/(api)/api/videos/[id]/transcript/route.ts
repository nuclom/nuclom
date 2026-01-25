/**
 * Transcript API Endpoint
 *
 * Manages video transcripts including editing and saving corrections.
 *
 * GET /api/videos/[id]/transcript - Get transcript segments
 * PUT /api/videos/[id]/transcript - Update transcript segments
 */

import { handleEffectExit, runApiEffect } from '@nuclom/lib/api-handler';
import type { TranscriptSegment } from '@nuclom/lib/db/schema';
import { ValidationError } from '@nuclom/lib/effect/errors';
import { VideoRepository } from '@nuclom/lib/effect/services/video-repository';
import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// Validation Schemas
// =============================================================================

const TranscriptSegmentSchema = Schema.Struct({
  startTime: Schema.Number,
  endTime: Schema.Number,
  text: Schema.String,
  confidence: Schema.optional(Schema.Number),
});

const UpdateTranscriptSchema = Schema.Struct({
  segments: Schema.Array(TranscriptSegmentSchema),
});

// =============================================================================
// GET /api/videos/[id]/transcript - Get Transcript
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const { id } = yield* Effect.promise(() => params);

    // Fetch video with transcript using repository
    const videoRepo = yield* VideoRepository;
    const videoData = yield* videoRepo.getVideo(id);

    return {
      success: true,
      data: {
        videoId: id,
        title: videoData.title,
        transcript: videoData.transcript,
        segments: videoData.transcriptSegments || [],
        processingStatus: videoData.processingStatus,
      },
    };
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}

// =============================================================================
// PUT /api/videos/[id]/transcript - Update Transcript
// =============================================================================

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const { id } = yield* Effect.promise(() => params);

    // Parse and validate request body
    const body = yield* Effect.tryPromise({
      try: () => request.json(),
      catch: () =>
        new ValidationError({
          message: 'Invalid request body',
        }),
    });

    // Validate with schema
    const parseResult = Schema.decodeUnknownEither(UpdateTranscriptSchema)(body);
    if (parseResult._tag === 'Left') {
      return yield* Effect.fail(
        new ValidationError({
          message: 'Invalid transcript data format',
        }),
      );
    }

    const { segments } = parseResult.right;

    // Validate segment times
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (segment.startTime < 0 || segment.endTime < 0) {
        return yield* Effect.fail(
          new ValidationError({
            message: `Segment ${i + 1} has invalid timestamps`,
          }),
        );
      }
      if (segment.startTime >= segment.endTime) {
        return yield* Effect.fail(
          new ValidationError({
            message: `Segment ${i + 1} start time must be before end time`,
          }),
        );
      }
      if (!segment.text.trim()) {
        return yield* Effect.fail(
          new ValidationError({
            message: `Segment ${i + 1} has empty text`,
          }),
        );
      }
    }

    // Check segments are in order
    for (let i = 1; i < segments.length; i++) {
      if (segments[i].startTime < segments[i - 1].startTime) {
        return yield* Effect.fail(
          new ValidationError({
            message: `Segments must be in chronological order (issue at segment ${i + 1})`,
          }),
        );
      }
    }

    // Generate full transcript text from segments
    const fullTranscript = segments.map((s) => s.text).join(' ');

    // Map validated segments to TranscriptSegment type
    const transcriptSegments: TranscriptSegment[] = segments.map((s) => ({
      startTime: s.startTime,
      endTime: s.endTime,
      text: s.text,
      confidence: s.confidence,
    }));

    // Update video with new transcript using repository
    const videoRepo = yield* VideoRepository;
    yield* videoRepo.updateVideo(id, {
      transcript: fullTranscript,
      transcriptSegments,
    });

    return {
      success: true,
      data: {
        videoId: id,
        segments,
        message: 'Transcript updated successfully',
      },
    };
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}
