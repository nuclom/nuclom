/**
 * Workflow Templates Schema
 *
 * Tables for video processing workflows:
 * - workflowTemplates: Reusable workflow configurations
 * - videoWorkflowHistory: History of workflows applied to videos
 */

import { relations } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { organizations, users } from "./auth";
import { workflowTemplateTypeEnum } from "./enums";
import { videos } from "./videos";

// =============================================================================
// JSONB Types
// =============================================================================

export type WorkflowTemplateConfig = {
  autoTranscribe?: boolean;
  generateSummary?: boolean;
  extractChapters?: boolean;
  extractActionItems?: boolean;
  detectCodeSnippets?: boolean;
  subtitleLanguages?: string[];
  defaultChannel?: string;
  autoShareSettings?: {
    enabled?: boolean;
    accessLevel?: "view" | "comment" | "download";
    expiresInDays?: number;
  };
  notifyOnComplete?: boolean;
  customPrompts?: {
    summaryPrompt?: string;
    actionItemsPrompt?: string;
  };
};

// =============================================================================
// Workflow Templates
// =============================================================================

export const workflowTemplates = pgTable("workflow_templates", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  type: workflowTemplateTypeEnum("type").default("custom").notNull(),
  icon: text("icon"), // Lucide icon name
  // Template configuration
  config: jsonb("config").$type<WorkflowTemplateConfig>().notNull(),
  // Ownership - null means system template
  organizationId: text("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
  isSystem: boolean("is_system").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  usageCount: integer("usage_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// =============================================================================
// Video Workflow History
// =============================================================================

export const videoWorkflowHistory = pgTable(
  "video_workflow_history",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    templateId: text("template_id").references(() => workflowTemplates.id, { onDelete: "set null" }),
    templateName: text("template_name").notNull(), // Denormalized for history
    appliedConfig: jsonb("applied_config").notNull(),
    appliedAt: timestamp("applied_at").defaultNow().notNull(),
    appliedById: text("applied_by_id").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [
    index("video_workflow_history_video_idx").on(table.videoId),
    index("video_workflow_history_template_idx").on(table.templateId),
  ],
);

// =============================================================================
// Type Exports
// =============================================================================

export type WorkflowTemplate = typeof workflowTemplates.$inferSelect;
export type NewWorkflowTemplate = typeof workflowTemplates.$inferInsert;
export type VideoWorkflowHistory = typeof videoWorkflowHistory.$inferSelect;
export type NewVideoWorkflowHistory = typeof videoWorkflowHistory.$inferInsert;

// =============================================================================
// Relations
// =============================================================================

export const workflowTemplatesRelations = relations(workflowTemplates, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [workflowTemplates.organizationId],
    references: [organizations.id],
  }),
  createdBy: one(users, {
    fields: [workflowTemplates.createdById],
    references: [users.id],
  }),
  history: many(videoWorkflowHistory),
}));

export const videoWorkflowHistoryRelations = relations(videoWorkflowHistory, ({ one }) => ({
  video: one(videos, {
    fields: [videoWorkflowHistory.videoId],
    references: [videos.id],
  }),
  template: one(workflowTemplates, {
    fields: [videoWorkflowHistory.templateId],
    references: [workflowTemplates.id],
  }),
  appliedBy: one(users, {
    fields: [videoWorkflowHistory.appliedById],
    references: [users.id],
  }),
}));
