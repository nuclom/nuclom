/**
 * Decision Tracker Service
 *
 * Tracks and manages decisions extracted from content across all sources.
 * Supports decision lifecycle: proposed -> decided -> implemented -> superseded
 * Links decisions to supporting evidence from multiple content sources.
 */

import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { Context, Effect, Layer, Option } from 'effect';
import { db } from '../../../db';
import {
  contentItems,
  type Decision,
  type DecisionLink,
  type DecisionParticipant,
  decisionEvidence,
  decisionLinks,
  decisionParticipants,
  decisions,
  type NewDecision,
} from '../../../db/schema';
import { ContentProcessingError, DatabaseError, NotFoundError } from '../../errors';
import { AI } from '../ai';
import { ContentRepository, type ContentRepositoryService } from '../content/content-repository';
import { Embedding } from '../embedding';

// =============================================================================
// Types
// =============================================================================

export type DecisionStatus = 'proposed' | 'decided' | 'implemented' | 'revisited' | 'superseded';
export type DecisionType = 'technical' | 'product' | 'process' | 'resource' | 'team' | 'other';

export interface CreateDecisionInput {
  readonly organizationId: string;
  readonly videoId?: string;
  readonly contentItemId?: string;
  readonly summary: string;
  readonly context?: string;
  readonly reasoning?: string;
  readonly status?: DecisionStatus;
  readonly decisionType?: DecisionType;
  readonly confidence?: number;
  readonly tags?: string[];
  readonly timestampStart?: number;
  readonly timestampEnd?: number;
  readonly participants?: Array<{
    userId?: string;
    speakerName?: string;
    role?: 'proposer' | 'approver' | 'participant' | 'objector';
    attributedText?: string;
  }>;
  readonly evidence?: Array<{
    contentItemId: string;
    confidence: number;
    evidenceType?: 'origin' | 'discussion' | 'documentation' | 'implementation' | 'revision' | 'superseded';
    stage?: 'proposed' | 'discussed' | 'decided' | 'documented' | 'implemented' | 'revised';
    excerpt?: string;
  }>;
}

export interface UpdateDecisionInput {
  readonly summary?: string;
  readonly context?: string;
  readonly reasoning?: string;
  readonly status?: DecisionStatus;
  readonly decisionType?: DecisionType;
  readonly confidence?: number;
  readonly tags?: string[];
}

export interface DecisionFilters {
  readonly organizationId: string;
  readonly videoId?: string;
  readonly status?: DecisionStatus;
  readonly decisionType?: DecisionType;
  readonly tags?: string[];
  readonly createdAfter?: Date;
  readonly createdBefore?: Date;
  readonly searchQuery?: string;
}

export interface DecisionWithRelations extends Decision {
  readonly participants: DecisionParticipant[];
  readonly links: DecisionLink[];
  readonly evidence?: Array<{
    contentItemId: string;
    confidence: number;
    evidenceType: string;
    stage: string;
    excerpt?: string | null;
    contentItem?: {
      id: string;
      title?: string | null;
      type: string;
      sourceId: string;
    };
  }>;
}

export interface DecisionTimelineEntry {
  readonly decision: Decision;
  readonly relatedContent: Array<{
    id: string;
    type: string;
    title?: string | null;
    sourceType: string;
    createdAt: Date;
  }>;
}

export interface ExtractedDecision {
  readonly summary: string;
  readonly context?: string;
  readonly reasoning?: string;
  readonly decisionType: DecisionType;
  readonly confidence: number;
  readonly participants: string[];
  readonly tags: string[];
}

// =============================================================================
// Service Interface
// =============================================================================

export interface DecisionTrackerService {
  /**
   * Create a new decision
   */
  createDecision(input: CreateDecisionInput): Effect.Effect<Decision, DatabaseError>;

  /**
   * Get a decision by ID with all relations
   */
  getDecision(id: string): Effect.Effect<DecisionWithRelations, NotFoundError | DatabaseError>;

  /**
   * Update a decision
   */
  updateDecision(id: string, input: UpdateDecisionInput): Effect.Effect<Decision, NotFoundError | DatabaseError>;

  /**
   * Delete a decision
   */
  deleteDecision(id: string): Effect.Effect<void, NotFoundError | DatabaseError>;

  /**
   * List decisions with filters
   */
  listDecisions(
    filters: DecisionFilters,
    pagination?: { limit?: number; offset?: number },
  ): Effect.Effect<{ decisions: Decision[]; total: number }, DatabaseError>;

  /**
   * Add evidence to a decision from a content item
   */
  addEvidence(
    decisionId: string,
    contentItemId: string,
    options: {
      confidence: number;
      evidenceType?: 'origin' | 'discussion' | 'documentation' | 'implementation' | 'revision' | 'superseded';
      stage?: 'proposed' | 'discussed' | 'decided' | 'documented' | 'implemented' | 'revised';
      excerpt?: string;
    },
  ): Effect.Effect<void, NotFoundError | DatabaseError>;

  /**
   * Link a decision to an external entity
   */
  linkDecision(
    decisionId: string,
    entityType: string,
    entityId: string,
    linkType: string,
    options?: { entityRef?: string; url?: string },
  ): Effect.Effect<DecisionLink, NotFoundError | DatabaseError>;

  /**
   * Update decision status (lifecycle transition)
   */
  updateStatus(
    id: string,
    status: DecisionStatus,
    reason?: string,
  ): Effect.Effect<Decision, NotFoundError | DatabaseError>;

  /**
   * Mark a decision as superseded by another
   */
  supersede(
    oldDecisionId: string,
    newDecisionId: string,
    reason?: string,
  ): Effect.Effect<void, NotFoundError | DatabaseError>;

  /**
   * Extract decisions from content using AI
   */
  extractDecisionsFromContent(
    contentItemId: string,
  ): Effect.Effect<ExtractedDecision[], ContentProcessingError | DatabaseError>;

  /**
   * Find related decisions using semantic search
   */
  findRelatedDecisions(
    decisionId: string,
    options?: { limit?: number; minSimilarity?: number },
  ): Effect.Effect<Array<{ decision: Decision; similarity: number }>, DatabaseError>;

  /**
   * Get decision timeline for an organization
   */
  getDecisionTimeline(
    organizationId: string,
    options?: { limit?: number; startDate?: Date; endDate?: Date },
  ): Effect.Effect<DecisionTimelineEntry[], DatabaseError>;
}

// =============================================================================
// Service Tag
// =============================================================================

export class DecisionTracker extends Context.Tag('DecisionTracker')<DecisionTracker, DecisionTrackerService>() {}

// =============================================================================
// Service Implementation
// =============================================================================

const makeDecisionTracker = (
  contentRepository: ContentRepositoryService,
  embedding: Context.Tag.Service<Embedding>,
  ai: Context.Tag.Service<AI>,
): DecisionTrackerService => ({
  createDecision: (input) =>
    Effect.gen(function* () {
      const decisionData: NewDecision = {
        organizationId: input.organizationId,
        videoId: input.videoId || '', // Required field, use empty string if not provided
        summary: input.summary,
        context: input.context,
        reasoning: input.reasoning,
        status: input.status || 'decided',
        decisionType: input.decisionType || 'other',
        confidence: input.confidence,
        tags: input.tags || [],
        timestampStart: input.timestampStart,
        timestampEnd: input.timestampEnd,
      };

      // Generate embedding for semantic search
      const embeddingText = `${input.summary} ${input.context || ''} ${input.reasoning || ''}`;
      const embeddingResult = yield* embedding.generateEmbedding(embeddingText).pipe(Effect.option);

      if (Option.isSome(embeddingResult)) {
        (decisionData as { embeddingVector?: number[] }).embeddingVector = [...embeddingResult.value];
      }

      const result = yield* Effect.tryPromise({
        try: () =>
          db
            .insert(decisions)
            .values(decisionData)
            .returning()
            .then((rows) => rows[0]),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to create decision: ${error}`,
            operation: 'insert',
            cause: error,
          }),
      });

      // Add participants if provided
      if (input.participants && input.participants.length > 0) {
        yield* Effect.tryPromise({
          try: () =>
            db.insert(decisionParticipants).values(
              input.participants!.map((p) => ({
                decisionId: result.id,
                userId: p.userId,
                speakerName: p.speakerName,
                role: p.role || 'participant',
                attributedText: p.attributedText,
              })),
            ),
          catch: (error) =>
            new DatabaseError({
              message: `Failed to add participants: ${error}`,
              operation: 'insert',
              cause: error,
            }),
        });
      }

      // Add evidence if provided
      if (input.evidence && input.evidence.length > 0) {
        yield* Effect.tryPromise({
          try: () =>
            db.insert(decisionEvidence).values(
              input.evidence!.map((e) => ({
                organizationId: input.organizationId,
                decisionId: result.id,
                contentItemId: e.contentItemId,
                confidence: e.confidence,
                evidenceType: e.evidenceType || 'discussion',
                stage: e.stage || 'decided',
                excerpt: e.excerpt,
              })),
            ),
          catch: (error) =>
            new DatabaseError({
              message: `Failed to add evidence: ${error}`,
              operation: 'insert',
              cause: error,
            }),
        });
      }

      return result;
    }),

  getDecision: (id) =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: () =>
          db.query.decisions.findFirst({
            where: eq(decisions.id, id),
            with: {
              participants: true,
              links: true,
            },
          }),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to get decision: ${error}`,
            operation: 'select',
            cause: error,
          }),
      });

      if (!result) {
        return yield* Effect.fail(
          new NotFoundError({
            message: `Decision not found: ${id}`,
            entity: 'decision',
            id,
          }),
        );
      }

      // Get evidence separately
      const evidence = yield* Effect.tryPromise({
        try: () =>
          db
            .select({
              contentItemId: decisionEvidence.contentItemId,
              confidence: decisionEvidence.confidence,
              evidenceType: decisionEvidence.evidenceType,
              stage: decisionEvidence.stage,
              excerpt: decisionEvidence.excerpt,
              contentItem: {
                id: contentItems.id,
                title: contentItems.title,
                type: contentItems.type,
                sourceId: contentItems.sourceId,
              },
            })
            .from(decisionEvidence)
            .leftJoin(contentItems, eq(decisionEvidence.contentItemId, contentItems.id))
            .where(eq(decisionEvidence.decisionId, id)),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to get evidence: ${error}`,
            operation: 'select',
            cause: error,
          }),
      });

      return {
        ...result,
        evidence: evidence.map((e) => ({
          contentItemId: e.contentItemId,
          confidence: e.confidence,
          evidenceType: e.evidenceType,
          stage: e.stage,
          excerpt: e.excerpt,
          contentItem: e.contentItem
            ? {
                id: e.contentItem.id,
                title: e.contentItem.title,
                type: e.contentItem.type,
                sourceId: e.contentItem.sourceId,
              }
            : undefined,
        })),
      } as DecisionWithRelations;
    }),

  updateDecision: (id, input) =>
    Effect.gen(function* () {
      const updateData: Partial<Decision> = {};

      if (input.summary !== undefined) updateData.summary = input.summary;
      if (input.context !== undefined) updateData.context = input.context;
      if (input.reasoning !== undefined) updateData.reasoning = input.reasoning;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.decisionType !== undefined) updateData.decisionType = input.decisionType;
      if (input.confidence !== undefined) updateData.confidence = input.confidence;
      if (input.tags !== undefined) updateData.tags = input.tags;

      updateData.updatedAt = new Date();

      // Regenerate embedding if summary/context/reasoning changed
      if (input.summary || input.context || input.reasoning) {
        const current = yield* Effect.tryPromise({
          try: () => db.query.decisions.findFirst({ where: eq(decisions.id, id) }),
          catch: (error) =>
            new DatabaseError({
              message: `Failed to get decision: ${error}`,
              operation: 'select',
              cause: error,
            }),
        });

        if (current) {
          const embeddingText = `${input.summary || current.summary} ${input.context || current.context || ''} ${input.reasoning || current.reasoning || ''}`;
          const embeddingResult = yield* embedding.generateEmbedding(embeddingText).pipe(Effect.option);

          if (Option.isSome(embeddingResult)) {
            (updateData as { embeddingVector?: number[] }).embeddingVector = [...embeddingResult.value];
          }
        }
      }

      const result = yield* Effect.tryPromise({
        try: () =>
          db
            .update(decisions)
            .set(updateData)
            .where(eq(decisions.id, id))
            .returning()
            .then((rows) => rows[0]),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to update decision: ${error}`,
            operation: 'update',
            cause: error,
          }),
      });

      if (!result) {
        return yield* Effect.fail(
          new NotFoundError({
            message: `Decision not found: ${id}`,
            entity: 'decision',
            id,
          }),
        );
      }

      return result;
    }),

  deleteDecision: (id) =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: () => db.delete(decisions).where(eq(decisions.id, id)).returning(),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to delete decision: ${error}`,
            operation: 'delete',
            cause: error,
          }),
      });

      if (result.length === 0) {
        return yield* Effect.fail(
          new NotFoundError({
            message: `Decision not found: ${id}`,
            entity: 'decision',
            id,
          }),
        );
      }
    }),

  listDecisions: (filters, pagination = {}) =>
    Effect.gen(function* () {
      const { limit = 50, offset = 0 } = pagination;

      const conditions = [eq(decisions.organizationId, filters.organizationId)];

      if (filters.videoId) {
        conditions.push(eq(decisions.videoId, filters.videoId));
      }
      if (filters.status) {
        conditions.push(eq(decisions.status, filters.status));
      }
      if (filters.decisionType) {
        conditions.push(eq(decisions.decisionType, filters.decisionType));
      }
      if (filters.createdAfter) {
        conditions.push(gte(decisions.createdAt, filters.createdAfter));
      }
      if (filters.createdBefore) {
        conditions.push(lte(decisions.createdAt, filters.createdBefore));
      }

      const whereClause = and(...conditions);

      const [rows, countResult] = yield* Effect.all([
        Effect.tryPromise({
          try: () =>
            db
              .select()
              .from(decisions)
              .where(whereClause)
              .orderBy(desc(decisions.createdAt))
              .limit(limit)
              .offset(offset),
          catch: (error) =>
            new DatabaseError({
              message: `Failed to list decisions: ${error}`,
              operation: 'select',
              cause: error,
            }),
        }),
        Effect.tryPromise({
          try: () =>
            db
              .select({ count: sql<number>`count(*)::int` })
              .from(decisions)
              .where(whereClause)
              .then((rows) => rows[0]?.count || 0),
          catch: (error) =>
            new DatabaseError({
              message: `Failed to count decisions: ${error}`,
              operation: 'select',
              cause: error,
            }),
        }),
      ]);

      return { decisions: rows, total: countResult };
    }),

  addEvidence: (decisionId, contentItemId, options) =>
    Effect.gen(function* () {
      // Get decision to get organizationId
      const decision = yield* Effect.tryPromise({
        try: () => db.query.decisions.findFirst({ where: eq(decisions.id, decisionId) }),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to get decision: ${error}`,
            operation: 'select',
            cause: error,
          }),
      });

      if (!decision) {
        return yield* Effect.fail(
          new NotFoundError({
            message: `Decision not found: ${decisionId}`,
            entity: 'decision',
            id: decisionId,
          }),
        );
      }

      yield* Effect.tryPromise({
        try: () =>
          db
            .insert(decisionEvidence)
            .values({
              organizationId: decision.organizationId,
              decisionId,
              contentItemId,
              confidence: options.confidence,
              evidenceType: options.evidenceType || 'discussion',
              stage: options.stage || 'decided',
              excerpt: options.excerpt,
            })
            .onConflictDoUpdate({
              target: [decisionEvidence.decisionId, decisionEvidence.contentItemId, decisionEvidence.evidenceType],
              set: { confidence: options.confidence, excerpt: options.excerpt },
            }),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to add evidence: ${error}`,
            operation: 'insert',
            cause: error,
          }),
      });
    }),

  linkDecision: (decisionId, entityType, entityId, linkType, options = {}) =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: () =>
          db
            .insert(decisionLinks)
            .values({
              decisionId,
              entityType,
              entityId,
              linkType,
              entityRef: options.entityRef,
              url: options.url,
            })
            .onConflictDoNothing()
            .returning()
            .then((rows) => rows[0]),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to link decision: ${error}`,
            operation: 'insert',
            cause: error,
          }),
      });

      if (!result) {
        // Link already exists, fetch it
        const existing = yield* Effect.tryPromise({
          try: () =>
            db.query.decisionLinks.findFirst({
              where: and(
                eq(decisionLinks.decisionId, decisionId),
                eq(decisionLinks.entityType, entityType),
                eq(decisionLinks.entityId, entityId),
                eq(decisionLinks.linkType, linkType),
              ),
            }),
          catch: (error) =>
            new DatabaseError({
              message: `Failed to get link: ${error}`,
              operation: 'select',
              cause: error,
            }),
        });

        if (!existing) {
          return yield* Effect.fail(
            new NotFoundError({
              message: 'Failed to create or find link',
              entity: 'decisionLink',
            }),
          );
        }

        return existing;
      }

      return result;
    }),

  updateStatus: (id, status, reason) =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: () =>
          db
            .update(decisions)
            .set({
              status,
              updatedAt: new Date(),
              metadata: reason
                ? sql`jsonb_set(COALESCE(metadata, '{}'::jsonb), '{statusChangeReason}', ${JSON.stringify(reason)}::jsonb)`
                : undefined,
            })
            .where(eq(decisions.id, id))
            .returning()
            .then((rows) => rows[0]),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to update status: ${error}`,
            operation: 'update',
            cause: error,
          }),
      });

      if (!result) {
        return yield* Effect.fail(
          new NotFoundError({
            message: `Decision not found: ${id}`,
            entity: 'decision',
            id,
          }),
        );
      }

      return result;
    }),

  supersede: (oldDecisionId, newDecisionId, reason) =>
    Effect.gen(function* () {
      // Mark old decision as superseded
      yield* Effect.tryPromise({
        try: () =>
          db
            .update(decisions)
            .set({
              status: 'superseded',
              updatedAt: new Date(),
              metadata: sql`jsonb_set(
                jsonb_set(COALESCE(metadata, '{}'::jsonb), '{supersededBy}', ${JSON.stringify(newDecisionId)}::jsonb),
                '{supersededReason}',
                ${JSON.stringify(reason || 'Superseded by newer decision')}::jsonb
              )`,
            })
            .where(eq(decisions.id, oldDecisionId)),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to supersede decision: ${error}`,
            operation: 'update',
            cause: error,
          }),
      });

      // Link the decisions
      yield* Effect.tryPromise({
        try: () =>
          db.insert(decisionLinks).values({
            decisionId: newDecisionId,
            entityType: 'decision',
            entityId: oldDecisionId,
            linkType: 'supersedes',
          }),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to link decisions: ${error}`,
            operation: 'insert',
            cause: error,
          }),
      });
    }),

  extractDecisionsFromContent: (contentItemId) =>
    Effect.gen(function* () {
      // Get the content item
      const itemOption = yield* contentRepository.getItemOption(contentItemId);
      if (Option.isNone(itemOption)) {
        return yield* Effect.fail(
          new ContentProcessingError({
            message: `Content item not found: ${contentItemId}`,
            itemId: contentItemId,
            stage: 'extracting',
          }),
        );
      }

      const item = itemOption.value;
      const content = item.content || '';

      if (content.length < 50) {
        return []; // Not enough content to extract decisions
      }

      // Use AI to extract decisions
      const extractionPrompt = `Analyze the following content and extract any decisions that were made or proposed.
For each decision, provide:
- summary: A clear, concise summary of the decision (1-2 sentences)
- context: The surrounding context or discussion that led to this decision
- reasoning: Why this decision was made (if stated)
- decisionType: One of: technical, product, process, resource, strategic, other
- confidence: How confident you are this is a real decision (0-100)
- participants: Names of people involved in making this decision
- tags: Relevant tags/topics for this decision

Content:
${content.slice(0, 5000)}

Return a JSON array of decisions. If no decisions are found, return an empty array.`;

      const result = yield* ai.generateText(extractionPrompt).pipe(
        Effect.mapError(
          (err) =>
            new ContentProcessingError({
              message: `AI extraction failed: ${err.message}`,
              itemId: contentItemId,
              stage: 'extracting',
              cause: err,
            }),
        ),
      );

      // Parse the AI response
      try {
        const jsonMatch = result.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          return [];
        }

        const extracted = JSON.parse(jsonMatch[0]) as ExtractedDecision[];
        return extracted.filter((d) => d.summary && d.summary.length > 10 && (d.confidence || 0) >= 50);
      } catch {
        return [];
      }
    }),

  findRelatedDecisions: (decisionId, options = {}) =>
    Effect.gen(function* () {
      const { limit = 10, minSimilarity = 0.7 } = options;

      // Get the decision
      const decision = yield* Effect.tryPromise({
        try: () => db.query.decisions.findFirst({ where: eq(decisions.id, decisionId) }),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to get decision: ${error}`,
            operation: 'select',
            cause: error,
          }),
      });

      if (!decision || !decision.embeddingVector) {
        return [];
      }

      // Find similar decisions using vector similarity
      const similarDecisions = yield* Effect.tryPromise({
        try: () =>
          db
            .select({
              decision: decisions,
              similarity: sql<number>`1 - (embedding_vector <=> ${JSON.stringify(decision.embeddingVector)}::vector)`,
            })
            .from(decisions)
            .where(
              and(
                eq(decisions.organizationId, decision.organizationId),
                sql`id != ${decisionId}`,
                sql`embedding_vector IS NOT NULL`,
              ),
            )
            .orderBy(sql`embedding_vector <=> ${JSON.stringify(decision.embeddingVector)}::vector`)
            .limit(limit),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to find related decisions: ${error}`,
            operation: 'select',
            cause: error,
          }),
      });

      return similarDecisions
        .filter((r) => r.similarity >= minSimilarity)
        .map((r) => ({
          decision: r.decision,
          similarity: r.similarity,
        }));
    }),

  getDecisionTimeline: (organizationId, options = {}) =>
    Effect.gen(function* () {
      const { limit = 50, startDate, endDate } = options;

      const conditions = [eq(decisions.organizationId, organizationId)];
      if (startDate) {
        conditions.push(gte(decisions.createdAt, startDate));
      }
      if (endDate) {
        conditions.push(lte(decisions.createdAt, endDate));
      }

      const decisionRows = yield* Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(decisions)
            .where(and(...conditions))
            .orderBy(desc(decisions.createdAt))
            .limit(limit),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to get timeline: ${error}`,
            operation: 'select',
            cause: error,
          }),
      });

      // For each decision, get related content
      const timeline: DecisionTimelineEntry[] = [];

      for (const decision of decisionRows) {
        const evidence = yield* Effect.tryPromise({
          try: () =>
            db
              .select({
                id: contentItems.id,
                type: contentItems.type,
                title: contentItems.title,
                sourceId: contentItems.sourceId,
                createdAt: contentItems.createdAt,
              })
              .from(decisionEvidence)
              .innerJoin(contentItems, eq(decisionEvidence.contentItemId, contentItems.id))
              .where(eq(decisionEvidence.decisionId, decision.id))
              .limit(5),
          catch: (error) =>
            new DatabaseError({
              message: `Failed to get evidence: ${error}`,
              operation: 'select',
              cause: error,
            }),
        });

        timeline.push({
          decision,
          relatedContent: evidence.map((e) => ({
            id: e.id,
            type: e.type,
            title: e.title,
            sourceType: e.sourceId, // We'd need to join to get actual source type
            createdAt: e.createdAt,
          })),
        });
      }

      return timeline;
    }),
});

// =============================================================================
// Layer
// =============================================================================

export const DecisionTrackerLive = Layer.effect(
  DecisionTracker,
  Effect.gen(function* () {
    const contentRepository = yield* ContentRepository;
    const embeddingService = yield* Embedding;
    const aiService = yield* AI;

    return makeDecisionTracker(contentRepository, embeddingService, aiService);
  }),
);

// =============================================================================
// Convenience Functions
// =============================================================================

export const createDecision = (input: CreateDecisionInput) =>
  Effect.gen(function* () {
    const tracker = yield* DecisionTracker;
    return yield* tracker.createDecision(input);
  });

export const getDecision = (id: string) =>
  Effect.gen(function* () {
    const tracker = yield* DecisionTracker;
    return yield* tracker.getDecision(id);
  });

export const listDecisions = (filters: DecisionFilters, pagination?: { limit?: number; offset?: number }) =>
  Effect.gen(function* () {
    const tracker = yield* DecisionTracker;
    return yield* tracker.listDecisions(filters, pagination);
  });

export const updateDecisionStatus = (id: string, status: DecisionStatus, reason?: string) =>
  Effect.gen(function* () {
    const tracker = yield* DecisionTracker;
    return yield* tracker.updateStatus(id, status, reason);
  });

export const extractDecisions = (contentItemId: string) =>
  Effect.gen(function* () {
    const tracker = yield* DecisionTracker;
    return yield* tracker.extractDecisionsFromContent(contentItemId);
  });
