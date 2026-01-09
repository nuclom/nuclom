/**
 * Integrations Schema
 *
 * External integration tables including:
 * - integrations: OAuth connections to external services
 * - importedMeetings: Imported meeting recordings
 */

import { relations } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { organizations, users } from './auth';
import { importStatusEnum, integrationProviderEnum } from './enums';
import { videos } from './videos';

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

export type IntegrationMetadata =
  | ZoomIntegrationMetadata
  | GoogleIntegrationMetadata
  | SlackIntegrationMetadata
  | MicrosoftTeamsIntegrationMetadata;

export type MeetingParticipant = {
  readonly name: string;
  readonly email?: string;
  readonly joinTime?: string;
  readonly leaveTime?: string;
};

// =============================================================================
// Integration Connections
// =============================================================================

export const integrations = pgTable(
  'integrations',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    provider: integrationProviderEnum('provider').notNull(),
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token'),
    expiresAt: timestamp('expires_at'),
    scope: text('scope'),
    metadata: jsonb('metadata').$type<IntegrationMetadata>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    unique().on(table.userId, table.provider),
    index('integrations_user_id_idx').on(table.userId),
    index('integrations_organization_id_idx').on(table.organizationId),
  ],
);

// =============================================================================
// Imported Meetings
// =============================================================================

export const importedMeetings = pgTable(
  'imported_meetings',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    integrationId: text('integration_id')
      .notNull()
      .references(() => integrations.id, { onDelete: 'cascade' }),
    videoId: text('video_id').references(() => videos.id, { onDelete: 'set null' }),
    externalId: text('external_id').notNull(), // Meeting ID from provider
    meetingTitle: text('meeting_title'),
    meetingDate: timestamp('meeting_date'),
    duration: integer('duration'), // Duration in seconds
    participants: jsonb('participants').$type<MeetingParticipant[]>(),
    downloadUrl: text('download_url'),
    fileSize: integer('file_size'), // Size in bytes
    importStatus: importStatusEnum('import_status').default('pending').notNull(),
    importError: text('import_error'),
    importedAt: timestamp('imported_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    unique().on(table.integrationId, table.externalId),
    index('imported_meetings_integration_id_idx').on(table.integrationId),
    index('imported_meetings_video_id_idx').on(table.videoId),
    index('imported_meetings_import_status_idx').on(table.importStatus),
  ],
);

// =============================================================================
// Type Exports
// =============================================================================

export type Integration = typeof integrations.$inferSelect;
export type NewIntegration = typeof integrations.$inferInsert;
export type ImportedMeeting = typeof importedMeetings.$inferSelect;
export type NewImportedMeeting = typeof importedMeetings.$inferInsert;

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
