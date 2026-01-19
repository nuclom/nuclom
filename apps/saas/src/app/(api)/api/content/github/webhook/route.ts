/**
 * GitHub Content Webhook Handler
 *
 * POST /api/content/github/webhook - Handle real-time GitHub events for content sync
 */

import { Effect } from 'effect';
import { NextResponse } from 'next/server';
import { createPublicLayer } from '@nuclom/lib/api-handler';
import {
  ContentRepository,
  GitHubContentAdapter,
  handleGitHubWebhook,
  verifyGitHubSignature,
} from '@nuclom/lib/effect/services/content';
import { logger } from '@nuclom/lib/logger';

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
    merged_at?: string;
    head?: {
      ref: string;
      sha: string;
    };
    base?: {
      ref: string;
    };
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
    labels?: Array<{ name: string }>;
  };
  discussion?: {
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
    category?: {
      name: string;
    };
  };
  comment?: {
    id: number;
    body: string;
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

  const verifyEffect = Effect.gen(function* () {
    return yield* verifyGitHubSignature(signature, rawBody);
  });

  try {
    const isValid = await Effect.runPromise(Effect.provide(verifyEffect, createPublicLayer()));

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  } catch (err) {
    logger.error('[GitHub Content Webhook Signature Error]', err);
    return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 });
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
    'discussion',
    'discussion_comment',
  ];

  if (!event || !supportedEvents.includes(event)) {
    logger.debug('[GitHub Webhook] Unsupported event', { event });
    return NextResponse.json({ ok: true, message: 'Event not processed' });
  }

  // Get repository info
  const repo = payload.repository;
  if (!repo) {
    return NextResponse.json({ error: 'Missing repository info' }, { status: 400 });
  }

  const processEffect = Effect.gen(function* () {
    yield* handleGitHubWebhook(repo.owner.login, repo.full_name.split('/')[1], {
      event: event!,
      action: payload.action,
      deliveryId,
      pullRequest: payload.pull_request,
      issue: payload.issue,
      discussion: payload.discussion,
      comment: payload.comment,
      sender: payload.sender,
      installation: payload.installation,
    });

    return { success: true };
  });

  // Run asynchronously and return immediately
  Effect.runPromise(Effect.provide(processEffect, createPublicLayer())).catch((err) => {
    logger.error('[GitHub Content Webhook Process Error]', err);
  });

  logger.info('[GitHub Content Event]', {
    event,
    action: payload.action,
    repo: repo.full_name,
    deliveryId,
  });

  return NextResponse.json({ ok: true });
}
