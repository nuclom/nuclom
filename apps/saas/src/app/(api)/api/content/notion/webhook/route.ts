/**
 * Notion Content Webhook Handler
 *
 * POST /api/content/notion/webhook - Handle Notion change notifications
 *
 * Note: Notion doesn't have traditional webhooks with signatures.
 * This endpoint handles manual sync triggers or potential future webhook support.
 * For now, it just acknowledges requests and logs them.
 */

import { createPublicLayer } from '@nuclom/lib/api-handler';
import { ContentRepository } from '@nuclom/lib/effect/services/content';
import { logger } from '@nuclom/lib/logger';
import { Effect } from 'effect';
import { NextResponse } from 'next/server';

interface NotionWebhookPayload {
  type: string;
  workspace_id?: string;
  page_id?: string;
  database_id?: string;
  action?: 'created' | 'updated' | 'deleted';
  timestamp?: string;
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  // Parse the payload
  let payload: NotionWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Process the webhook if workspace_id is provided
  if (payload.workspace_id) {
    const workspaceId = payload.workspace_id;

    const processEffect = Effect.gen(function* () {
      const contentRepo = yield* ContentRepository;

      // Find content sources for this workspace
      const allNotionSources = yield* contentRepo.getSources({
        organizationId: '', // Search all orgs
        type: 'notion',
      });

      const relevantSources = allNotionSources.items.filter((source) => {
        const config = source.config as { settings?: { workspaceId?: string } } | null;
        const credentials = source.credentials as { workspaceId?: string } | null;
        return config?.settings?.workspaceId === workspaceId || credentials?.workspaceId === workspaceId;
      });

      if (relevantSources.length === 0) {
        logger.debug('[Notion Webhook] No relevant sources found', { workspaceId });
        return { success: true, processed: false };
      }

      // Log the event - actual sync can be triggered separately
      logger.info('[Notion Webhook] Found relevant sources', {
        count: relevantSources.length,
        workspaceId,
        type: payload.type,
      });

      return { success: true, processed: true };
    });

    // Run asynchronously and return immediately
    Effect.runPromise(Effect.provide(processEffect, createPublicLayer())).catch((err) => {
      logger.error('[Notion Content Webhook Process Error]', err instanceof Error ? err : new Error(String(err)));
    });

    logger.info('[Notion Content Event]', { type: payload.type, workspaceId });
  }

  return NextResponse.json({ ok: true });
}
