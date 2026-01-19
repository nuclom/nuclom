/**
 * Notion Content Webhook Handler
 *
 * POST /api/content/notion/webhook - Handle real-time Notion events for content sync
 *
 * Note: Notion doesn't have traditional webhooks. Instead, we poll for changes.
 * This endpoint handles manual sync triggers and potential future webhook support.
 */

import { Effect } from 'effect';
import { NextResponse } from 'next/server';
import { createPublicLayer } from '@nuclom/lib/api-handler';
import {
  ContentRepository,
  NotionContentAdapter,
  handleNotionWebhook,
  verifyNotionSignature,
} from '@nuclom/lib/effect/services/content';
import { logger } from '@nuclom/lib/logger';

interface NotionWebhookPayload {
  type: string;
  workspace_id?: string;
  page_id?: string;
  database_id?: string;
  action?: 'created' | 'updated' | 'deleted';
  timestamp?: string;
}

export async function POST(request: Request) {
  const signature = request.headers.get('x-notion-signature');
  const timestamp = request.headers.get('x-notion-timestamp');
  const rawBody = await request.text();

  // Verify signature if present (for future webhook support)
  if (signature && timestamp) {
    const verifyEffect = Effect.gen(function* () {
      return yield* verifyNotionSignature(signature, timestamp, rawBody);
    });

    try {
      const isValid = await Effect.runPromise(Effect.provide(verifyEffect, createPublicLayer()));

      if (!isValid) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } catch (err) {
      logger.error('[Notion Content Webhook Signature Error]', err);
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 });
    }
  }

  // Parse the payload
  let payload: NotionWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Process the webhook
  if (payload.workspace_id) {
    const processEffect = Effect.gen(function* () {
      yield* handleNotionWebhook(payload.workspace_id!, {
        type: payload.type,
        pageId: payload.page_id,
        databaseId: payload.database_id,
        action: payload.action,
        timestamp: payload.timestamp,
      });

      return { success: true };
    });

    // Run asynchronously and return immediately
    Effect.runPromise(Effect.provide(processEffect, createPublicLayer())).catch((err) => {
      logger.error('[Notion Content Webhook Process Error]', err);
    });

    logger.info('[Notion Content Event]', { type: payload.type, workspaceId: payload.workspace_id });
  }

  return NextResponse.json({ ok: true });
}
