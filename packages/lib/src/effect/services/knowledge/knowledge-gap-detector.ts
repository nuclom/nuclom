/**
 * Knowledge Gap Detector Service
 *
 * Analyzes the knowledge base to find gaps, undocumented decisions,
 * potential conflicts, and areas needing attention.
 */

import { gateway } from '@ai-sdk/gateway';
import { generateText } from 'ai';
import { and, eq, inArray, or } from 'drizzle-orm';
import { Context, Effect, Layer } from 'effect';
import { contentItems, decisionEvidence, decisions, topicClusters } from '../../../db/schema';
import { AIServiceError, DatabaseError } from '../../errors';
import { Database } from '../database';
import { Embedding } from '../embedding';

// =============================================================================
// Types
// =============================================================================

export type GapType = 'no_documentation' | 'no_implementation' | 'no_evidence' | 'stale';
export type GapSeverity = 'high' | 'medium' | 'low';
export type ConflictType = 'direct_contradiction' | 'supersession_unclear' | 'scope_overlap';

export interface UndocumentedDecision {
  readonly decision: {
    readonly id: string;
    readonly title: string;
    readonly status: string;
    readonly decidedAt: Date | null;
  };
  readonly gapType: GapType;
  readonly severity: GapSeverity;
  readonly suggestion: string;
}

export interface DecisionConflict {
  readonly items: readonly [
    { id: string; title: string; decidedAt: Date | null },
    { id: string; title: string; decidedAt: Date | null },
  ];
  readonly conflictType: ConflictType;
  readonly confidence: number;
  readonly explanation: string;
}

export interface TopicCoverageGap {
  readonly topic: {
    readonly id: string;
    readonly name: string;
    readonly contentCount: number;
  };
  readonly coverageScore: number;
  readonly gaps: readonly string[];
  readonly recommendation: string;
}

export interface KnowledgeGapDetectorServiceInterface {
  /**
   * Find decisions that lack proper documentation or implementation evidence
   */
  readonly findUndocumentedDecisions: (
    organizationId: string,
  ) => Effect.Effect<readonly UndocumentedDecision[], DatabaseError>;

  /**
   * Detect potential conflicts between decisions
   */
  readonly detectConflicts: (
    organizationId: string,
  ) => Effect.Effect<readonly DecisionConflict[], DatabaseError | AIServiceError>;

  /**
   * Analyze topic coverage and find gaps
   */
  readonly analyzeTopicCoverage: (organizationId: string) => Effect.Effect<readonly TopicCoverageGap[], DatabaseError>;
}

// =============================================================================
// Service Tag
// =============================================================================

export class KnowledgeGapDetector extends Context.Tag('KnowledgeGapDetector')<
  KnowledgeGapDetector,
  KnowledgeGapDetectorServiceInterface
>() {}

// =============================================================================
// Implementation
// =============================================================================

export const KnowledgeGapDetectorLive = Layer.effect(
  KnowledgeGapDetector,
  Effect.gen(function* () {
    const { db } = yield* Database;
    const embeddingService = yield* Embedding;

    /**
     * Calculate days since a date
     */
    const daysSince = (date: Date | null): number => {
      if (!date) return Infinity;
      return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    };

    return {
      findUndocumentedDecisions: (organizationId) =>
        Effect.gen(function* () {
          // Get all decisions with status 'decided' or 'implemented'
          const allDecisions = yield* Effect.tryPromise({
            try: () =>
              db.query.decisions.findMany({
                where: and(
                  eq(decisions.organizationId, organizationId),
                  or(eq(decisions.status, 'decided'), eq(decisions.status, 'implemented')),
                ),
              }),
            catch: (e) => new DatabaseError({ message: `Failed to fetch decisions: ${e}` }),
          });

          const decisionIds = allDecisions.map((decision) => decision.id);
          const evidenceRecords =
            decisionIds.length > 0
              ? yield* Effect.tryPromise({
                  try: () =>
                    db.query.decisionEvidence.findMany({
                      where: and(
                        eq(decisionEvidence.organizationId, organizationId),
                        inArray(decisionEvidence.decisionId, decisionIds),
                      ),
                    }),
                  catch: (e) => new DatabaseError({ message: `Failed to fetch decision evidence: ${e}` }),
                })
              : [];

          const evidenceByDecisionId = new Map<string, typeof evidenceRecords>();
          for (const record of evidenceRecords) {
            const existing = evidenceByDecisionId.get(record.decisionId);
            if (existing) {
              existing.push(record);
            } else {
              evidenceByDecisionId.set(record.decisionId, [record]);
            }
          }

          const gaps: UndocumentedDecision[] = [];

          for (const decision of allDecisions) {
            const evidence = evidenceByDecisionId.get(decision.id) || [];
            const hasDocumentation = evidence.some((record) => record.evidenceType === 'documentation');
            const hasImplementation = evidence.some((record) => record.evidenceType === 'implementation');
            const hasAnyEvidence = evidence.length > 0;
            const isStale = daysSince(decision.createdAt) > 180; // Over 6 months old

            // Determine gap type and severity
            if (decision.status === 'decided' && !hasDocumentation) {
              gaps.push({
                decision: {
                  id: decision.id,
                  title: decision.summary,
                  status: decision.status,
                  decidedAt: decision.createdAt,
                },
                gapType: 'no_documentation',
                severity: 'high',
                suggestion: `Decision "${decision.summary}" was made but has no documentation. Consider adding a Notion page or README update.`,
              });
            } else if (decision.status === 'implemented' && !hasImplementation) {
              gaps.push({
                decision: {
                  id: decision.id,
                  title: decision.summary,
                  status: decision.status,
                  decidedAt: decision.createdAt,
                },
                gapType: 'no_implementation',
                severity: 'medium',
                suggestion: `Decision "${decision.summary}" is marked as implemented but has no linked implementation evidence. Link the relevant PR or code.`,
              });
            } else if (!hasAnyEvidence) {
              gaps.push({
                decision: {
                  id: decision.id,
                  title: decision.summary,
                  status: decision.status,
                  decidedAt: decision.createdAt,
                },
                gapType: 'no_evidence',
                severity: 'medium',
                suggestion: `Decision "${decision.summary}" has no supporting evidence. Add links to discussions, documents, or code that led to this decision.`,
              });
            } else if (isStale && decision.status === 'decided') {
              gaps.push({
                decision: {
                  id: decision.id,
                  title: decision.summary,
                  status: decision.status,
                  decidedAt: decision.createdAt,
                },
                gapType: 'stale',
                severity: 'low',
                suggestion: `Decision "${decision.summary}" was made over 6 months ago but hasn't been implemented. Review if it's still relevant.`,
              });
            }
          }

          // Sort by severity
          const severityOrder: Record<GapSeverity, number> = { high: 0, medium: 1, low: 2 };
          return gaps.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
        }),

      detectConflicts: (organizationId) =>
        Effect.gen(function* () {
          // Get recent decisions
          const recentDecisions = yield* Effect.tryPromise({
            try: () =>
              db.query.decisions.findMany({
                where: and(
                  eq(decisions.organizationId, organizationId),
                  or(
                    eq(decisions.status, 'decided'),
                    eq(decisions.status, 'implemented'),
                    eq(decisions.status, 'proposed'),
                  ),
                ),
                orderBy: (d, { desc }) => [desc(d.createdAt)],
                limit: 50,
              }),
            catch: (e) => new DatabaseError({ message: `Failed to fetch decisions: ${e}` }),
          });

          if (recentDecisions.length < 2) {
            return [];
          }

          // Generate embeddings for decision summaries
          const decisionTexts = recentDecisions.map(
            (d) => `${d.summary}. ${d.reasoning || ''} Context: ${d.context || ''}`,
          );

          const embeddings = yield* embeddingService.generateEmbeddings(decisionTexts);

          // Find similar pairs using cosine similarity
          const conflicts: DecisionConflict[] = [];
          const similarityThreshold = 0.75;

          for (let i = 0; i < recentDecisions.length; i++) {
            for (let j = i + 1; j < recentDecisions.length; j++) {
              const embedding1 = embeddings[i];
              const embedding2 = embeddings[j];

              // Calculate cosine similarity
              let dotProduct = 0;
              let norm1 = 0;
              let norm2 = 0;
              for (let k = 0; k < embedding1.length; k++) {
                dotProduct += embedding1[k] * embedding2[k];
                norm1 += embedding1[k] * embedding1[k];
                norm2 += embedding2[k] * embedding2[k];
              }
              const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));

              if (similarity >= similarityThreshold) {
                // Use AI to determine if this is actually a conflict
                const decision1 = recentDecisions[i];
                const decision2 = recentDecisions[j];

                const prompt = `Analyze these two decisions for potential conflicts:

Decision 1: "${decision1.summary}"
Summary: ${decision1.summary || 'No summary'}
Status: ${decision1.status}

Decision 2: "${decision2.summary}"
Summary: ${decision2.summary || 'No summary'}
Status: ${decision2.status}

Determine if these decisions:
1. CONFLICT - They directly contradict each other
2. SUPERSEDE - One should replace the other
3. OVERLAP - They cover similar scope
4. NO_CONFLICT - They are compatible

Respond:
RESULT: [CONFLICT|SUPERSEDE|OVERLAP|NO_CONFLICT]
CONFIDENCE: [0.0-1.0]
EXPLANATION: [Brief explanation]`;

                const result = yield* Effect.tryPromise({
                  try: () =>
                    generateText({
                      model: gateway('anthropic/claude-sonnet-4-20250514'),
                      prompt,
                    }),
                  catch: (e) => new AIServiceError({ message: `Failed to analyze conflict: ${e}` }),
                });

                const resultMatch = result.text.match(/RESULT:\s*(CONFLICT|SUPERSEDE|OVERLAP|NO_CONFLICT)/i);
                const confidenceMatch = result.text.match(/CONFIDENCE:\s*([\d.]+)/i);
                const explanationMatch = result.text.match(/EXPLANATION:\s*(.+)/i);

                const conflictResult = resultMatch?.[1]?.toUpperCase();
                const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : similarity;
                const explanation = explanationMatch?.[1] || 'Potential overlap detected';

                if (conflictResult && conflictResult !== 'NO_CONFLICT') {
                  const conflictType: ConflictType =
                    conflictResult === 'CONFLICT'
                      ? 'direct_contradiction'
                      : conflictResult === 'SUPERSEDE'
                        ? 'supersession_unclear'
                        : 'scope_overlap';

                  conflicts.push({
                    items: [
                      { id: decision1.id, title: decision1.summary, decidedAt: decision1.createdAt },
                      { id: decision2.id, title: decision2.summary, decidedAt: decision2.createdAt },
                    ],
                    conflictType,
                    confidence,
                    explanation,
                  });
                }
              }
            }
          }

          // Sort by confidence
          return conflicts.sort((a, b) => b.confidence - a.confidence);
        }),

      analyzeTopicCoverage: (organizationId) =>
        Effect.gen(function* () {
          // Get all topic clusters
          const topics = yield* Effect.tryPromise({
            try: () =>
              db.query.topicClusters.findMany({
                where: eq(topicClusters.organizationId, organizationId),
              }),
            catch: (e) => new DatabaseError({ message: `Failed to fetch topics: ${e}` }),
          });

          // Get content counts per organization (simplified without join)
          const contentCount = yield* Effect.tryPromise({
            try: () =>
              db.query.contentItems.findMany({
                where: eq(contentItems.organizationId, organizationId),
                columns: {
                  id: true,
                },
              }),
            catch: (e) => new DatabaseError({ message: `Failed to fetch content counts: ${e}` }),
          });

          const totalContent = contentCount.length;
          const avgPerTopic = topics.length > 0 ? Math.ceil(totalContent / topics.length) : 0;

          const gaps: TopicCoverageGap[] = [];

          for (const topic of topics) {
            // Simplified: estimate content count based on average
            const estimatedCount = avgPerTopic;

            // Calculate coverage score based on content count
            const coverageScore = Math.min(estimatedCount / 10, 1);

            const gapsList: string[] = [];
            let recommendation = '';

            if (estimatedCount === 0) {
              gapsList.push('No content associated with this topic');
              recommendation = `Topic "${topic.name}" has no content. Consider linking relevant discussions or documents.`;
            } else if (estimatedCount < 3) {
              gapsList.push('Very limited content coverage');
              recommendation = `Topic "${topic.name}" has limited coverage. Look for additional discussions to link.`;
            } else if (estimatedCount < 5) {
              gapsList.push('Moderate content coverage');
              recommendation = `Topic "${topic.name}" could benefit from more documentation.`;
            }

            if (gapsList.length > 0) {
              gaps.push({
                topic: {
                  id: topic.id,
                  name: topic.name,
                  contentCount: estimatedCount,
                },
                coverageScore,
                gaps: gapsList,
                recommendation,
              });
            }
          }

          // Sort by coverage score (lowest first)
          return gaps.sort((a, b) => a.coverageScore - b.coverageScore);
        }),
    };
  }),
);

// =============================================================================
// Convenience Functions
// =============================================================================

export const findUndocumentedDecisions = (organizationId: string) =>
  Effect.gen(function* () {
    const detector = yield* KnowledgeGapDetector;
    return yield* detector.findUndocumentedDecisions(organizationId);
  });

export const detectConflicts = (organizationId: string) =>
  Effect.gen(function* () {
    const detector = yield* KnowledgeGapDetector;
    return yield* detector.detectConflicts(organizationId);
  });

export const analyzeTopicCoverage = (organizationId: string) =>
  Effect.gen(function* () {
    const detector = yield* KnowledgeGapDetector;
    return yield* detector.analyzeTopicCoverage(organizationId);
  });
