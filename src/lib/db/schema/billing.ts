/**
 * Billing Schema
 *
 * Application billing tables (extends better-auth Stripe plugin):
 * - plans: Subscription plan definitions
 * - usage: Organization usage tracking
 * - invoices: Invoice records
 * - paymentMethods: Stored payment methods
 * - processedWebhookEvents: Webhook idempotency
 */

import { relations } from 'drizzle-orm';
import { bigint, boolean, index, integer, jsonb, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { organizations } from './auth';
import { invoiceStatusEnum } from './enums';

// =============================================================================
// JSONB Types
// =============================================================================

export type PlanLimits = {
  readonly storage: number; // bytes, -1 for unlimited
  readonly videos: number; // count, -1 for unlimited
  readonly members: number; // count, -1 for unlimited
  readonly bandwidth: number; // bytes per month, -1 for unlimited
};

export type PlanFeatures = {
  readonly aiInsights: boolean;
  readonly customBranding: boolean;
  readonly sso: boolean;
  readonly prioritySupport: boolean;
  readonly apiAccess: boolean;
};

// =============================================================================
// Plans
// =============================================================================

export const plans = pgTable('plans', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  stripePriceIdMonthly: text('stripe_price_id_monthly'),
  stripePriceIdYearly: text('stripe_price_id_yearly'),
  priceMonthly: integer('price_monthly').notNull().default(0), // cents
  priceYearly: integer('price_yearly'), // cents
  limits: jsonb('limits').$type<PlanLimits>().notNull(),
  features: jsonb('features').$type<PlanFeatures>().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// =============================================================================
// Usage Tracking
// =============================================================================

export const usage = pgTable(
  'usage',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    periodStart: timestamp('period_start').notNull(),
    periodEnd: timestamp('period_end').notNull(),
    storageUsed: bigint('storage_used', { mode: 'number' }).default(0).notNull(), // bytes
    videosUploaded: integer('videos_uploaded').default(0).notNull(),
    bandwidthUsed: bigint('bandwidth_used', { mode: 'number' }).default(0).notNull(), // bytes
    aiRequests: integer('ai_requests').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    unique().on(table.organizationId, table.periodStart),
    index('usage_organization_id_idx').on(table.organizationId),
  ],
);

// =============================================================================
// Invoices
// =============================================================================

export const invoices = pgTable(
  'invoices',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    stripeInvoiceId: text('stripe_invoice_id').unique(),
    stripePaymentIntentId: text('stripe_payment_intent_id'),
    amount: integer('amount').notNull(), // cents
    amountPaid: integer('amount_paid').default(0).notNull(), // cents
    currency: text('currency').default('usd').notNull(),
    status: invoiceStatusEnum('status').notNull(),
    pdfUrl: text('pdf_url'),
    hostedInvoiceUrl: text('hosted_invoice_url'),
    periodStart: timestamp('period_start'),
    periodEnd: timestamp('period_end'),
    dueDate: timestamp('due_date'),
    paidAt: timestamp('paid_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('invoices_organization_id_idx').on(table.organizationId),
    index('invoices_status_idx').on(table.status),
  ],
);

// =============================================================================
// Payment Methods
// =============================================================================

export const paymentMethods = pgTable(
  'payment_methods',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    stripePaymentMethodId: text('stripe_payment_method_id').notNull().unique(),
    type: text('type').notNull(), // 'card', 'bank_account', etc.
    brand: text('brand'), // 'visa', 'mastercard', etc.
    last4: text('last4'),
    expMonth: integer('exp_month'),
    expYear: integer('exp_year'),
    isDefault: boolean('is_default').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('payment_methods_organization_id_idx').on(table.organizationId)],
);

// =============================================================================
// Webhook Idempotency
// =============================================================================

export const processedWebhookEvents = pgTable(
  'processed_webhook_events',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    eventId: text('event_id').notNull().unique(), // Stripe event ID (evt_xxx)
    eventType: text('event_type').notNull(), // e.g., 'invoice.paid'
    source: text('source').notNull().default('stripe'), // 'stripe', 'github', etc.
    processedAt: timestamp('processed_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at')
      .notNull()
      .$defaultFn(() => {
        const date = new Date();
        date.setDate(date.getDate() + 30);
        return date;
      }),
  },
  (table) => ({
    eventIdIdx: index('processed_webhook_events_event_id_idx').on(table.eventId),
    expiresAtIdx: index('processed_webhook_events_expires_at_idx').on(table.expiresAt),
    sourceTypeIdx: index('processed_webhook_events_source_type_idx').on(table.source, table.eventType),
  }),
);

// =============================================================================
// Type Exports
// =============================================================================

export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;
export type Usage = typeof usage.$inferSelect;
export type NewUsage = typeof usage.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type NewPaymentMethod = typeof paymentMethods.$inferInsert;
export type ProcessedWebhookEvent = typeof processedWebhookEvents.$inferSelect;
export type NewProcessedWebhookEvent = typeof processedWebhookEvents.$inferInsert;

// =============================================================================
// Relations
// =============================================================================

export const usageRelations = relations(usage, ({ one }) => ({
  organization: one(organizations, {
    fields: [usage.organizationId],
    references: [organizations.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  organization: one(organizations, {
    fields: [invoices.organizationId],
    references: [organizations.id],
  }),
}));

export const paymentMethodsRelations = relations(paymentMethods, ({ one }) => ({
  organization: one(organizations, {
    fields: [paymentMethods.organizationId],
    references: [organizations.id],
  }),
}));
