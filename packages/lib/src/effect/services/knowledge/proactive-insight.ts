/**
 * Proactive Insight Service
 *
 * Generates proactive insights and recommendations based on patterns
 * and trends in the organization's knowledge base.
 */

import { gateway } from '@ai-sdk/gateway';
import { generateText } from 'ai';
import { desc, eq } from 'drizzle-orm';
import { Context, Effect, Layer } from 'effect';
import { contentItems, contentSources, decisions, topicClusters } from '../../../db/schema';
import { AIServiceError, DatabaseError } from '../../errors';
import { Database } from '../database';

// =============================================================================
// Types
// =============================================================================

export type InsightType = 'trend' | 'opportunity' | 'risk' | 'connection';
export type ImpactLevel = 'high' | 'medium' | 'low';

export interface ProactiveInsightItem {
  readonly insight: string;
  readonly type: InsightType;
  readonly confidence: number;
  readonly evidence: readonly string[];
  readonly actionItems: readonly string[];
}

export interface Recommendation {
  readonly recommendation: string;
  readonly reasoning: string;
  readonly impact: ImpactLevel;
}

export interface TrendAnalysis {
  readonly topic: string;
  readonly direction: 'increasing' | 'decreasing' | 'stable';
  readonly changePercentage: number;
  readonly period: string;
}

export interface ProactiveInsightServiceInterface {
  /**
   * Generate insights based on patterns in the knowledge base
   */
  readonly generateInsights: (
    organizationId: string,
    options?: {
      readonly timeWindow?: number; // days to look back
      readonly limit?: number;
    },
  ) => Effect.Effect<readonly ProactiveInsightItem[], DatabaseError | AIServiceError>;

  /**
   * Get personalized recommendations
   */
  readonly getRecommendations: (
    organizationId: string,
    context?: {
      readonly userId?: string;
      readonly topicId?: string;
    },
  ) => Effect.Effect<readonly Recommendation[], DatabaseError | AIServiceError>;

  /**
   * Analyze trends in the knowledge base
   */
  readonly analyzeTrends: (
    organizationId: string,
    timeWindow?: number,
  ) => Effect.Effect<readonly TrendAnalysis[], DatabaseError>;
}

// =============================================================================
// Service Tag
// =============================================================================

export class ProactiveInsight extends Context.Tag('ProactiveInsight')<
  ProactiveInsight,
  ProactiveInsightServiceInterface
>() {}

// =============================================================================
// Implementation
// =============================================================================

export const ProactiveInsightLive = Layer.effect(
  ProactiveInsight,
  Effect.gen(function* () {
    const { db } = yield* Database;

    /**
     * Parse a list from AI response text
     */
    const parseList = (text: string | undefined): string[] => {
      if (!text) return [];
      return text
        .split('\n')
        .map((line) => line.replace(/^[-•]\s*/, '').trim())
        .filter(Boolean);
    };

    return {
      generateInsights: (organizationId, options) =>
        Effect.gen(function* () {
          const timeWindow = options?.timeWindow || 30;
          const limit = options?.limit || 10;
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - timeWindow);

          // Get recent content activity
          const recentContent = yield* Effect.tryPromise({
            try: () =>
              db.query.contentItems.findMany({
                where: (c, { and, eq, gte }) => and(eq(c.organizationId, organizationId), gte(c.createdAt, cutoffDate)),
                with: {
                  source: true,
                },
                orderBy: desc(contentItems.createdAt),
                limit: 100,
              }),
            catch: (e) => new DatabaseError({ message: `Failed to fetch recent content: ${e}` }),
          });

          // Get recent decisions
          const recentDecisions = yield* Effect.tryPromise({
            try: () =>
              db.query.decisions.findMany({
                where: (d, { and, eq, gte }) => and(eq(d.organizationId, organizationId), gte(d.createdAt, cutoffDate)),
                orderBy: desc(decisions.createdAt),
              }),
            catch: (e) => new DatabaseError({ message: `Failed to fetch recent decisions: ${e}` }),
          });

          // Calculate source breakdown
          const sourceBreakdown = {
            slack: recentContent.filter((c) => c.source?.type === 'slack').length,
            notion: recentContent.filter((c) => c.source?.type === 'notion').length,
            github: recentContent.filter((c) => c.source?.type === 'github').length,
            video: recentContent.filter((c) => c.source?.type === 'video').length,
          };

          // Calculate decision status breakdown
          const decisionsByStatus = {
            proposed: recentDecisions.filter((d) => d.status === 'proposed').length,
            decided: recentDecisions.filter((d) => d.status === 'decided').length,
            implemented: recentDecisions.filter((d) => d.status === 'implemented').length,
            revisited: recentDecisions.filter((d) => d.status === 'revisited').length,
            superseded: recentDecisions.filter((d) => d.status === 'superseded').length,
          };

          const prompt = `Analyze this organization's recent activity and generate insights.

Time period: Last ${timeWindow} days

Total activity: ${recentContent.length} content items, ${recentDecisions.length} decisions

Source breakdown:
- Slack: ${sourceBreakdown.slack}
- Notion: ${sourceBreakdown.notion}
- GitHub: ${sourceBreakdown.github}
- Video: ${sourceBreakdown.video}

Decision status breakdown:
- Proposed: ${decisionsByStatus.proposed}
- Decided: ${decisionsByStatus.decided}
- Implemented: ${decisionsByStatus.implemented}
- Revisited: ${decisionsByStatus.revisited}
- Superseded: ${decisionsByStatus.superseded}

Generate ${limit} insights. For each, categorize as:
- TREND: A pattern or direction
- OPPORTUNITY: Something to leverage
- RISK: A potential concern
- CONNECTION: A relationship between topics

Format each as:
---
TYPE: [TREND|OPPORTUNITY|RISK|CONNECTION]
INSIGHT: [The insight]
CONFIDENCE: [0.0-1.0]
EVIDENCE: [Bullet points]
ACTION_ITEMS: [Bullet points]
---`;

          const result = yield* Effect.tryPromise({
            try: () =>
              generateText({
                model: gateway('anthropic/claude-sonnet-4-20250514'),
                prompt,
              }),
            catch: (e) => new AIServiceError({ message: `Failed to generate insights: ${e}` }),
          });

          // Parse insights from response
          const insights: ProactiveInsightItem[] = [];
          const insightBlocks = result.text.split('---').filter((block) => block.trim());

          for (const block of insightBlocks) {
            const typeMatch = block.match(/TYPE:\s*(TREND|OPPORTUNITY|RISK|CONNECTION)/i);
            const insightMatch = block.match(/INSIGHT:\s*([^\n]+)/i);
            const confidenceMatch = block.match(/CONFIDENCE:\s*([\d.]+)/i);
            const evidenceMatch = block.match(/EVIDENCE:\s*([\s\S]*?)(?=ACTION_ITEMS:|$)/i);
            const actionMatch = block.match(/ACTION_ITEMS:\s*([\s\S]*?)$/i);

            if (typeMatch && insightMatch) {
              insights.push({
                insight: insightMatch[1].trim(),
                type: typeMatch[1].toLowerCase() as InsightType,
                confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.7,
                evidence: parseList(evidenceMatch?.[1]),
                actionItems: parseList(actionMatch?.[1]),
              });
            }
          }

          return insights.slice(0, limit);
        }),

      getRecommendations: (organizationId, context) =>
        Effect.gen(function* () {
          // Get organization's current state
          const sources = yield* Effect.tryPromise({
            try: () =>
              db.query.contentSources.findMany({
                where: eq(contentSources.organizationId, organizationId),
              }),
            catch: (e) => new DatabaseError({ message: `Failed to fetch sources: ${e}` }),
          });

          const topics = yield* Effect.tryPromise({
            try: () =>
              db.query.topicClusters.findMany({
                where: eq(topicClusters.organizationId, organizationId),
              }),
            catch: (e) => new DatabaseError({ message: `Failed to fetch topics: ${e}` }),
          });

          const pendingDecisions = yield* Effect.tryPromise({
            try: () =>
              db.query.decisions.findMany({
                where: (d, { eq, and }) => and(eq(d.organizationId, organizationId), eq(d.status, 'proposed')),
              }),
            catch: (e) => new DatabaseError({ message: `Failed to fetch pending decisions: ${e}` }),
          });

          // Get specific topic context if provided
          let topicContext = '';
          if (context?.topicId) {
            const topic = topics.find((t) => t.id === context.topicId);
            if (topic) {
              topicContext = `\nFocused on topic: ${topic.name}\nDescription: ${topic.description || 'No description'}`;
            }
          }

          const prompt = `Generate recommendations for this organization.

Current setup:
- ${sources.length} content sources connected (${sources.map((s) => s.type).join(', ')})
- ${topics.length} topic clusters
- ${pendingDecisions.length} pending decisions
${topicContext}

Generate 5 actionable recommendations.

Format each as:
---
RECOMMENDATION: [The recommendation]
REASONING: [Why this would help]
IMPACT: [HIGH|MEDIUM|LOW]
---`;

          const result = yield* Effect.tryPromise({
            try: () =>
              generateText({
                model: gateway('anthropic/claude-sonnet-4-20250514'),
                prompt,
              }),
            catch: (e) => new AIServiceError({ message: `Failed to generate recommendations: ${e}` }),
          });

          // Parse recommendations
          const recommendations: Recommendation[] = [];
          const blocks = result.text.split('---').filter((block) => block.trim());

          for (const block of blocks) {
            const recMatch = block.match(/RECOMMENDATION:\s*([^\n]+(?:\n(?!REASONING:)[^\n]+)*)/i);
            const reasonMatch = block.match(/REASONING:\s*([^\n]+(?:\n(?!IMPACT:)[^\n]+)*)/i);
            const impactMatch = block.match(/IMPACT:\s*(HIGH|MEDIUM|LOW)/i);

            if (recMatch) {
              recommendations.push({
                recommendation: recMatch[1].trim(),
                reasoning: reasonMatch ? reasonMatch[1].trim() : 'No reasoning provided',
                impact: (impactMatch?.[1]?.toLowerCase() as ImpactLevel) || 'medium',
              });
            }
          }

          return recommendations;
        }),

      analyzeTrends: (organizationId, timeWindow = 30) =>
        Effect.gen(function* () {
          // Get topic clusters
          const topics = yield* Effect.tryPromise({
            try: () =>
              db.query.topicClusters.findMany({
                where: eq(topicClusters.organizationId, organizationId),
              }),
            catch: (e) => new DatabaseError({ message: `Failed to fetch topics: ${e}` }),
          });

          // For a simplified implementation, return basic trend info
          // A full implementation would query content counts by time period
          const trends: TrendAnalysis[] = topics.slice(0, 10).map((topic) => ({
            topic: topic.name,
            direction: 'stable' as const,
            changePercentage: 0,
            period: `Last ${timeWindow} days`,
          }));

          return trends;
        }),
    };
  }),
);

// =============================================================================
// Convenience Functions
// =============================================================================

export const generateInsights = (organizationId: string, options?: { timeWindow?: number; limit?: number }) =>
  Effect.gen(function* () {
    const service = yield* ProactiveInsight;
    return yield* service.generateInsights(organizationId, options);
  });

export const getRecommendations = (organizationId: string, context?: { userId?: string; topicId?: string }) =>
  Effect.gen(function* () {
    const service = yield* ProactiveInsight;
    return yield* service.getRecommendations(organizationId, context);
  });

export const analyzeTrends = (organizationId: string, timeWindow?: number) =>
  Effect.gen(function* () {
    const service = yield* ProactiveInsight;
    return yield* service.analyzeTrends(organizationId, timeWindow);
  });
