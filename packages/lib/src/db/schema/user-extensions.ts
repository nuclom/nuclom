/**
 * User Extensions Schema
 *
 * Application-specific user data that is decoupled from better-auth's users table.
 * This allows easier migrations when better-auth updates its schema.
 *
 * Includes:
 * - userPreferences: User notification and appearance preferences
 * - userExtensions: Legal consent, moderation, and account lifecycle data
 */

import { relations } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './auth';

// =============================================================================
// User Preferences
// =============================================================================

/**
 * User preferences for notifications, appearance, and privacy
 */
export const userPreferences = pgTable('user_preferences', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  // Notification preferences
  emailNotifications: boolean('email_notifications').default(true).notNull(),
  emailCommentReplies: boolean('email_comment_replies').default(true).notNull(),
  emailMentions: boolean('email_mentions').default(true).notNull(),
  emailVideoProcessing: boolean('email_video_processing').default(true).notNull(),
  emailWeeklyDigest: boolean('email_weekly_digest').default(false).notNull(),
  emailProductUpdates: boolean('email_product_updates').default(true).notNull(),
  // In-app notification preferences
  pushNotifications: boolean('push_notifications').default(true).notNull(),
  // Appearance preferences
  theme: text('theme').default('system').notNull(), // 'light', 'dark', 'system'
  // Privacy preferences
  showActivityStatus: boolean('show_activity_status').default(true).notNull(),
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// =============================================================================
// User Extensions (Application-specific user data)
// =============================================================================

/**
 * Application-specific user data decoupled from better-auth's users table.
 *
 * This table stores:
 * - Legal consent tracking (ToS, Privacy Policy)
 * - Marketing consent
 * - Account deletion workflow
 * - Moderation state (warnings, suspensions)
 *
 * By keeping this separate from the better-auth users table, we can:
 * 1. Apply better-auth migrations without conflicts
 * 2. Reduce coupling between auth and application logic
 * 3. Easier to manage application-specific lifecycle
 */
export const userExtensions = pgTable(
  'user_extensions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' })
      .unique(),
    // Legal consent fields
    tosAcceptedAt: timestamp('tos_accepted_at'),
    tosVersion: text('tos_version'),
    privacyAcceptedAt: timestamp('privacy_accepted_at'),
    privacyVersion: text('privacy_version'),
    // Marketing consent
    marketingConsentAt: timestamp('marketing_consent_at'),
    marketingConsent: boolean('marketing_consent').default(false),
    // Account deletion workflow
    deletionRequestedAt: timestamp('deletion_requested_at'),
    deletionScheduledFor: timestamp('deletion_scheduled_for'),
    // Moderation fields
    warnedAt: timestamp('warned_at'),
    warningReason: text('warning_reason'),
    suspendedUntil: timestamp('suspended_until'),
    suspensionReason: text('suspension_reason'),
    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('user_extensions_user_id_idx').on(table.userId)],
);

// =============================================================================
// Type Exports
// =============================================================================

export type UserPreferences = typeof userPreferences.$inferSelect;
export type NewUserPreferences = typeof userPreferences.$inferInsert;
export type UserExtension = typeof userExtensions.$inferSelect;
export type NewUserExtension = typeof userExtensions.$inferInsert;

// =============================================================================
// Relations
// =============================================================================

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userPreferences.userId],
    references: [users.id],
  }),
}));

export const userExtensionsRelations = relations(userExtensions, ({ one }) => ({
  user: one(users, {
    fields: [userExtensions.userId],
    references: [users.id],
  }),
}));
