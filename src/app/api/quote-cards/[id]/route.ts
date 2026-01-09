import { Effect } from 'effect';
import type { NextRequest } from 'next/server';
import { createFullLayer, createPublicLayer, handleEffectExit } from '@/lib/api-handler';
import { ClipRepository } from '@/lib/effect';
import { Auth } from '@/lib/effect/services/auth';
import { validateRequestBody } from '@/lib/validation';
import { UpdateQuoteCardSchema } from '@/lib/validation/schemas';

// =============================================================================
// GET /api/quote-cards/[id] - Get a single quote card
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const { id: cardId } = yield* Effect.promise(() => params);

    const clipRepo = yield* ClipRepository;
    const card = yield* clipRepo.getQuoteCard(cardId);

    return {
      success: true,
      data: card,
    };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// =============================================================================
// PATCH /api/quote-cards/[id] - Update a quote card
// =============================================================================

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    const { id: cardId } = yield* Effect.promise(() => params);

    // Validate request body
    const validatedData = yield* validateRequestBody(UpdateQuoteCardSchema, request);

    // Update quote card
    const clipRepo = yield* ClipRepository;
    const updatedCard = yield* clipRepo.updateQuoteCard(cardId, {
      quoteText: validatedData.quoteText,
      speaker: validatedData.speaker,
    });

    return {
      success: true,
      data: updatedCard,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// =============================================================================
// DELETE /api/quote-cards/[id] - Delete a quote card
// =============================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    const { id: cardId } = yield* Effect.promise(() => params);

    // Delete quote card
    const clipRepo = yield* ClipRepository;
    yield* clipRepo.deleteQuoteCard(cardId);

    return {
      success: true,
      message: 'Quote card deleted successfully',
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
