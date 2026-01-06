import { Cause, Effect, Exit } from 'effect';
import { type NextRequest, NextResponse } from 'next/server';
import { createFullLayer, createPublicLayer, handleEffectExit, mapErrorToApiResponse } from '@/lib/api-handler';
import { ClipRepository, VideoRepository } from '@/lib/effect';
import { Auth } from '@/lib/effect/services/auth';
import { validateQueryParams, validateRequestBody } from '@/lib/validation';
import { createQuoteCardSchema, PaginationSchema } from '@/lib/validation/schemas';

// =============================================================================
// GET /api/videos/[id]/quote-cards - List all quote cards for a video
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const { id: videoId } = yield* Effect.promise(() => params);

    // Validate pagination params
    const queryParams = yield* validateQueryParams(PaginationSchema, request.url);

    // Get quote cards
    const clipRepo = yield* ClipRepository;
    const result = yield* clipRepo.getQuoteCards(videoId, queryParams.page, queryParams.limit);

    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// =============================================================================
// POST /api/videos/[id]/quote-cards - Create a new quote card
// =============================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const { id: videoId } = yield* Effect.promise(() => params);

    // Verify video exists and get organization
    const videoRepo = yield* VideoRepository;
    const video = yield* videoRepo.getVideo(videoId);

    // Validate request body
    const validatedData = yield* validateRequestBody(createQuoteCardSchema, request);

    // Create quote card
    const clipRepo = yield* ClipRepository;
    const newCard = yield* clipRepo.createQuoteCard({
      videoId,
      organizationId: video.organizationId,
      quoteText: validatedData.quoteText,
      speaker: validatedData.speaker ?? undefined,
      timestampSeconds: validatedData.timestampSeconds ?? undefined,
      template: validatedData.templateId ? { templateId: validatedData.templateId } : undefined,
      createdBy: user.id,
    });

    return newCard;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === 'Some') {
        return mapErrorToApiResponse(error.value);
      }
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    },
    onSuccess: (data) => NextResponse.json({ success: true, data }, { status: 201 }),
  });
}
