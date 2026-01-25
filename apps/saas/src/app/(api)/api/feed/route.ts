/**
 * Knowledge Feed API
 *
 * GET /api/feed - Aggregated feed of content items, decisions, and topics
 *
 * Returns a unified feed of:
 * - Recent content items (from all sources)
 * - Active decisions (proposed, decided status)
 * - Trending topics (by content count)
 */

import { Auth, createFullLayer, handleEffectExit } from '@nuclom/lib/api-handler';
import { ContentRepository } from '@nuclom/lib/effect/services/content';
import { TopicCluster } from '@nuclom/lib/effect/services/knowledge';
import { KnowledgeGraphRepository } from '@nuclom/lib/effect/services/knowledge-graph-repository';
import { OrganizationRepository } from '@nuclom/lib/effect/services/organization-repository';
import { validateQueryParams } from '@nuclom/lib/validation';
import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// Schemas
// =============================================================================

const GetFeedQuerySchema = Schema.Struct({
  organizationId: Schema.String,
  sourceType: Schema.optional(Schema.String), // 'slack' | 'notion' | 'github' | 'all'
  contentType: Schema.optional(Schema.String), // 'message' | 'document' | 'issue' | etc
  limit: Schema.optional(Schema.NumberFromString),
});

// =============================================================================
// Types
// =============================================================================

interface FeedItem {
  id: string;
  type: 'content' | 'decision' | 'topic';
  title: string;
  summary?: string;
  sourceType?: string;
  contentType?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// GET - Get Feed
// =============================================================================

export async function GET(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Validate query params
    const params = yield* validateQueryParams(GetFeedQuerySchema, request.url);

    // Verify user has access to the organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, params.organizationId);

    const limit = params.limit ?? 20;

    // Fetch content items, decisions, and topics in parallel
    const contentRepo = yield* ContentRepository;
    const knowledgeRepo = yield* KnowledgeGraphRepository;
    const topicService = yield* TopicCluster;

    // Build content filter
    const contentType = params.contentType as
      | 'video'
      | 'message'
      | 'thread'
      | 'document'
      | 'issue'
      | 'pull_request'
      | 'comment'
      | 'file'
      | undefined;

    // Fetch all data
    const [contentItemsResult, decisionsResult, topicsResult] = yield* Effect.all(
      [
        contentRepo.getItems(
          {
            organizationId: params.organizationId,
            type: contentType,
          },
          { limit: limit * 2 },
        ),
        knowledgeRepo.listDecisions({
          organizationId: params.organizationId,
          limit: 10,
        }),
        topicService.listClusters(params.organizationId, { limit: 10 }),
      ],
      { concurrency: 3 },
    );

    // Transform content items to feed items
    const contentFeedItems: FeedItem[] = contentItemsResult.items.map((item) => ({
      id: item.id,
      type: 'content' as const,
      title: item.title || 'Untitled',
      summary: item.content?.slice(0, 200) || undefined,
      contentType: item.type,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      metadata: {
        sourceId: item.sourceId,
        authorName: item.authorName,
        authorExternal: item.authorExternal,
        externalUrl: (item.metadata as Record<string, unknown> | null)?.html_url,
      },
    }));

    // Transform decisions to feed items
    const decisionFeedItems: FeedItem[] = decisionsResult.map((decision) => ({
      id: decision.id,
      type: 'decision' as const,
      title: decision.summary,
      summary: decision.context || undefined,
      createdAt: decision.createdAt,
      updatedAt: decision.createdAt,
      metadata: {
        status: decision.status,
        decisionType: decision.decisionType,
        confidence: decision.confidence,
        tags: decision.tags,
      },
    }));

    // Transform topics to feed items
    const topicFeedItems: FeedItem[] = topicsResult.map((topic) => ({
      id: topic.id,
      type: 'topic' as const,
      title: topic.name,
      summary: topic.description || undefined,
      createdAt: topic.createdAt,
      updatedAt: topic.updatedAt,
      metadata: {
        keywords: topic.keywords,
        contentCount: topic.contentCount,
      },
    }));

    // Combine and sort by createdAt (most recent first)
    const allItems = [...contentFeedItems, ...decisionFeedItems, ...topicFeedItems];
    allItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply limit
    const feedItems = allItems.slice(0, limit);

    return {
      items: feedItems,
      total: allItems.length,
      contentCount: contentFeedItems.length,
      decisionCount: decisionFeedItems.length,
      topicCount: topicFeedItems.length,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
