/**
 * Activity Schema
 *
 * Activity feed and webhook tables:
 * - activityFeed: Organization activity feed
 * - zapierWebhooks: Zapier webhook registrations
 * - zapierWebhookDeliveries: Webhook delivery logs
 * - healthChecks: System health check records
 */

import { relations } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { organizations, users } from "./auth";
import { activityTypeEnum, healthCheckServiceEnum, healthCheckStatusEnum } from "./enums";

// =============================================================================
// Activity Feed
// =============================================================================

export const activityFeed = pgTable(
  "activity_feed",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    activityType: activityTypeEnum("activity_type").notNull(),
    resourceType: text("resource_type"), // 'video', 'comment', 'member', 'integration'
    resourceId: text("resource_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("activity_feed_org_created_idx").on(table.organizationId, table.createdAt),
    index("activity_feed_actor_idx").on(table.actorId),
    index("activity_feed_resource_idx").on(table.resourceType, table.resourceId),
  ],
);

// =============================================================================
// Zapier Webhooks
// =============================================================================

export const zapierWebhooks = pgTable(
  "zapier_webhooks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetUrl: text("target_url").notNull(),
    events: jsonb("events").$type<string[]>().notNull(), // Array of ZapierWebhookEvent
    secret: text("secret").notNull(), // For HMAC signature verification
    isActive: boolean("is_active").default(true).notNull(),
    lastTriggeredAt: timestamp("last_triggered_at"),
    failureCount: integer("failure_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("zapier_webhooks_org_idx").on(table.organizationId),
    index("zapier_webhooks_active_idx").on(table.isActive),
  ],
);

// =============================================================================
// Zapier Webhook Deliveries
// =============================================================================

export const zapierWebhookDeliveries = pgTable(
  "zapier_webhook_deliveries",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    webhookId: text("webhook_id")
      .notNull()
      .references(() => zapierWebhooks.id, { onDelete: "cascade" }),
    event: text("event").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    responseStatus: integer("response_status"),
    responseBody: text("response_body"),
    success: boolean("success").notNull(),
    attemptCount: integer("attempt_count").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    deliveredAt: timestamp("delivered_at"),
  },
  (table) => [
    index("zapier_webhook_deliveries_webhook_idx").on(table.webhookId),
    index("zapier_webhook_deliveries_created_idx").on(table.createdAt),
  ],
);

// =============================================================================
// Health Checks
// =============================================================================

export const healthChecks = pgTable(
  "health_checks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    service: healthCheckServiceEnum("service").notNull(),
    status: healthCheckStatusEnum("status").notNull(),
    latencyMs: integer("latency_ms").notNull(),
    error: text("error"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    checkedAt: timestamp("checked_at").defaultNow().notNull(),
  },
  (table) => [
    index("health_checks_service_checked_at_idx").on(table.service, table.checkedAt),
    index("health_checks_status_idx").on(table.status),
  ],
);

// =============================================================================
// Type Exports
// =============================================================================

export type ActivityFeed = typeof activityFeed.$inferSelect;
export type NewActivityFeed = typeof activityFeed.$inferInsert;
export type ZapierWebhook = typeof zapierWebhooks.$inferSelect;
export type NewZapierWebhook = typeof zapierWebhooks.$inferInsert;
export type ZapierWebhookDelivery = typeof zapierWebhookDeliveries.$inferSelect;
export type NewZapierWebhookDelivery = typeof zapierWebhookDeliveries.$inferInsert;
export type HealthCheck = typeof healthChecks.$inferSelect;
export type NewHealthCheck = typeof healthChecks.$inferInsert;

// =============================================================================
// Relations
// =============================================================================

export const activityFeedRelations = relations(activityFeed, ({ one }) => ({
  organization: one(organizations, {
    fields: [activityFeed.organizationId],
    references: [organizations.id],
  }),
  actor: one(users, {
    fields: [activityFeed.actorId],
    references: [users.id],
  }),
}));

export const zapierWebhooksRelations = relations(zapierWebhooks, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [zapierWebhooks.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [zapierWebhooks.userId],
    references: [users.id],
  }),
  deliveries: many(zapierWebhookDeliveries),
}));

export const zapierWebhookDeliveriesRelations = relations(zapierWebhookDeliveries, ({ one }) => ({
  webhook: one(zapierWebhooks, {
    fields: [zapierWebhookDeliveries.webhookId],
    references: [zapierWebhooks.id],
  }),
}));
