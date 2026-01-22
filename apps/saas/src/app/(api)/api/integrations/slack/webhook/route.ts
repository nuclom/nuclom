import { Slack, SlackLive } from '@nuclom/lib/effect/services/slack';
import { SlackClientLive } from '@nuclom/lib/effect/services/slack-client';
import { logger } from '@nuclom/lib/logger';
import { Effect, Layer } from 'effect';
import { NextResponse } from 'next/server';

interface SlackEventPayload {
  type: string;
  token?: string;
  challenge?: string;
  team_id?: string;
  event?: {
    type: string;
    user?: string;
    channel?: string;
    text?: string;
    ts?: string;
  };
}

export async function POST(request: Request) {
  const slackSignature = request.headers.get('x-slack-signature');
  const slackTimestamp = request.headers.get('x-slack-request-timestamp');
  const rawBody = await request.text();

  // Verify the request is from Slack
  if (!slackSignature || !slackTimestamp) {
    return NextResponse.json({ error: 'Missing Slack signature' }, { status: 401 });
  }

  const effect = Effect.gen(function* () {
    const slack = yield* Slack;
    const isValid = yield* slack.verifySignature(slackSignature, slackTimestamp, rawBody);
    return isValid;
  });

  try {
    const slackLayer = SlackLive.pipe(Layer.provide(SlackClientLive));
    const isValid = await Effect.runPromise(Effect.provide(effect, slackLayer));

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  } catch (err) {
    logger.error('Slack webhook signature error', err instanceof Error ? err : new Error(String(err)), {
      component: 'slack-webhook',
    });
    return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 });
  }

  // Parse the payload
  let payload: SlackEventPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Handle URL verification challenge
  if (payload.type === 'url_verification' && payload.challenge) {
    return NextResponse.json({ challenge: payload.challenge });
  }

  // Handle event callbacks
  if (payload.type === 'event_callback' && payload.event) {
    const event = payload.event;

    switch (event.type) {
      case 'app_home_opened':
        // User opened the app home tab
        logger.info('App home opened by user', { userId: event.user, component: 'slack-webhook' });
        break;

      case 'message':
        // Handle direct messages to the bot
        logger.info('Message received', { text: event.text, component: 'slack-webhook' });
        break;

      case 'app_mention':
        // Bot was mentioned in a channel
        logger.info('App mentioned', { text: event.text, component: 'slack-webhook' });
        break;

      default:
        logger.info('Unhandled event type', { eventType: event.type, component: 'slack-webhook' });
    }
  }

  return NextResponse.json({ ok: true });
}
