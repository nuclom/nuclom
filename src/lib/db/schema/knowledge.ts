/**
 * Knowledge Graph Schema
 *
 * Tables for decision tracking and knowledge graph:
 * - decisions: AI-extracted decisions from videos
 * - decisionParticipants: Who participated in decisions
 * - knowledgeNodes: Entities in the knowledge graph
 * - knowledgeEdges: Relationships between entities
 * - decisionLinks: Links between decisions and external entities
 */

import { relations } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, unique, vector } from "drizzle-orm/pg-core";
import { organizations, users } from "./auth";
import { decisionStatusEnum, decisionTypeEnum, knowledgeNodeTypeEnum, participantRoleEnum } from "./enums";
import { videos } from "./videos";

// =============================================================================
// Decisions
// =============================================================================

export const decisions = pgTable(
  "decisions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    timestampStart: integer("timestamp_start"), // seconds into video
    timestampEnd: integer("timestamp_end"),
    summary: text("summary").notNull(), // "We decided to use PostgreSQL instead of MongoDB"
    context: text("context"), // surrounding discussion that led to decision
    reasoning: text("reasoning"), // why the decision was made
    status: decisionStatusEnum("status").default("decided").notNull(),
    decisionType: decisionTypeEnum("decision_type").default("other").notNull(),
    confidence: integer("confidence"), // AI confidence score 0-100
    tags: jsonb("tags").$type<string[]>().default([]),
    // Embedding for semantic search (pgvector)
    embeddingVector: vector("embedding_vector", { dimensions: 1536 }),
    metadata: jsonb("metadata").$type<{
      alternatives?: string[];
      relatedDecisionIds?: string[];
      externalRefs?: Array<{ type: string; id: string; url?: string }>;
    }>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("decisions_org_idx").on(table.organizationId, table.createdAt),
    videoIdx: index("decisions_video_idx").on(table.videoId),
    statusIdx: index("decisions_status_idx").on(table.status),
    typeIdx: index("decisions_type_idx").on(table.decisionType),
  }),
);

// =============================================================================
// Decision Participants
// =============================================================================

export const decisionParticipants = pgTable(
  "decision_participants",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    decisionId: text("decision_id")
      .notNull()
      .references(() => decisions.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    role: participantRoleEnum("role").default("participant").notNull(),
    speakerName: text("speaker_name"), // name from transcript if not linked to user
    attributedText: text("attributed_text"), // what they said
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    decisionIdx: index("decision_participants_decision_idx").on(table.decisionId),
    userIdx: index("decision_participants_user_idx").on(table.userId),
  }),
);

// =============================================================================
// Knowledge Nodes
// =============================================================================

export const knowledgeNodes = pgTable(
  "knowledge_nodes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    type: knowledgeNodeTypeEnum("type").notNull(),
    externalId: text("external_id"), // github:pr:123, linear:issue:ABC, etc.
    name: text("name").notNull(),
    description: text("description"),
    // Embedding for semantic search (pgvector)
    embeddingVector: vector("embedding_vector", { dimensions: 1536 }),
    metadata: jsonb("metadata").$type<{
      url?: string;
      attributes?: Record<string, unknown>;
    }>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("knowledge_nodes_org_idx").on(table.organizationId),
    typeIdx: index("knowledge_nodes_type_idx").on(table.type),
    externalIdx: index("knowledge_nodes_external_idx").on(table.externalId),
    uniqueOrgExternal: unique("knowledge_nodes_org_external_unique").on(table.organizationId, table.externalId),
  }),
);

// =============================================================================
// Knowledge Edges
// =============================================================================

export const knowledgeEdges = pgTable(
  "knowledge_edges",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sourceNodeId: text("source_node_id")
      .notNull()
      .references(() => knowledgeNodes.id, { onDelete: "cascade" }),
    targetNodeId: text("target_node_id")
      .notNull()
      .references(() => knowledgeNodes.id, { onDelete: "cascade" }),
    relationship: text("relationship").notNull(), // decided, mentioned, references, supersedes, related_to
    weight: integer("weight").default(100), // 0-100 for relationship strength
    metadata: jsonb("metadata").$type<{
      videoId?: string;
      timestamp?: number;
      context?: string;
    }>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    sourceIdx: index("knowledge_edges_source_idx").on(table.sourceNodeId),
    targetIdx: index("knowledge_edges_target_idx").on(table.targetNodeId),
    relationshipIdx: index("knowledge_edges_relationship_idx").on(table.relationship),
    uniqueEdge: unique("knowledge_edges_unique").on(table.sourceNodeId, table.targetNodeId, table.relationship),
  }),
);

// =============================================================================
// Decision Links
// =============================================================================

export const decisionLinks = pgTable(
  "decision_links",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    decisionId: text("decision_id")
      .notNull()
      .references(() => decisions.id, { onDelete: "cascade" }),
    // Polymorphic reference - can link to various entity types
    entityType: text("entity_type").notNull(), // video, document, code, issue
    entityId: text("entity_id").notNull(), // ID of the entity
    entityRef: text("entity_ref"), // human-readable ref like "PR #123"
    linkType: text("link_type").notNull(), // implements, references, supersedes, relates_to
    url: text("url"), // external URL if applicable
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    decisionIdx: index("decision_links_decision_idx").on(table.decisionId),
    entityIdx: index("decision_links_entity_idx").on(table.entityType, table.entityId),
    uniqueLink: unique("decision_links_unique").on(table.decisionId, table.entityType, table.entityId, table.linkType),
  }),
);

// =============================================================================
// Type Exports
// =============================================================================

export type Decision = typeof decisions.$inferSelect;
export type NewDecision = typeof decisions.$inferInsert;
export type DecisionParticipant = typeof decisionParticipants.$inferSelect;
export type NewDecisionParticipant = typeof decisionParticipants.$inferInsert;
export type KnowledgeNode = typeof knowledgeNodes.$inferSelect;
export type NewKnowledgeNode = typeof knowledgeNodes.$inferInsert;
export type KnowledgeEdge = typeof knowledgeEdges.$inferSelect;
export type NewKnowledgeEdge = typeof knowledgeEdges.$inferInsert;
export type DecisionLink = typeof decisionLinks.$inferSelect;
export type NewDecisionLink = typeof decisionLinks.$inferInsert;

// =============================================================================
// Relations
// =============================================================================

export const decisionsRelations = relations(decisions, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [decisions.organizationId],
    references: [organizations.id],
  }),
  video: one(videos, {
    fields: [decisions.videoId],
    references: [videos.id],
  }),
  participants: many(decisionParticipants),
  links: many(decisionLinks),
}));

export const decisionParticipantsRelations = relations(decisionParticipants, ({ one }) => ({
  decision: one(decisions, {
    fields: [decisionParticipants.decisionId],
    references: [decisions.id],
  }),
  user: one(users, {
    fields: [decisionParticipants.userId],
    references: [users.id],
  }),
}));

export const knowledgeNodesRelations = relations(knowledgeNodes, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [knowledgeNodes.organizationId],
    references: [organizations.id],
  }),
  outgoingEdges: many(knowledgeEdges, { relationName: "SourceNode" }),
  incomingEdges: many(knowledgeEdges, { relationName: "TargetNode" }),
}));

export const knowledgeEdgesRelations = relations(knowledgeEdges, ({ one }) => ({
  sourceNode: one(knowledgeNodes, {
    fields: [knowledgeEdges.sourceNodeId],
    references: [knowledgeNodes.id],
    relationName: "SourceNode",
  }),
  targetNode: one(knowledgeNodes, {
    fields: [knowledgeEdges.targetNodeId],
    references: [knowledgeNodes.id],
    relationName: "TargetNode",
  }),
}));

export const decisionLinksRelations = relations(decisionLinks, ({ one }) => ({
  decision: one(decisions, {
    fields: [decisionLinks.decisionId],
    references: [decisions.id],
  }),
}));
