/**
 * GitHub Content Webhook Handler
 *
 * POST /api/content/github/webhook - Handle real-time GitHub events for content sync
 */

import { createPublicLayer } from '@nuclom/lib/api-handler';
import {
  ContentRepository,
  GitHubContentAdapter,
  verifyGitHubWebhookSignature,
} from '@nuclom/lib/effect/services/content';
import { GitHubContentAdapterLive } from '@nuclom/lib/effect/services/content/github-content-adapter';
import { DatabaseLive } from '@nuclom/lib/effect/services/database';
import { env } from '@nuclom/lib/env/server';
import { logger } from '@nuclom/lib/logger';
import { Effect, Layer } from 'effect';
import { NextResponse } from 'next/server';
import { processContentWorkflow } from '@/workflows/content-processing';

interface GitHubWebhookPayload {
  action?: string;
  repository?: {
    id: number;
    full_name: string;
    owner: {
      id: number;
      login: string;
    };
  };
  sender?: {
    id: number;
    login: string;
  };
  pull_request?: {
    id: number;
    number: number;
    title: string;
    body?: string;
    state: string;
    user: {
      id: number;
      login: string;
    };
    created_at: string;
    updated_at: string;
  };
  issue?: {
    id: number;
    number: number;
    title: string;
    body?: string;
    state: string;
    user: {
      id: number;
      login: string;
    };
    created_at: string;
    updated_at: string;
  };
  installation?: {
    id: number;
    account: {
      id: number;
      login: string;
    };
  };
}

export async function POST(request: Request) {
  const signature = request.headers.get('x-hub-signature-256');
  const event = request.headers.get('x-github-event');
  const deliveryId = request.headers.get('x-github-delivery');
  const rawBody = await request.text();

  // Verify signature
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }

  // Get webhook secret
  const webhookSecret = env.GITHUB_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.warn('[GitHub Webhook] No webhook secret configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  // Verify signature using the pure function
  const isValid = verifyGitHubWebhookSignature(signature, webhookSecret, rawBody);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Parse the payload
  let payload: GitHubWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Handle ping event
  if (event === 'ping') {
    logger.info('[GitHub Webhook] Ping received', { deliveryId });
    return NextResponse.json({ ok: true, message: 'Pong!' });
  }

  // Process supported events
  const supportedEvents = [
    'pull_request',
    'pull_request_review',
    'pull_request_review_comment',
    'issues',
    'issue_comment',
  ];

  if (!event || !supportedEvents.includes(event)) {
    return NextResponse.json({ ok: true, message: 'Event not processed' });
  }

  // Capture event type for use in Effect.gen (we've already checked it's not null above)
  const eventType = event;

  // Get repository info
  const repo = payload.repository;
  if (!repo) {
    return NextResponse.json({ error: 'Missing repository info' }, { status: 400 });
  }

  // Process event asynchronously - find matching sources and trigger sync
  const processEffect = Effect.gen(function* () {
    const contentRepo = yield* ContentRepository;

    // Find content sources that might have access to this repository
    // We search all GitHub sources and filter by username match
    const allGitHubSources = yield* contentRepo.getSources({
      organizationId: '', // Will need to iterate through all orgs
      type: 'github',
    });

    const relevantSources = allGitHubSources.items.filter((source) => {
      const config = source.config as { settings?: { username?: string }; repositories?: string[] } | null;
      // Match by username or if the repository is in the configured list
      return config?.settings?.username === repo.owner.login || config?.repositories?.includes(repo.full_name);
    });

    if (relevantSources.length === 0) {
      logger.debug('[GitHub Webhook] No relevant sources found', { repo: repo.full_name });
      return { success: true, processed: false };
    }

    logger.info('[GitHub Webhook] Found relevant sources', {
      count: relevantSources.length,
      repo: repo.full_name,
      event: eventType,
    });

    // Process the event for each relevant source
    const adapter = yield* GitHubContentAdapter;

    for (const source of relevantSources) {
      const rawItem = yield* adapter
        .handleWebhook(source, eventType, payload)
        .pipe(Effect.catchAll(() => Effect.succeed(null)));

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

        logger.info('[GitHub Webhook] Saved content item', {
          contentItemId: saved.id,
          sourceId: source.id,
          type: rawItem.type,
          externalId: rawItem.externalId,
        });

        // Trigger async processing (fire-and-forget)
        processContentWorkflow({
          contentItemId: saved.id,
          organizationId: source.organizationId,
          sourceType: 'github',
        }).catch((err) => {
          logger.error('[GitHub Webhook] Workflow failed', err instanceof Error ? err : new Error(String(err)));
        });
      }
    }

    return { success: true, processed: true, sourceCount: relevantSources.length };
  });

  // Run asynchronously and return immediately
  // Create layer with GitHubContentAdapter
  const GitHubAdapterWithDeps = GitHubContentAdapterLive.pipe(Layer.provide(DatabaseLive));
  const fullLayer = Layer.merge(createPublicLayer(), GitHubAdapterWithDeps);

  Effect.runPromise(Effect.provide(processEffect, fullLayer)).catch((err) => {
    logger.error('[GitHub Content Webhook Process Error]', err instanceof Error ? err : new Error(String(err)));
  });

  logger.info('[GitHub Content Event]', {
    event,
    action: payload.action,
    repo: repo.full_name,
    deliveryId,
  });

  return NextResponse.json({ ok: true });
}
