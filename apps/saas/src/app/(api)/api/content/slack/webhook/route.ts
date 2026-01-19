/**
 * Slack Content Webhook Handler
 *
 * POST /api/content/slack/webhook - Handle real-time Slack events for content sync
 */

import { Effect } from 'effect';
import { NextResponse } from 'next/server';
import { createPublicLayer } from '@nuclom/lib/api-handler';
import {
  ContentRepository,
  SlackContentAdapter,
  handleSlackEvent,
  verifySlackSignature,
} from '@nuclom/lib/effect/services/content';
import { logger } from '@nuclom/lib/logger';

interface SlackEventPayload {
  type: string;
  token?: string;
  challenge?: string;
  team_id?: string;
  event?: {
    type: string;
    subtype?: string;
    user?: string;
    channel?: string;
    channel_type?: string;
    text?: string;
    ts?: string;
    thread_ts?: string;
    files?: Array<{
      id: string;
      name: string;
      mimetype: string;
      url_private?: string;
    }>;
    message?: {
      type: string;
      user?: string;
      text?: string;
      ts?: string;
    };
    previous_message?: {
      type: string;
      user?: string;
      text?: string;
      ts?: string;
    };
  };
  event_id?: string;
  event_time?: number;
}

export async function POST(request: Request) {
  const slackSignature = request.headers.get('x-slack-signature');
  const slackTimestamp = request.headers.get('x-slack-request-timestamp');
  const rawBody = await request.text();

  // Verify the request is from Slack
  if (!slackSignature || !slackTimestamp) {
    return NextResponse.json({ error: 'Missing Slack signature' }, { status: 401 });
  }

  // Verify signature
  const verifyEffect = Effect.gen(function* () {
    return yield* verifySlackSignature(slackSignature, slackTimestamp, rawBody);
  });

  try {
    const isValid = await Effect.runPromise(Effect.provide(verifyEffect, createPublicLayer()));

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  } catch (err) {
    logger.error('[Slack Content Webhook Signature Error]', err);
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
  if (payload.type === 'event_callback' && payload.event && payload.team_id) {
    const event = payload.event;
    const teamId = payload.team_id;

    // Process the event asynchronously
    const processEffect = Effect.gen(function* () {
      const contentRepo = yield* ContentRepository;
      const slackAdapter = yield* SlackContentAdapter;

      // Find content source for this team
      // We need to search across all sources since we don't know the org yet
      // This is a limitation - we'd need a separate lookup table for team -> source mapping
      // For now, we'll use the handleSlackEvent which handles the lookup

      yield* handleSlackEvent(teamId, {
        type: event.type,
        subtype: event.subtype,
        channel: event.channel,
        channelType: event.channel_type,
        user: event.user,
        text: event.text,
        ts: event.ts,
        threadTs: event.thread_ts,
        eventId: payload.event_id,
        eventTime: payload.event_time,
        message: event.message,
        previousMessage: event.previous_message,
      });

      return { success: true };
    });

    // Run asynchronously and return immediately (Slack expects fast response)
    Effect.runPromise(Effect.provide(processEffect, createPublicLayer())).catch((err) => {
      logger.error('[Slack Content Webhook Process Error]', err);
    });

    // Log event type for debugging
    logger.info('[Slack Content Event]', { eventType: event.type, teamId });
  }

  return NextResponse.json({ ok: true });
}
