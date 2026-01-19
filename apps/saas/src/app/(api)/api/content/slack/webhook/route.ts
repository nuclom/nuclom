/**
 * Slack Content Webhook Handler
 *
 * POST /api/content/slack/webhook - Handle real-time Slack events for content sync
 */

import { Effect } from 'effect';
import { NextResponse } from 'next/server';
import { createPublicLayer } from '@nuclom/lib/api-handler';
import { ContentRepository, verifySlackSignature } from '@nuclom/lib/effect/services/content';
import { env } from '@nuclom/lib/env/server';
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

  // Get signing secret
  const signingSecret = env.SLACK_CONTENT_SIGNING_SECRET;
  if (!signingSecret) {
    logger.warn('[Slack Webhook] No signing secret configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  // Verify signature using the pure function
  const isValid = verifySlackSignature(slackSignature, slackTimestamp, signingSecret, rawBody);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
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

      // Find content source for this team
      // We need to search across all sources and filter by team ID
      const allSlackSources = yield* contentRepo.getSources({
        organizationId: '', // Search all orgs
        type: 'slack',
      });

      const relevantSources = allSlackSources.items.filter((source) => {
        const config = source.config as { settings?: { teamId?: string } } | null;
        const credentials = source.credentials as { teamId?: string } | null;
        return config?.settings?.teamId === teamId || credentials?.teamId === teamId;
      });

      if (relevantSources.length === 0) {
        logger.debug('[Slack Webhook] No relevant sources found', { teamId });
        return { success: true, processed: false };
      }

      // Log the event - actual sync can be triggered separately
      logger.info('[Slack Webhook] Found relevant sources', {
        count: relevantSources.length,
        teamId,
        eventType: event.type,
      });

      return { success: true, processed: true };
    });

    // Run asynchronously and return immediately (Slack expects fast response)
    Effect.runPromise(Effect.provide(processEffect, createPublicLayer())).catch((err) => {
      logger.error('[Slack Content Webhook Process Error]', err instanceof Error ? err : new Error(String(err)));
    });

    // Log event type for debugging
    logger.info('[Slack Content Event]', { eventType: event.type, teamId });
  }

  return NextResponse.json({ ok: true });
}
