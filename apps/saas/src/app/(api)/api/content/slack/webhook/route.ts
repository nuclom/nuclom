/**
 * Slack Content Webhook Handler
 *
 * POST /api/content/slack/webhook - Handle real-time Slack events for content sync
 */

import { createPublicLayer } from '@nuclom/lib/api-handler';
import { ContentRepository, SlackContentAdapter, verifySlackSignature } from '@nuclom/lib/effect/services/content';
import { SlackContentAdapterLive } from '@nuclom/lib/effect/services/content/slack-content-adapter';
import { DatabaseLive } from '@nuclom/lib/effect/services/database';
import { env } from '@nuclom/lib/env/server';
import { logger } from '@nuclom/lib/logger';
import { Effect, Layer } from 'effect';
import { NextResponse } from 'next/server';
import { processContentWorkflow } from '@/workflows/content-processing';

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

      logger.info('[Slack Webhook] Found relevant sources', {
        count: relevantSources.length,
        teamId,
        eventType: event.type,
      });

      // Process the event for each relevant source
      const adapter = yield* SlackContentAdapter;

      for (const source of relevantSources) {
        const rawItem = yield* adapter.handleEvent(source, event).pipe(Effect.catchAll(() => Effect.succeed(null)));

        if (rawItem) {
          // Save the content item (processingStatus defaults to 'pending' in schema)
          const saved = yield* contentRepo.upsertItem({
            organizationId: source.organizationId,
            sourceId: source.id,
            type: rawItem.type,
            externalId: rawItem.externalId,
            title: rawItem.title,
            content: rawItem.content,
            contentHtml: rawItem.contentHtml,
            authorName: rawItem.authorName,
            authorExternal: rawItem.authorExternal,
            createdAtSource: rawItem.createdAtSource,
            updatedAtSource: rawItem.updatedAtSource,
            metadata: rawItem.metadata,
          });

          logger.info('[Slack Webhook] Saved content item', {
            contentItemId: saved.id,
            sourceId: source.id,
            type: rawItem.type,
          });

          // Trigger async processing (fire-and-forget)
          processContentWorkflow({
            contentItemId: saved.id,
            organizationId: source.organizationId,
            sourceType: 'slack',
          }).catch((err) => {
            logger.error('[Slack Webhook] Workflow failed', err instanceof Error ? err : new Error(String(err)));
          });
        }
      }

      return { success: true, processed: true };
    });

    // Run asynchronously and return immediately (Slack expects fast response)
    // Create layer with SlackContentAdapter
    const SlackAdapterWithDeps = SlackContentAdapterLive.pipe(Layer.provide(DatabaseLive));
    const fullLayer = Layer.merge(createPublicLayer(), SlackAdapterWithDeps);

    Effect.runPromise(Effect.provide(processEffect, fullLayer)).catch((err) => {
      logger.error('[Slack Content Webhook Process Error]', err instanceof Error ? err : new Error(String(err)));
    });

    // Log event type for debugging
    logger.info('[Slack Content Event]', { eventType: event.type, teamId });
  }

  return NextResponse.json({ ok: true });
}
