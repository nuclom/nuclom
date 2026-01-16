/**
 * Transcript API Endpoint
 *
 * Manages video transcripts including editing and saving corrections.
 *
 * GET /api/videos/[id]/transcript - Get transcript segments
 * PUT /api/videos/[id]/transcript - Update transcript segments
 */

import { eq } from 'drizzle-orm';
import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';
import { createPublicLayer, handleEffectExit } from '@/lib/api-handler';
import { db } from '@/lib/db';
import type { TranscriptSegment } from '@/lib/db/schema';
import { videos } from '@/lib/db/schema';
import { DatabaseError, NotFoundError, ValidationError } from '@/lib/effect';

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

    // Fetch video with transcript
    const videoData = yield* Effect.tryPromise({
      try: () =>
        db.query.videos.findFirst({
          where: eq(videos.id, id),
          columns: {
            id: true,
            title: true,
            transcript: true,
            transcriptSegments: true,
            processingStatus: true,
          },
        }),
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch video transcript',
          operation: 'getTranscript',
          cause: error,
        }),
    });

    if (!videoData) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'Video not found',
          entity: 'Video',
          id,
        }),
      );
    }

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

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);
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

    // Check video exists
    const existingVideo = yield* Effect.tryPromise({
      try: () =>
        db.query.videos.findFirst({
          where: eq(videos.id, id),
          columns: { id: true },
        }),
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch video',
          operation: 'updateTranscript',
          cause: error,
        }),
    });

    if (!existingVideo) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'Video not found',
          entity: 'Video',
          id,
        }),
      );
    }

    // Generate full transcript text from segments
    const fullTranscript = segments.map((s) => s.text).join(' ');

    // Update video with new transcript
    yield* Effect.tryPromise({
      try: () =>
        db
          .update(videos)
          .set({
            transcript: fullTranscript,
            transcriptSegments: segments as TranscriptSegment[],
            updatedAt: new Date(),
          })
          .where(eq(videos.id, id)),
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to update transcript',
          operation: 'updateTranscript',
          cause: error,
        }),
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

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
