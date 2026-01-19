import { createPublicLayer, handleEffectExitWithStatus } from '@nuclom/lib/api-handler';
import { SlackMonitoring } from '@nuclom/lib/effect/services/slack-monitoring';
import { validateRequestBody } from '@nuclom/lib/validation';
import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';

const BetaAccessRequestSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1)),
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
  company: Schema.optional(Schema.String),
  useCase: Schema.optional(Schema.String),
});

export async function POST(request: NextRequest) {
  const effect = Effect.gen(function* () {
    const body = yield* validateRequestBody(BetaAccessRequestSchema, request);

    // Send Slack notification
    const slackMonitoring = yield* SlackMonitoring;
    yield* slackMonitoring.sendAccountEvent('beta_access_requested', {
      userName: body.name,
      userEmail: body.email,
      company: body.company,
      useCase: body.useCase,
    });

    return { success: true, message: 'Beta access request submitted successfully' };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExitWithStatus(exit, 201);
}
