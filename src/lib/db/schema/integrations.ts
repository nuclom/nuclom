/**
 * Integrations Schema
 *
 * External integration tables including:
 * - integrations: OAuth connections to external services
 * - importedMeetings: Imported meeting recordings
 * - githubConnections: GitHub repository connections
 * - codeLinks: Links between videos and code artifacts
 */

import { relations } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { organizations, users } from "./auth";
import { codeLinkTypeEnum, importStatusEnum, integrationProviderEnum } from "./enums";
import { videos } from "./videos";

// =============================================================================
// JSONB Types
// =============================================================================

export type ZoomIntegrationMetadata = {
  readonly accountId?: string;
  readonly email?: string;
};

export type GoogleIntegrationMetadata = {
  readonly email?: string;
  readonly scope?: string;
};

export type SlackIntegrationMetadata = {
  readonly teamId?: string;
  readonly teamName?: string;
  readonly userId?: string;
  readonly email?: string;
  readonly botUserId?: string;
  readonly webhookUrl?: string;
};

export type MicrosoftTeamsIntegrationMetadata = {
  readonly tenantId?: string;
  readonly userId?: string;
  readonly email?: string;
  readonly displayName?: string;
};

export type GitHubIntegrationMetadata = {
  readonly login?: string;
  readonly email?: string;
  readonly avatarUrl?: string;
  readonly repositories?: Array<{
    readonly id: number;
    readonly fullName: string;
    readonly private: boolean;
  }>;
  readonly installationId?: string;
};

export type IntegrationMetadata =
  | ZoomIntegrationMetadata
  | GoogleIntegrationMetadata
  | SlackIntegrationMetadata
  | MicrosoftTeamsIntegrationMetadata
  | GitHubIntegrationMetadata;

export type MeetingParticipant = {
  readonly name: string;
  readonly email?: string;
  readonly joinTime?: string;
  readonly leaveTime?: string;
};

export type DetectedCodeRef = {
  readonly type: "pr" | "issue" | "commit" | "file" | "module";
  readonly reference: string;
  readonly timestamp: number;
  readonly confidence: number;
  readonly suggestedRepo?: string;
};

// =============================================================================
// Integration Connections
// =============================================================================

export const integrations = pgTable(
  "integrations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: integrationProviderEnum("provider").notNull(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    expiresAt: timestamp("expires_at"),
    scope: text("scope"),
    metadata: jsonb("metadata").$type<IntegrationMetadata>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique().on(table.userId, table.provider),
    index("integrations_user_id_idx").on(table.userId),
    index("integrations_organization_id_idx").on(table.organizationId),
  ],
);

// =============================================================================
// Imported Meetings
// =============================================================================

export const importedMeetings = pgTable(
  "imported_meetings",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    integrationId: text("integration_id")
      .notNull()
      .references(() => integrations.id, { onDelete: "cascade" }),
    videoId: text("video_id").references(() => videos.id, { onDelete: "set null" }),
    externalId: text("external_id").notNull(), // Meeting ID from provider
    meetingTitle: text("meeting_title"),
    meetingDate: timestamp("meeting_date"),
    duration: integer("duration"), // Duration in seconds
    participants: jsonb("participants").$type<MeetingParticipant[]>(),
    downloadUrl: text("download_url"),
    fileSize: integer("file_size"), // Size in bytes
    importStatus: importStatusEnum("import_status").default("pending").notNull(),
    importError: text("import_error"),
    importedAt: timestamp("imported_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique().on(table.integrationId, table.externalId),
    index("imported_meetings_integration_id_idx").on(table.integrationId),
    index("imported_meetings_video_id_idx").on(table.videoId),
    index("imported_meetings_import_status_idx").on(table.importStatus),
  ],
);

// =============================================================================
// GitHub Connections
// =============================================================================

export const githubConnections = pgTable(
  "github_connections",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    integrationId: text("integration_id")
      .notNull()
      .references(() => integrations.id, { onDelete: "cascade" }),
    installationId: text("installation_id"), // GitHub App installation ID
    repositories:
      jsonb("repositories").$type<
        Array<{
          id: number;
          fullName: string;
          private: boolean;
          defaultBranch: string;
        }>
      >(),
    connectedAt: timestamp("connected_at").defaultNow().notNull(),
    lastSync: timestamp("last_sync"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("github_connections_org_idx").on(table.organizationId),
    integrationIdx: index("github_connections_integration_idx").on(table.integrationId),
  }),
);

// =============================================================================
// Code Links
// =============================================================================

export const codeLinks = pgTable(
  "code_links",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    linkType: codeLinkTypeEnum("link_type").notNull(),
    githubRepo: text("github_repo").notNull(), // owner/repo format
    githubRef: text("github_ref").notNull(), // PR number, commit SHA, or file path
    githubUrl: text("github_url"),
    context: text("context"), // why this was linked
    autoDetected: boolean("auto_detected").default(false).notNull(),
    timestampStart: integer("timestamp_start"), // video timestamp in seconds
    timestampEnd: integer("timestamp_end"), // optional end timestamp
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    videoIdx: index("code_links_video_idx").on(table.videoId),
    repoIdx: index("code_links_repo_idx").on(table.githubRepo),
    refIdx: index("code_links_ref_idx").on(table.githubRepo, table.linkType, table.githubRef),
    typeIdx: index("code_links_type_idx").on(table.linkType),
  }),
);

// =============================================================================
// Type Exports
// =============================================================================

export type Integration = typeof integrations.$inferSelect;
export type NewIntegration = typeof integrations.$inferInsert;
export type ImportedMeeting = typeof importedMeetings.$inferSelect;
export type NewImportedMeeting = typeof importedMeetings.$inferInsert;
export type GitHubConnection = typeof githubConnections.$inferSelect;
export type NewGitHubConnection = typeof githubConnections.$inferInsert;
export type CodeLink = typeof codeLinks.$inferSelect;
export type NewCodeLink = typeof codeLinks.$inferInsert;

// =============================================================================
// Relations
// =============================================================================

export const integrationRelations = relations(integrations, ({ one, many }) => ({
  user: one(users, {
    fields: [integrations.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [integrations.organizationId],
    references: [organizations.id],
  }),
  importedMeetings: many(importedMeetings),
}));

export const importedMeetingRelations = relations(importedMeetings, ({ one }) => ({
  integration: one(integrations, {
    fields: [importedMeetings.integrationId],
    references: [integrations.id],
  }),
  video: one(videos, {
    fields: [importedMeetings.videoId],
    references: [videos.id],
  }),
}));

export const githubConnectionRelations = relations(githubConnections, ({ one }) => ({
  organization: one(organizations, {
    fields: [githubConnections.organizationId],
    references: [organizations.id],
  }),
  integration: one(integrations, {
    fields: [githubConnections.integrationId],
    references: [integrations.id],
  }),
}));

export const codeLinkRelations = relations(codeLinks, ({ one }) => ({
  video: one(videos, {
    fields: [codeLinks.videoId],
    references: [videos.id],
  }),
  createdBy: one(users, {
    fields: [codeLinks.createdById],
    references: [users.id],
  }),
}));
