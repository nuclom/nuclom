import { createFullLayer, handleEffectExit } from '@nuclom/lib/api-handler';
import { KnowledgeGraphRepository } from '@nuclom/lib/effect';
import { Auth } from '@nuclom/lib/effect/services/auth';
import { validateRequestBody } from '@nuclom/lib/validation';
import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// Update Schema
// =============================================================================

const updateDecisionSchema = Schema.Struct({
  summary: Schema.optional(Schema.String.pipe(Schema.maxLength(500))),
  context: Schema.optional(Schema.String.pipe(Schema.maxLength(2000))),
  reasoning: Schema.optional(Schema.String.pipe(Schema.maxLength(1000))),
  timestampStart: Schema.optional(Schema.Number),
  timestampEnd: Schema.optional(Schema.Number),
  decisionType: Schema.optional(Schema.Literal('technical', 'process', 'product', 'team', 'other')),
  status: Schema.optional(Schema.Literal('proposed', 'decided', 'revisited', 'superseded')),
  confidence: Schema.optional(Schema.Number.pipe(Schema.between(0, 100))),
  tags: Schema.optional(Schema.Array(Schema.String)),
});

// =============================================================================
// GET /api/knowledge/decisions/[id] - Get a specific decision
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Get decision
    const repo = yield* KnowledgeGraphRepository;
    return yield* repo.getDecision(id);
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}

// =============================================================================
// PUT /api/knowledge/decisions/[id] - Update a decision
// =============================================================================

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Validate request body
    const data = yield* validateRequestBody(updateDecisionSchema, request);

    // Update decision
    const repo = yield* KnowledgeGraphRepository;
    return yield* repo.updateDecision(id, {
      summary: data.summary,
      context: data.context,
      reasoning: data.reasoning,
      timestampStart: data.timestampStart,
      timestampEnd: data.timestampEnd,
      decisionType: data.decisionType,
      status: data.status,
      confidence: data.confidence,
      tags: data.tags ? [...data.tags] : undefined,
    });
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}

// =============================================================================
// DELETE /api/knowledge/decisions/[id] - Delete a decision
// =============================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Delete decision
    const repo = yield* KnowledgeGraphRepository;
    yield* repo.deleteDecision(id);
    return { success: true };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
