import { createPublicLayer, handleEffectExitWithStatus } from '@nuclom/lib/api-handler';
import { SlackMonitoring } from '@nuclom/lib/effect/services/slack-monitoring';
import { validateRequestBody } from '@nuclom/lib/validation';
import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';

const SupportRequestSchema = Schema.Struct({
  firstName: Schema.String.pipe(Schema.minLength(1)),
  lastName: Schema.String.pipe(Schema.minLength(1)),
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
  subject: Schema.String.pipe(Schema.minLength(1)),
  message: Schema.String.pipe(Schema.minLength(1)),
});

export async function POST(request: NextRequest) {
  const effect = Effect.gen(function* () {
    const body = yield* validateRequestBody(SupportRequestSchema, request);

    const slackMonitoring = yield* SlackMonitoring;
    yield* slackMonitoring.sendAccountEvent('support_request', {
      userName: `${body.firstName} ${body.lastName}`,
      userEmail: body.email,
      subject: body.subject,
      message: body.message,
    });

    return { success: true, message: 'Support request submitted successfully' };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExitWithStatus(exit, 201);
}
