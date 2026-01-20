/**
 * GitHub Content Webhook Handler
 *
 * POST /api/content/github/webhook - Handle real-time GitHub events for content sync
 */

import { createPublicLayer } from '@nuclom/lib/api-handler';
import { ContentRepository, verifyGitHubWebhookSignature } from '@nuclom/lib/effect/services/content';
import { env } from '@nuclom/lib/env/server';
import { logger } from '@nuclom/lib/logger';
import { Effect } from 'effect';
import { NextResponse } from 'next/server';

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
      const config = source.config as { settings?: { username?: string } } | null;
      return config?.settings?.username === repo.owner.login;
    });

    if (relevantSources.length === 0) {
      logger.debug('[GitHub Webhook] No relevant sources found', { repo: repo.full_name });
      return { success: true, processed: false };
    }

    // Log that we found relevant sources - actual sync can be triggered separately
    logger.info('[GitHub Webhook] Found relevant sources', {
      count: relevantSources.length,
      repo: repo.full_name,
      event,
    });

    return { success: true, processed: true, sourceCount: relevantSources.length };
  });

  // Run asynchronously and return immediately
  Effect.runPromise(Effect.provide(processEffect, createPublicLayer())).catch((err) => {
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
