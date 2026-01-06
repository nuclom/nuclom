/**
 * Audit Logs Schema
 *
 * Tables for audit logging:
 * - auditLogs: Comprehensive audit trail for security and compliance
 * - auditLogExports: Export requests for audit log data
 */

import { relations } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { organizations, users } from './auth';
import { auditLogCategoryEnum, auditLogSeverityEnum } from './enums';

// =============================================================================
// Audit Logs
// =============================================================================

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // Who performed the action
    actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
    actorEmail: text('actor_email'),
    actorType: text('actor_type').notNull().default('user'), // user, system, api_key, sso
    // Organization context
    organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
    // What happened
    category: auditLogCategoryEnum('category').notNull(),
    action: text('action').notNull(), // e.g., "user.login", "video.delete", "role.assign"
    description: text('description'),
    severity: auditLogSeverityEnum('severity').default('info').notNull(),
    // Target resource
    resourceType: text('resource_type'),
    resourceId: text('resource_id'),
    resourceName: text('resource_name'),
    // Changes (for update operations)
    previousValue: jsonb('previous_value').$type<Record<string, unknown>>(),
    newValue: jsonb('new_value').$type<Record<string, unknown>>(),
    // Request context
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    requestId: text('request_id'),
    sessionId: text('session_id'),
    // Additional metadata
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('audit_logs_actor_idx').on(table.actorId),
    index('audit_logs_org_idx').on(table.organizationId),
    index('audit_logs_category_idx').on(table.category),
    index('audit_logs_action_idx').on(table.action),
    index('audit_logs_resource_idx').on(table.resourceType, table.resourceId),
    index('audit_logs_created_at_idx').on(table.createdAt),
    // Composite index for common queries
    index('audit_logs_org_created_idx').on(table.organizationId, table.createdAt),
  ],
);

// =============================================================================
// Audit Log Exports
// =============================================================================

export const auditLogExports = pgTable(
  'audit_log_exports',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    requestedBy: text('requested_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    format: text('format').notNull().default('csv'), // csv, json, pdf
    status: text('status').notNull().default('pending'), // pending, processing, completed, failed
    filters: jsonb('filters').$type<{
      startDate?: string;
      endDate?: string;
      categories?: string[];
      actions?: string[];
      actorIds?: string[];
      severity?: string[];
    }>(),
    downloadUrl: text('download_url'),
    expiresAt: timestamp('expires_at'),
    errorMessage: text('error_message'),
    recordCount: integer('record_count'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
  },
  (table) => [
    index('audit_log_exports_org_idx').on(table.organizationId),
    index('audit_log_exports_status_idx').on(table.status),
  ],
);

// =============================================================================
// Type Exports
// =============================================================================

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type AuditLogExport = typeof auditLogExports.$inferSelect;
export type NewAuditLogExport = typeof auditLogExports.$inferInsert;

// =============================================================================
// Relations
// =============================================================================

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [auditLogs.actorId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [auditLogs.organizationId],
    references: [organizations.id],
  }),
}));

export const auditLogExportsRelations = relations(auditLogExports, ({ one }) => ({
  organization: one(organizations, {
    fields: [auditLogExports.organizationId],
    references: [organizations.id],
  }),
  requestedByUser: one(users, {
    fields: [auditLogExports.requestedBy],
    references: [users.id],
  }),
}));
