/**
 * Knowledge Graph Extended Schema
 *
 * Additional tables for enhanced knowledge graph functionality:
 * - decisionEvidence: Track how decisions evolve across sources
 * - topicClusters: Topic clusters aggregate content across sources
 * - topicClusterMembers: Map content items to topic clusters
 * - topicExpertise: Track people's expertise by topic
 */

import { relations } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgTable, real, text, timestamp, unique, vector } from 'drizzle-orm/pg-core';
import { organizations, users } from './auth';
import { contentItems } from './content';
import { decisions } from './knowledge';

// =============================================================================
// Types
// =============================================================================

/**
 * Decision stage in lifecycle
 */
export type DecisionStage = 'proposed' | 'discussed' | 'decided' | 'documented' | 'implemented' | 'revised';

/**
 * Evidence type for decision tracking
 */
export type DecisionEvidenceType =
  | 'origin'
  | 'discussion'
  | 'documentation'
  | 'implementation'
  | 'revision'
  | 'superseded';

/**
 * Source breakdown by content type
 */
export type SourceBreakdown = {
  readonly video?: number;
  readonly slack?: number;
  readonly notion?: number;
  readonly github?: number;
  readonly [key: string]: number | undefined;
};

// =============================================================================
// Decision Evidence
// =============================================================================

export const decisionEvidence = pgTable(
  'decision_evidence',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    decisionId: text('decision_id')
      .notNull()
      .references(() => decisions.id, { onDelete: 'cascade' }),
    contentItemId: text('content_item_id')
      .notNull()
      .references(() => contentItems.id, { onDelete: 'cascade' }),
    evidenceType: text('evidence_type').$type<DecisionEvidenceType>().notNull(),
    stage: text('stage').$type<DecisionStage>().notNull(),
    excerpt: text('excerpt'), // Relevant text excerpt
    timestampInSource: timestamp('timestamp_in_source'),
    confidence: real('confidence').default(1.0).notNull(),
    detectedBy: text('detected_by').default('ai').notNull(), // 'ai', 'explicit_link', 'user'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    decisionIdx: index('decision_evidence_decision_idx').on(table.decisionId),
    contentIdx: index('decision_evidence_content_idx').on(table.contentItemId),
    orgIdx: index('decision_evidence_org_idx').on(table.organizationId),
    uniqueDecisionContent: unique('decision_evidence_decision_content_unique').on(
      table.decisionId,
      table.contentItemId,
      table.evidenceType,
    ),
  }),
);

// =============================================================================
// Topic Clusters
// =============================================================================

export const topicClusters = pgTable(
  'topic_clusters',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    keywords: jsonb('keywords').$type<string[]>().default([]).notNull(), // Top keywords for this topic
    embeddingCentroid: vector('embedding_centroid', { dimensions: 1536 }), // Cluster center for similarity
    contentCount: integer('content_count').default(0).notNull(),
    sourceBreakdown: jsonb('source_breakdown').$type<SourceBreakdown>().default({}).notNull(),
    participantCount: integer('participant_count').default(0).notNull(),
    lastActivityAt: timestamp('last_activity_at'),
    trendingScore: real('trending_score').default(0).notNull(), // For trending topics
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index('topic_clusters_org_idx').on(table.organizationId),
    trendingIdx: index('topic_clusters_trending_idx').on(table.trendingScore),
  }),
);

// =============================================================================
// Topic Cluster Members
// =============================================================================

export const topicClusterMembers = pgTable(
  'topic_cluster_members',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    clusterId: text('cluster_id')
      .notNull()
      .references(() => topicClusters.id, { onDelete: 'cascade' }),
    contentItemId: text('content_item_id')
      .notNull()
      .references(() => contentItems.id, { onDelete: 'cascade' }),
    similarityScore: real('similarity_score').notNull(),
    isPrimary: boolean('is_primary').default(false).notNull(), // Primary topic for this content
    addedAt: timestamp('added_at').defaultNow().notNull(),
  },
  (table) => ({
    clusterIdx: index('topic_cluster_members_cluster_idx').on(table.clusterId),
    contentIdx: index('topic_cluster_members_content_idx').on(table.contentItemId),
    uniqueClusterContent: unique('topic_cluster_members_cluster_content_unique').on(
      table.clusterId,
      table.contentItemId,
    ),
  }),
);

// =============================================================================
// Topic Expertise
// =============================================================================

export const topicExpertise = pgTable(
  'topic_expertise',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    clusterId: text('cluster_id')
      .notNull()
      .references(() => topicClusters.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    externalId: text('external_id'), // For non-linked users
    name: text('name').notNull(),
    contributionCount: integer('contribution_count').default(1).notNull(),
    firstContributionAt: timestamp('first_contribution_at'),
    lastContributionAt: timestamp('last_contribution_at'),
    expertiseScore: real('expertise_score').default(0).notNull(), // Based on frequency, recency, depth
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    clusterIdx: index('topic_expertise_cluster_idx').on(table.clusterId),
    userIdx: index('topic_expertise_user_idx').on(table.userId),
    externalIdx: index('topic_expertise_external_idx').on(table.externalId),
    scoreIdx: index('topic_expertise_score_idx').on(table.expertiseScore),
  }),
);

// =============================================================================
// Type Exports
// =============================================================================

export type DecisionEvidenceRecord = typeof decisionEvidence.$inferSelect;
export type NewDecisionEvidenceRecord = typeof decisionEvidence.$inferInsert;

export type TopicCluster = typeof topicClusters.$inferSelect;
export type NewTopicCluster = typeof topicClusters.$inferInsert;

export type TopicClusterMember = typeof topicClusterMembers.$inferSelect;
export type NewTopicClusterMember = typeof topicClusterMembers.$inferInsert;

export type TopicExpertiseRecord = typeof topicExpertise.$inferSelect;
export type NewTopicExpertiseRecord = typeof topicExpertise.$inferInsert;

// =============================================================================
// Relations
// =============================================================================

export const decisionEvidenceRelations = relations(decisionEvidence, ({ one }) => ({
  organization: one(organizations, {
    fields: [decisionEvidence.organizationId],
    references: [organizations.id],
  }),
  decision: one(decisions, {
    fields: [decisionEvidence.decisionId],
    references: [decisions.id],
  }),
  contentItem: one(contentItems, {
    fields: [decisionEvidence.contentItemId],
    references: [contentItems.id],
  }),
}));

export const topicClustersRelations = relations(topicClusters, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [topicClusters.organizationId],
    references: [organizations.id],
  }),
  members: many(topicClusterMembers),
  expertise: many(topicExpertise),
}));

export const topicClusterMembersRelations = relations(topicClusterMembers, ({ one }) => ({
  cluster: one(topicClusters, {
    fields: [topicClusterMembers.clusterId],
    references: [topicClusters.id],
  }),
  contentItem: one(contentItems, {
    fields: [topicClusterMembers.contentItemId],
    references: [contentItems.id],
  }),
}));

export const topicExpertiseRelations = relations(topicExpertise, ({ one }) => ({
  cluster: one(topicClusters, {
    fields: [topicExpertise.clusterId],
    references: [topicClusters.id],
  }),
  user: one(users, {
    fields: [topicExpertise.userId],
    references: [users.id],
  }),
}));
