/**
 * Relationship Detector Service
 *
 * Detects and creates relationships between content items across different sources.
 * Uses multiple strategies:
 * 1. Explicit references (URLs, mentions, IDs)
 * 2. Semantic similarity (embedding vectors)
 * 3. Temporal proximity
 * 4. Entity co-occurrence
 */

import { and, eq, sql } from 'drizzle-orm';
import { Context, Effect, Layer, Option } from 'effect';
import { db } from '../../../db';
import {
  type ContentItem,
  type ContentRelationship,
  type ContentRelationshipType,
  contentItems,
} from '../../../db/schema';
import { type ContentProcessingError, DatabaseError } from '../../errors';
import { AI } from '../ai';
import { ContentRepository, type ContentRepositoryService } from '../content/content-repository';
import { Embedding } from '../embedding';

// =============================================================================
// Types
// =============================================================================

export interface RelationshipCandidate {
  readonly sourceItemId: string;
  readonly targetItemId: string;
  readonly relationshipType: ContentRelationshipType;
  readonly confidence: number;
  readonly reason: string;
  readonly metadata?: Record<string, unknown>;
}

export interface DetectionOptions {
  readonly organizationId: string;
  readonly sourceId?: string;
  readonly itemIds?: string[];
  readonly minConfidence?: number;
  readonly maxResults?: number;
  readonly strategies?: Array<'explicit' | 'semantic' | 'temporal' | 'entity'>;
}

export interface DetectionResult {
  readonly candidates: RelationshipCandidate[];
  readonly created: number;
  readonly skipped: number;
  readonly errors: Array<{ message: string; sourceItemId?: string; targetItemId?: string }>;
}

// =============================================================================
// Service Interface
// =============================================================================

export interface RelationshipDetectorService {
  /**
   * Detect relationships for a specific content item
   */
  detectForItem(
    itemId: string,
    options?: { minConfidence?: number; strategies?: Array<'explicit' | 'semantic' | 'temporal' | 'entity'> },
  ): Effect.Effect<RelationshipCandidate[], ContentProcessingError | DatabaseError>;

  /**
   * Detect relationships across an organization or source
   */
  detectRelationships(
    options: DetectionOptions,
  ): Effect.Effect<DetectionResult, ContentProcessingError | DatabaseError>;

  /**
   * Create detected relationships in the database
   */
  createRelationships(candidates: RelationshipCandidate[]): Effect.Effect<ContentRelationship[], DatabaseError>;

  /**
   * Find similar content items using semantic search
   */
  findSimilarItems(
    itemId: string,
    options?: { limit?: number; minSimilarity?: number },
  ): Effect.Effect<Array<{ item: ContentItem; similarity: number }>, DatabaseError>;
}

// =============================================================================
// Service Tag
// =============================================================================

export class RelationshipDetector extends Context.Tag('RelationshipDetector')<
  RelationshipDetector,
  RelationshipDetectorService
>() {}

// =============================================================================
// Reference Patterns
// =============================================================================

// URL patterns for different content types
const URL_PATTERNS = {
  github_pr: /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/gi,
  github_issue: /github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/gi,
  github_discussion: /github\.com\/([^/]+)\/([^/]+)\/discussions\/(\d+)/gi,
  notion_page: /notion\.so\/(?:[^/]+\/)?([a-f0-9]{32})/gi,
  slack_message: /slack\.com\/archives\/([A-Z0-9]+)\/p(\d+)/gi,
  jira_issue: /([A-Z]+-\d+)/gi,
  linear_issue: /([A-Z]+-\d+)/gi,
};

// Mention patterns
const MENTION_PATTERNS = {
  github_mention: /@([a-zA-Z0-9_-]+)/gi,
  slack_user: /<@([A-Z0-9]+)>/gi,
  slack_channel: /<#([A-Z0-9]+)\|([^>]+)>/gi,
};

// =============================================================================
// Service Implementation
// =============================================================================

const makeRelationshipDetector = (
  contentRepository: ContentRepositoryService,
  embedding: Context.Tag.Service<Embedding>,
  ai: Context.Tag.Service<AI>,
): RelationshipDetectorService => ({
  detectForItem: (itemId, options = {}) =>
    Effect.gen(function* () {
      const { minConfidence = 0.5, strategies = ['explicit', 'semantic', 'temporal'] } = options;
      const candidates: RelationshipCandidate[] = [];

      // Get the item
      const itemOption = yield* contentRepository.getItemOption(itemId);
      if (Option.isNone(itemOption)) {
        return [];
      }
      const item = itemOption.value;

      // Get potential related items from same org
      const relatedItems = yield* contentRepository.getItems({ organizationId: item.organizationId }, { limit: 100 });

      const otherItems = relatedItems.items.filter((i) => i.id !== itemId);

      // Strategy 1: Explicit references
      if (strategies.includes('explicit')) {
        const explicitCandidates = detectExplicitReferences(item, otherItems);
        candidates.push(...explicitCandidates);
      }

      // Strategy 2: Semantic similarity
      if (strategies.includes('semantic') && item.embeddingVector) {
        const semanticCandidates = yield* detectSemanticSimilarity(contentRepository, item, otherItems, minConfidence);
        candidates.push(...semanticCandidates);
      }

      // Strategy 3: Temporal proximity
      if (strategies.includes('temporal')) {
        const temporalCandidates = detectTemporalProximity(item, otherItems);
        candidates.push(...temporalCandidates);
      }

      // Strategy 4: Entity co-occurrence
      if (strategies.includes('entity')) {
        const entityCandidates = detectEntityCoOccurrence(item, otherItems);
        candidates.push(...entityCandidates);
      }

      // Deduplicate and filter by confidence
      const uniqueCandidates = deduplicateCandidates(candidates);
      return uniqueCandidates.filter((c) => c.confidence >= minConfidence);
    }),

  detectRelationships: (options) =>
    Effect.gen(function* () {
      const {
        organizationId,
        sourceId,
        itemIds,
        minConfidence = 0.5,
        maxResults = 1000,
        strategies = ['explicit', 'semantic', 'temporal'],
      } = options;

      const candidates: RelationshipCandidate[] = [];
      const errors: Array<{ message: string; sourceItemId?: string; targetItemId?: string }> = [];

      // Get items to process
      let items: ContentItem[];
      if (itemIds && itemIds.length > 0) {
        const results = yield* Effect.forEach(itemIds, (id) => contentRepository.getItemOption(id), {
          concurrency: 10,
        });
        items = results.filter(Option.isSome).map((o) => o.value);
      } else {
        const result = yield* contentRepository.getItems({ organizationId, sourceId }, { limit: 500 });
        items = result.items;
      }

      // Process each item
      for (const item of items) {
        try {
          const otherItems = items.filter((i) => i.id !== item.id);

          // Strategy 1: Explicit references
          if (strategies.includes('explicit')) {
            const explicitCandidates = detectExplicitReferences(item, otherItems);
            candidates.push(...explicitCandidates);
          }

          // Strategy 2: Semantic similarity (only if item has embedding)
          if (strategies.includes('semantic') && item.embeddingVector) {
            const semanticCandidates = yield* detectSemanticSimilarity(
              contentRepository,
              item,
              otherItems,
              minConfidence,
            );
            candidates.push(...semanticCandidates);
          }

          // Strategy 3: Temporal proximity
          if (strategies.includes('temporal')) {
            const temporalCandidates = detectTemporalProximity(item, otherItems);
            candidates.push(...temporalCandidates);
          }

          // Strategy 4: Entity co-occurrence
          if (strategies.includes('entity')) {
            const entityCandidates = detectEntityCoOccurrence(item, otherItems);
            candidates.push(...entityCandidates);
          }
        } catch (err) {
          errors.push({
            message: err instanceof Error ? err.message : 'Unknown error',
            sourceItemId: item.id,
          });
        }
      }

      // Deduplicate and filter
      const uniqueCandidates = deduplicateCandidates(candidates)
        .filter((c) => c.confidence >= minConfidence)
        .slice(0, maxResults);

      // Create relationships
      let created = 0;
      let skipped = 0;

      for (const candidate of uniqueCandidates) {
        try {
          // Check if relationship already exists by getting all relationships for source item
          const existingRelationships = yield* contentRepository.getRelationships(candidate.sourceItemId, 'outgoing');

          const existing = existingRelationships.find(
            (r) => r.targetItemId === candidate.targetItemId && r.relationshipType === candidate.relationshipType,
          );

          if (existing) {
            skipped++;
            continue;
          }

          yield* contentRepository.createRelationship({
            sourceItemId: candidate.sourceItemId,
            targetItemId: candidate.targetItemId,
            relationshipType: candidate.relationshipType,
            confidence: candidate.confidence,
            metadata: candidate.metadata,
          });
          created++;
        } catch (err) {
          errors.push({
            message: err instanceof Error ? err.message : 'Failed to create relationship',
            sourceItemId: candidate.sourceItemId,
            targetItemId: candidate.targetItemId,
          });
        }
      }

      return {
        candidates: uniqueCandidates,
        created,
        skipped,
        errors,
      };
    }),

  createRelationships: (candidates) =>
    Effect.gen(function* () {
      const relationships: ContentRelationship[] = [];

      for (const candidate of candidates) {
        const relationship = yield* contentRepository.createRelationship({
          sourceItemId: candidate.sourceItemId,
          targetItemId: candidate.targetItemId,
          relationshipType: candidate.relationshipType,
          confidence: candidate.confidence,
          metadata: candidate.metadata,
        });
        relationships.push(relationship);
      }

      return relationships;
    }),

  findSimilarItems: (itemId, options = {}) =>
    Effect.gen(function* () {
      const { limit = 10, minSimilarity = 0.7 } = options;

      // Get the item
      const itemOption = yield* contentRepository.getItemOption(itemId);
      if (Option.isNone(itemOption)) {
        return [];
      }
      const item = itemOption.value;

      if (!item.embeddingVector) {
        return [];
      }

      // Use direct vector similarity search
      const similarItems = yield* Effect.tryPromise({
        try: () =>
          db
            .select({
              item: contentItems,
              similarity: sql<number>`1 - (embedding_vector <=> ${JSON.stringify(item.embeddingVector)}::vector)`,
            })
            .from(contentItems)
            .where(
              and(
                eq(contentItems.organizationId, item.organizationId),
                sql`id != ${itemId}`,
                sql`embedding_vector IS NOT NULL`,
              ),
            )
            .orderBy(sql`embedding_vector <=> ${JSON.stringify(item.embeddingVector)}::vector`)
            .limit(limit + 1),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to find similar items: ${error}`,
            operation: 'select',
            cause: error,
          }),
      });

      // Filter by minimum similarity and exclude source item
      return similarItems.filter((r) => r.similarity >= minSimilarity && r.item.id !== itemId).slice(0, limit);
    }),
});

// =============================================================================
// Detection Strategies
// =============================================================================

/**
 * Detect explicit references (URLs, mentions, IDs) between items
 */
function detectExplicitReferences(sourceItem: ContentItem, targetItems: ContentItem[]): RelationshipCandidate[] {
  const candidates: RelationshipCandidate[] = [];
  const sourceText = `${sourceItem.title || ''} ${sourceItem.content || ''}`;

  for (const targetItem of targetItems) {
    // Check for URL references
    const targetUrls = extractUrls(targetItem);
    for (const url of targetUrls) {
      if (sourceText.includes(url)) {
        candidates.push({
          sourceItemId: sourceItem.id,
          targetItemId: targetItem.id,
          relationshipType: 'references',
          confidence: 0.95,
          reason: `Source contains URL reference to target: ${url}`,
          metadata: { url },
        });
      }
    }

    // Check for external ID references
    if (targetItem.externalId) {
      // GitHub PR/Issue references like #123
      const prIssuePattern = new RegExp(`#${targetItem.externalId}(?:\\D|$)`, 'i');
      if (prIssuePattern.test(sourceText)) {
        candidates.push({
          sourceItemId: sourceItem.id,
          targetItemId: targetItem.id,
          relationshipType: 'references',
          confidence: 0.9,
          reason: `Source references target by ID: #${targetItem.externalId}`,
        });
      }
    }

    // Check for title mentions
    if (targetItem.title && targetItem.title.length > 5) {
      const titlePattern = new RegExp(escapeRegExp(targetItem.title), 'i');
      if (titlePattern.test(sourceText)) {
        candidates.push({
          sourceItemId: sourceItem.id,
          targetItemId: targetItem.id,
          relationshipType: 'mentions',
          confidence: 0.8,
          reason: `Source mentions target title: "${targetItem.title}"`,
        });
      }
    }
  }

  return candidates;
}

/**
 * Detect semantic similarity between items using embeddings
 */
function detectSemanticSimilarity(
  contentRepository: ContentRepositoryService,
  sourceItem: ContentItem,
  targetItems: ContentItem[],
  minSimilarity: number,
): Effect.Effect<RelationshipCandidate[], DatabaseError> {
  return Effect.gen(function* () {
    const candidates: RelationshipCandidate[] = [];

    if (!sourceItem.embeddingVector) {
      return candidates;
    }

    // Calculate cosine similarity with each target
    for (const targetItem of targetItems) {
      if (!targetItem.embeddingVector || targetItem.id === sourceItem.id) {
        continue;
      }

      const similarity = cosineSimilarity(
        sourceItem.embeddingVector as number[],
        targetItem.embeddingVector as number[],
      );

      if (similarity >= minSimilarity) {
        candidates.push({
          sourceItemId: sourceItem.id,
          targetItemId: targetItem.id,
          relationshipType: 'similar_to',
          confidence: similarity,
          reason: `Semantic similarity: ${(similarity * 100).toFixed(1)}%`,
          metadata: { similarity },
        });
      }
    }

    return candidates;
  });
}

/**
 * Detect temporal proximity between items
 */
function detectTemporalProximity(sourceItem: ContentItem, targetItems: ContentItem[]): RelationshipCandidate[] {
  const candidates: RelationshipCandidate[] = [];
  const sourceTime = sourceItem.createdAtSource || sourceItem.createdAt;

  if (!sourceTime) {
    return candidates;
  }

  for (const targetItem of targetItems) {
    const targetTime = targetItem.createdAtSource || targetItem.createdAt;
    if (!targetTime) {
      continue;
    }

    // Check if items are from different sources (cross-source temporal proximity)
    if (sourceItem.sourceId === targetItem.sourceId) {
      continue;
    }

    const timeDiff = Math.abs(sourceTime.getTime() - targetTime.getTime());
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    // Within 1 hour = high confidence, within 24 hours = medium confidence
    let confidence = 0;
    if (hoursDiff <= 1) {
      confidence = 0.8;
    } else if (hoursDiff <= 4) {
      confidence = 0.7;
    } else if (hoursDiff <= 24) {
      confidence = 0.5;
    }

    if (confidence > 0) {
      candidates.push({
        sourceItemId: sourceItem.id,
        targetItemId: targetItem.id,
        relationshipType: 'relates_to',
        confidence,
        reason: `Temporal proximity: ${hoursDiff.toFixed(1)} hours apart`,
        metadata: { hoursDiff, sourceType: sourceItem.type, targetType: targetItem.type },
      });
    }
  }

  return candidates;
}

/**
 * Detect entity co-occurrence (shared participants, tags, etc.)
 */
function detectEntityCoOccurrence(sourceItem: ContentItem, targetItems: ContentItem[]): RelationshipCandidate[] {
  const candidates: RelationshipCandidate[] = [];
  const sourceTags = new Set(sourceItem.tags || []);
  const sourceAuthor = sourceItem.authorExternal || sourceItem.authorId;

  for (const targetItem of targetItems) {
    // Skip items from same source (we want cross-source relationships)
    if (sourceItem.sourceId === targetItem.sourceId) {
      continue;
    }

    // Check for shared tags
    const targetTags = new Set(targetItem.tags || []);
    const sharedTags = [...sourceTags].filter((tag) => targetTags.has(tag));

    if (sharedTags.length >= 2) {
      const confidence = Math.min(0.9, 0.5 + sharedTags.length * 0.1);
      candidates.push({
        sourceItemId: sourceItem.id,
        targetItemId: targetItem.id,
        relationshipType: 'relates_to',
        confidence,
        reason: `Shared tags: ${sharedTags.join(', ')}`,
        metadata: { sharedTags },
      });
    }

    // Check for same author across sources
    const targetAuthor = targetItem.authorExternal || targetItem.authorId;
    if (sourceAuthor && targetAuthor && sourceAuthor === targetAuthor) {
      candidates.push({
        sourceItemId: sourceItem.id,
        targetItemId: targetItem.id,
        relationshipType: 'relates_to',
        confidence: 0.7,
        reason: `Same author: ${sourceItem.authorName || sourceAuthor}`,
        metadata: { authorId: sourceAuthor },
      });
    }
  }

  return candidates;
}

// =============================================================================
// Helper Functions
// =============================================================================

function extractUrls(item: ContentItem): string[] {
  const urls: string[] = [];
  const metadata = item.metadata as Record<string, unknown> | undefined;

  // Extract URL from metadata
  if (metadata?.url && typeof metadata.url === 'string') {
    urls.push(metadata.url);
  }

  // Extract URLs from content
  const content = `${item.title || ''} ${item.content || ''}`;
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
  const matches = content.match(urlPattern);
  if (matches) {
    urls.push(...matches);
  }

  return [...new Set(urls)];
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) {
    return 0;
  }

  return dotProduct / magnitude;
}

function deduplicateCandidates(candidates: RelationshipCandidate[]): RelationshipCandidate[] {
  const seen = new Map<string, RelationshipCandidate>();

  for (const candidate of candidates) {
    const key = `${candidate.sourceItemId}:${candidate.targetItemId}:${candidate.relationshipType}`;
    const existing = seen.get(key);

    // Keep the candidate with higher confidence
    if (!existing || candidate.confidence > existing.confidence) {
      seen.set(key, candidate);
    }
  }

  return Array.from(seen.values());
}

// =============================================================================
// Layer
// =============================================================================

export const RelationshipDetectorLive = Layer.effect(
  RelationshipDetector,
  Effect.gen(function* () {
    const contentRepository = yield* ContentRepository;
    const embeddingService = yield* Embedding;
    const aiService = yield* AI;

    return makeRelationshipDetector(contentRepository, embeddingService, aiService);
  }),
);

// =============================================================================
// Convenience Functions
// =============================================================================

export const detectRelationshipsForItem = (
  itemId: string,
  options?: { minConfidence?: number; strategies?: Array<'explicit' | 'semantic' | 'temporal' | 'entity'> },
) =>
  Effect.gen(function* () {
    const detector = yield* RelationshipDetector;
    return yield* detector.detectForItem(itemId, options);
  });

export const detectRelationships = (options: DetectionOptions) =>
  Effect.gen(function* () {
    const detector = yield* RelationshipDetector;
    return yield* detector.detectRelationships(options);
  });

export const findSimilarContentItems = (itemId: string, options?: { limit?: number; minSimilarity?: number }) =>
  Effect.gen(function* () {
    const detector = yield* RelationshipDetector;
    return yield* detector.findSimilarItems(itemId, options);
  });
