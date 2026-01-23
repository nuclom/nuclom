import { createPublicLayer, handleEffectExitWithStatus } from '@nuclom/lib/api-handler';
import { SlackMonitoring } from '@nuclom/lib/effect/services/slack-monitoring';
import { validateRequestBody } from '@nuclom/lib/validation';
import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';

const ContactRequestSchema = Schema.Struct({
  firstName: Schema.String.pipe(Schema.minLength(1)),
  lastName: Schema.String.pipe(Schema.minLength(1)),
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
  phone: Schema.optional(Schema.String),
  company: Schema.String.pipe(Schema.minLength(1)),
  jobTitle: Schema.optional(Schema.String),
  teamSize: Schema.optional(Schema.String),
  industry: Schema.optional(Schema.String),
  useCase: Schema.optional(Schema.String),
  timeline: Schema.optional(Schema.String),
});

export async function POST(request: NextRequest) {
  const effect = Effect.gen(function* () {
    const body = yield* validateRequestBody(ContactRequestSchema, request);

    const slackMonitoring = yield* SlackMonitoring;
    yield* slackMonitoring.sendAccountEvent('contact_inquiry', {
      userName: `${body.firstName} ${body.lastName}`,
      userEmail: body.email,
      phone: body.phone,
      company: body.company,
      jobTitle: body.jobTitle,
      teamSize: body.teamSize,
      industry: body.industry,
      useCase: body.useCase,
      timeline: body.timeline,
    });

    return { success: true, message: 'Contact request submitted successfully' };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExitWithStatus(exit, 201);
}
