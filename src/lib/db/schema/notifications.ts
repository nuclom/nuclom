/**
 * Notifications Schema
 *
 * User notification tables:
 * - notifications: User notification records (comments, shares, system events)
 */

import { relations } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { notificationTypeEnum } from './enums';

// =============================================================================
// Notifications
// =============================================================================

export const notifications = pgTable(
  'notifications',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    resourceType: text('resource_type'), // 'video', 'comment', etc.
    resourceId: text('resource_id'),
    actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
    read: boolean('read').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('notifications_user_id_idx').on(table.userId),
    index('notifications_user_read_idx').on(table.userId, table.read),
    index('notifications_actor_id_idx').on(table.actorId),
  ],
);

// =============================================================================
// Type Exports
// =============================================================================

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

// =============================================================================
// Relations
// =============================================================================

export const notificationRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
    relationName: 'NotificationRecipient',
  }),
  actor: one(users, {
    fields: [notifications.actorId],
    references: [users.id],
    relationName: 'NotificationActor',
  }),
}));
