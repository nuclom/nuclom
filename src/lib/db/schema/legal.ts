/**
 * Legal & Compliance Schema
 *
 * Tables for legal compliance:
 * - legalConsents: User consent to legal documents
 * - consentAuditLog: Audit trail for consent changes
 * - reports: Abuse reports
 * - dataExportRequests: GDPR data export requests
 */

import { relations } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { users } from './auth';
import {
  consentActionEnum,
  legalDocumentTypeEnum,
  reportCategoryEnum,
  reportResolutionEnum,
  reportResourceTypeEnum,
  reportStatusEnum,
} from './enums';

// =============================================================================
// Legal Consents
// =============================================================================

export const legalConsents = pgTable(
  'legal_consents',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    documentType: legalDocumentTypeEnum('document_type').notNull(),
    version: text('version').notNull(), // e.g., "2025-01-01"
    acceptedAt: timestamp('accepted_at').defaultNow().notNull(),
    ipAddress: text('ip_address'),
  },
  (table) => [
    index('legal_consents_user_doc_idx').on(table.userId, table.documentType),
    unique().on(table.userId, table.documentType, table.version),
  ],
);

// =============================================================================
// Consent Audit Log
// =============================================================================

export const consentAuditLog = pgTable(
  'consent_audit_log',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    action: consentActionEnum('action').notNull(),
    details: jsonb('details').$type<{
      documentType?: string;
      version?: string;
      previousValue?: boolean;
      newValue?: boolean;
      consentType?: string;
    }>(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('consent_audit_log_user_idx').on(table.userId, table.createdAt)],
);

// =============================================================================
// Reports
// =============================================================================

export const reports = pgTable(
  'reports',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    reporterId: text('reporter_id').references(() => users.id, { onDelete: 'set null' }),
    resourceType: reportResourceTypeEnum('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    category: reportCategoryEnum('category').notNull(),
    description: text('description'),
    status: reportStatusEnum('status').default('pending').notNull(),
    resolution: reportResolutionEnum('resolution'),
    resolvedById: text('resolved_by_id').references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: timestamp('resolved_at'),
    resolutionNotes: text('resolution_notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('reports_status_idx').on(table.status, table.createdAt),
    index('reports_resource_idx').on(table.resourceType, table.resourceId),
    index('reports_reporter_idx').on(table.reporterId),
  ],
);

// =============================================================================
// Data Export Requests
// =============================================================================

export const dataExportRequests = pgTable(
  'data_export_requests',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').default('pending').notNull(), // pending, processing, completed, failed
    downloadUrl: text('download_url'),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
  },
  (table) => [index('data_export_requests_user_idx').on(table.userId, table.createdAt)],
);

// =============================================================================
// Type Exports
// =============================================================================

export type LegalConsent = typeof legalConsents.$inferSelect;
export type NewLegalConsent = typeof legalConsents.$inferInsert;
export type ConsentAuditLogEntry = typeof consentAuditLog.$inferSelect;
export type NewConsentAuditLogEntry = typeof consentAuditLog.$inferInsert;
export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
export type DataExportRequest = typeof dataExportRequests.$inferSelect;
export type NewDataExportRequest = typeof dataExportRequests.$inferInsert;

// =============================================================================
// Relations
// =============================================================================

export const legalConsentsRelations = relations(legalConsents, ({ one }) => ({
  user: one(users, {
    fields: [legalConsents.userId],
    references: [users.id],
  }),
}));

export const consentAuditLogRelations = relations(consentAuditLog, ({ one }) => ({
  user: one(users, {
    fields: [consentAuditLog.userId],
    references: [users.id],
  }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  reporter: one(users, {
    fields: [reports.reporterId],
    references: [users.id],
    relationName: 'ReportReporter',
  }),
  resolvedBy: one(users, {
    fields: [reports.resolvedById],
    references: [users.id],
    relationName: 'ReportResolver',
  }),
}));

export const dataExportRequestsRelations = relations(dataExportRequests, ({ one }) => ({
  user: one(users, {
    fields: [dataExportRequests.userId],
    references: [users.id],
  }),
}));
