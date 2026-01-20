/**
 * Smart Summary Service
 *
 * Generates intelligent summaries of topics, daily digests, and meeting prep materials
 * using AI analysis of the organization's knowledge base.
 */

import { gateway } from '@ai-sdk/gateway';
import { generateText } from 'ai';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { Context, Effect, Layer } from 'effect';
import { contentItems, decisions, topicClusters } from '../../../db/schema';
import { AIServiceError, DatabaseError } from '../../errors';
import { Database } from '../database';

// =============================================================================
// Types
// =============================================================================

export type SummaryDepth = 'brief' | 'detailed' | 'comprehensive';

export interface SourceBreakdown {
  readonly slack: number;
  readonly notion: number;
  readonly github: number;
  readonly video: number;
}

export interface TopicSummary {
  readonly title: string;
  readonly summary: string;
  readonly keyPoints: readonly string[];
  readonly relatedDecisions: readonly {
    readonly id: string;
    readonly title: string;
    readonly status: string;
  }[];
  readonly sourceBreakdown: SourceBreakdown;
}

export interface DailyDigest {
  readonly date: Date;
  readonly summary: string;
  readonly highlights: readonly string[];
  readonly newDecisions: readonly {
    readonly id: string;
    readonly title: string;
    readonly status: string;
  }[];
  readonly activeTopics: readonly {
    readonly id: string;
    readonly name: string;
    readonly activityCount: number;
  }[];
  readonly actionItems: readonly string[];
}

export interface MeetingPrepMaterial {
  readonly contextSummary: string;
  readonly keyDecisions: readonly {
    readonly id: string;
    readonly title: string;
    readonly status: string;
    readonly summary: string | null;
  }[];
  readonly openQuestions: readonly string[];
  readonly suggestedAgenda: readonly string[];
}

export interface SmartSummaryServiceInterface {
  /**
   * Generate a summary for a topic cluster
   */
  readonly generateTopicSummary: (
    clusterId: string,
    depth?: SummaryDepth,
  ) => Effect.Effect<TopicSummary, DatabaseError | AIServiceError>;

  /**
   * Generate a daily digest of organizational activity
   */
  readonly generateDailyDigest: (
    organizationId: string,
    date?: Date,
  ) => Effect.Effect<DailyDigest, DatabaseError | AIServiceError>;

  /**
   * Generate meeting preparation materials for specific topics
   */
  readonly generateMeetingPrep: (
    organizationId: string,
    topicIds: readonly string[],
  ) => Effect.Effect<MeetingPrepMaterial, DatabaseError | AIServiceError>;
}

// =============================================================================
// Service Tag
// =============================================================================

export class SmartSummary extends Context.Tag('SmartSummary')<SmartSummary, SmartSummaryServiceInterface>() {}

// =============================================================================
// Implementation
// =============================================================================

export const SmartSummaryLive = Layer.effect(
  SmartSummary,
  Effect.gen(function* () {
    const { db } = yield* Database;

    /**
     * Parse a list from AI response text
     */
    const parseList = (text: string | undefined): string[] => {
      if (!text) return [];
      return text
        .split('\n')
        .map((line) => line.replace(/^[-\d.]\s*/, '').trim())
        .filter(Boolean);
    };

    return {
      generateTopicSummary: (clusterId, depth = 'detailed') =>
        Effect.gen(function* () {
          // Get the topic cluster
          const cluster = yield* Effect.tryPromise({
            try: () =>
              db.query.topicClusters.findFirst({
                where: eq(topicClusters.id, clusterId),
              }),
            catch: (e) => new DatabaseError({ message: `Failed to fetch topic cluster: ${e}` }),
          });

          if (!cluster) {
            return yield* Effect.fail(new DatabaseError({ message: `Topic cluster not found: ${clusterId}` }));
          }

          // Get recent content items for this org (simplified - not filtering by topic)
          const items = yield* Effect.tryPromise({
            try: () =>
              db.query.contentItems.findMany({
                where: eq(contentItems.organizationId, cluster.organizationId),
                with: {
                  source: true,
                },
                orderBy: desc(contentItems.createdAt),
                limit: 30,
              }),
            catch: (e) => new DatabaseError({ message: `Failed to fetch content items: ${e}` }),
          });

          // Get related decisions
          const relatedDecisions = yield* Effect.tryPromise({
            try: () =>
              db.query.decisions.findMany({
                where: eq(decisions.organizationId, cluster.organizationId),
                orderBy: desc(decisions.createdAt),
                limit: 10,
              }),
            catch: (e) => new DatabaseError({ message: `Failed to fetch decisions: ${e}` }),
          });

          // Calculate source breakdown
          const sourceBreakdown: SourceBreakdown = {
            slack: items.filter((i) => i.source?.type === 'slack').length,
            notion: items.filter((i) => i.source?.type === 'notion').length,
            github: items.filter((i) => i.source?.type === 'github').length,
            video: items.filter((i) => i.source?.type === 'video').length,
          };

          // Build content for AI summarization
          const contentTexts = items
            .slice(0, 15)
            .map((item) => `[${item.source?.type || 'unknown'}] ${item.title}\n${item.content?.slice(0, 300) || ''}`)
            .join('\n\n---\n\n');

          const decisionTexts = relatedDecisions
            .map((d) => `Decision: ${d.summary} (${d.status})\n${d.summary || 'No summary'}`)
            .join('\n\n');

          const depthInstruction =
            depth === 'brief'
              ? 'Keep it to 2-3 sentences.'
              : depth === 'comprehensive'
                ? 'Provide a thorough analysis.'
                : 'Provide a balanced overview.';

          const prompt = `Summarize this topic: "${cluster.name}"

Content:
${contentTexts || 'No content available'}

Related decisions:
${decisionTexts || 'No decisions'}

${depthInstruction}

Format:
SUMMARY: [Your summary]

KEY_POINTS:
- [Point 1]
- [Point 2]
- [Point 3]`;

          const result = yield* Effect.tryPromise({
            try: () =>
              generateText({
                model: gateway('anthropic/claude-sonnet-4-20250514'),
                prompt,
              }),
            catch: (e) => new AIServiceError({ message: `Failed to generate summary: ${e}` }),
          });

          // Parse response
          const summaryMatch = result.text.match(/SUMMARY:\s*([\s\S]*?)(?=KEY_POINTS:|$)/i);
          const keyPointsMatch = result.text.match(/KEY_POINTS:\s*([\s\S]*?)$/i);

          return {
            title: cluster.name,
            summary: summaryMatch ? summaryMatch[1].trim() : result.text,
            keyPoints: parseList(keyPointsMatch?.[1]),
            relatedDecisions: relatedDecisions.map((d) => ({
              id: d.id,
              title: d.summary,
              status: d.status,
            })),
            sourceBreakdown,
          };
        }),

      generateDailyDigest: (organizationId, date) =>
        Effect.gen(function* () {
          const targetDate = date || new Date();
          const startOfDay = new Date(targetDate);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(targetDate);
          endOfDay.setHours(23, 59, 59, 999);

          // Get content items from that day
          const todaysContent = yield* Effect.tryPromise({
            try: () =>
              db.query.contentItems.findMany({
                where: and(
                  eq(contentItems.organizationId, organizationId),
                  gte(contentItems.createdAt, startOfDay),
                  lte(contentItems.createdAt, endOfDay),
                ),
                with: {
                  source: true,
                },
                orderBy: desc(contentItems.createdAt),
              }),
            catch: (e) => new DatabaseError({ message: `Failed to fetch daily content: ${e}` }),
          });

          // Get new decisions from that day
          const newDecisions = yield* Effect.tryPromise({
            try: () =>
              db.query.decisions.findMany({
                where: and(
                  eq(decisions.organizationId, organizationId),
                  gte(decisions.createdAt, startOfDay),
                  lte(decisions.createdAt, endOfDay),
                ),
                orderBy: desc(decisions.createdAt),
              }),
            catch: (e) => new DatabaseError({ message: `Failed to fetch new decisions: ${e}` }),
          });

          // Generate AI summary
          const contentSummaries = todaysContent
            .slice(0, 20)
            .map((item) => `- [${item.source?.type}] ${item.title}`)
            .join('\n');

          const decisionSummaries = newDecisions.map((d) => `- ${d.summary} (${d.status})`).join('\n');

          const prompt = `Generate a daily digest for ${targetDate.toDateString()}.

Today's activity (${todaysContent.length} items):
${contentSummaries || 'No new content'}

New decisions:
${decisionSummaries || 'No new decisions'}

Format:
SUMMARY: [1-2 sentence overview]

HIGHLIGHTS:
- [Highlight 1]
- [Highlight 2]

ACTION_ITEMS:
- [Action item 1]
- [Action item 2]`;

          const result = yield* Effect.tryPromise({
            try: () =>
              generateText({
                model: gateway('anthropic/claude-sonnet-4-20250514'),
                prompt,
              }),
            catch: (e) => new AIServiceError({ message: `Failed to generate digest: ${e}` }),
          });

          // Parse response
          const summaryMatch = result.text.match(/SUMMARY:\s*([\s\S]*?)(?=HIGHLIGHTS:|$)/i);
          const highlightsMatch = result.text.match(/HIGHLIGHTS:\s*([\s\S]*?)(?=ACTION_ITEMS:|$)/i);
          const actionItemsMatch = result.text.match(/ACTION_ITEMS:\s*([\s\S]*?)$/i);

          return {
            date: targetDate,
            summary: summaryMatch ? summaryMatch[1].trim() : 'No activity summary available.',
            highlights: parseList(highlightsMatch?.[1]),
            newDecisions: newDecisions.map((d) => ({
              id: d.id,
              title: d.summary,
              status: d.status,
            })),
            activeTopics: [], // Simplified - would need topic member join
            actionItems: parseList(actionItemsMatch?.[1]),
          };
        }),

      generateMeetingPrep: (organizationId, topicIds) =>
        Effect.gen(function* () {
          if (topicIds.length === 0) {
            return {
              contextSummary: 'No topics specified for meeting preparation.',
              keyDecisions: [],
              openQuestions: [],
              suggestedAgenda: [],
            };
          }

          // Get topics
          const topics = yield* Effect.tryPromise({
            try: () =>
              db.query.topicClusters.findMany({
                where: eq(topicClusters.organizationId, organizationId),
              }),
            catch: (e) => new DatabaseError({ message: `Failed to fetch topics: ${e}` }),
          });

          const relevantTopics = topics.filter((t) => topicIds.includes(t.id));

          // Get related decisions
          const relatedDecisions = yield* Effect.tryPromise({
            try: () =>
              db.query.decisions.findMany({
                where: eq(decisions.organizationId, organizationId),
                orderBy: desc(decisions.createdAt),
                limit: 15,
              }),
            catch: (e) => new DatabaseError({ message: `Failed to fetch decisions: ${e}` }),
          });

          // Build context for AI
          const topicNames = relevantTopics.map((t) => t.name).join(', ');
          const decisionSummaries = relatedDecisions
            .slice(0, 10)
            .map((d) => `- ${d.summary} (${d.status}): ${d.summary || 'No summary'}`)
            .join('\n');

          const prompt = `Generate meeting preparation materials for topics: ${topicNames || 'General'}

Related decisions:
${decisionSummaries || 'No related decisions'}

Format:
CONTEXT_SUMMARY: [2-3 paragraph overview]

OPEN_QUESTIONS:
- [Question 1]
- [Question 2]

SUGGESTED_AGENDA:
1. [Agenda item 1]
2. [Agenda item 2]`;

          const result = yield* Effect.tryPromise({
            try: () =>
              generateText({
                model: gateway('anthropic/claude-sonnet-4-20250514'),
                prompt,
              }),
            catch: (e) => new AIServiceError({ message: `Failed to generate meeting prep: ${e}` }),
          });

          // Parse response
          const contextMatch = result.text.match(/CONTEXT_SUMMARY:\s*([\s\S]*?)(?=OPEN_QUESTIONS:|$)/i);
          const questionsMatch = result.text.match(/OPEN_QUESTIONS:\s*([\s\S]*?)(?=SUGGESTED_AGENDA:|$)/i);
          const agendaMatch = result.text.match(/SUGGESTED_AGENDA:\s*([\s\S]*?)$/i);

          return {
            contextSummary: contextMatch ? contextMatch[1].trim() : 'Unable to generate context summary.',
            keyDecisions: relatedDecisions.slice(0, 10).map((d) => ({
              id: d.id,
              title: d.summary,
              status: d.status,
              summary: d.summary,
            })),
            openQuestions: parseList(questionsMatch?.[1]),
            suggestedAgenda: parseList(agendaMatch?.[1]),
          };
        }),
    };
  }),
);

// =============================================================================
// Convenience Functions
// =============================================================================

export const generateTopicSummary = (clusterId: string, depth?: SummaryDepth) =>
  Effect.gen(function* () {
    const service = yield* SmartSummary;
    return yield* service.generateTopicSummary(clusterId, depth);
  });

export const generateDailyDigest = (organizationId: string, date?: Date) =>
  Effect.gen(function* () {
    const service = yield* SmartSummary;
    return yield* service.generateDailyDigest(organizationId, date);
  });

export const generateMeetingPrep = (organizationId: string, topicIds: readonly string[]) =>
  Effect.gen(function* () {
    const service = yield* SmartSummary;
    return yield* service.generateMeetingPrep(organizationId, topicIds);
  });
