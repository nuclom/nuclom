import { relations } from "drizzle-orm";
import { bigint, boolean, integer, jsonb, pgEnum, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("UserRole", ["user", "admin"]);
export const organizationRoleEnum = pgEnum("OrganizationRole", ["owner", "member"]);
export const processingStatusEnum = pgEnum("ProcessingStatus", [
  "pending",
  "transcribing",
  "analyzing",
  "completed",
  "failed",
]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  role: userRoleEnum("role").default("user").notNull(),
  banned: boolean("banned"),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  activeOrganizationId: text("active_organization_id"),
  impersonatedBy: text("impersonated_by"),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").$defaultFn(() => /* @__PURE__ */ new Date()),
  updatedAt: timestamp("updated_at").$defaultFn(() => /* @__PURE__ */ new Date()),
});

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  logo: text("logo"),
  createdAt: timestamp("created_at").notNull(),
  metadata: text("metadata"),
});

export const members = pgTable("members", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: organizationRoleEnum("role").default("member").notNull(),
  createdAt: timestamp("created_at").notNull(),
});

export const invitations = pgTable("invitations", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: organizationRoleEnum("role").default("member").notNull(),
  status: text("status").default("pending").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  inviterId: text("inviter_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export const apikeys = pgTable("apikeys", {
  id: text("id").primaryKey(),
  name: text("name"),
  start: text("start"),
  prefix: text("prefix"),
  key: text("key").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  refillInterval: integer("refill_interval"),
  refillAmount: integer("refill_amount"),
  lastRefillAt: timestamp("last_refill_at"),
  enabled: boolean("enabled").default(true),
  rateLimitEnabled: boolean("rate_limit_enabled").default(true),
  rateLimitTimeWindow: integer("rate_limit_time_window").default(60000),
  rateLimitMax: integer("rate_limit_max").default(100),
  requestCount: integer("request_count"),
  remaining: integer("remaining"),
  lastRequest: timestamp("last_request"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  permissions: text("permissions"),
  metadata: text("metadata"),
});

export const oauthApplications = pgTable("oauth_applications", {
  id: text("id").primaryKey(),
  name: text("name"),
  icon: text("icon"),
  metadata: text("metadata"),
  clientId: text("client_id").unique(),
  clientSecret: text("client_secret"),
  redirectURLs: text("redirect_u_r_ls"),
  type: text("type"),
  disabled: boolean("disabled"),
  userId: text("user_id"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const oauthAccessTokens = pgTable("oauth_access_tokens", {
  id: text("id").primaryKey(),
  accessToken: text("access_token").unique(),
  refreshToken: text("refresh_token").unique(),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  clientId: text("client_id"),
  userId: text("user_id"),
  scopes: text("scopes"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const oauthConsents = pgTable("oauth_consents", {
  id: text("id").primaryKey(),
  clientId: text("client_id"),
  userId: text("user_id"),
  scopes: text("scopes"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
  consentGiven: boolean("consent_given"),
});

export const channels = pgTable("channels", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  memberCount: integer("member_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const collections = pgTable("collections", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  thumbnailUrl: text("thumbnail_url"),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  isPublic: boolean("is_public").default(false).notNull(),
  createdById: text("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Junction table for videos in series with ordering
export const seriesVideos = pgTable(
  "series_videos",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    seriesId: text("series_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueSeriesVideo: unique().on(table.seriesId, table.videoId),
  }),
);

// Track user progress through series
export const seriesProgress = pgTable(
  "series_progress",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    seriesId: text("series_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    lastVideoId: text("last_video_id").references(() => videos.id),
    lastPosition: integer("last_position").default(0).notNull(),
    completedVideoIds: jsonb("completed_video_ids").$type<string[]>().default([]).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueUserSeries: unique().on(table.userId, table.seriesId),
  }),
);

// Types for JSONB columns
export type TranscriptSegment = {
  readonly startTime: number; // seconds
  readonly endTime: number; // seconds
  readonly text: string;
  readonly confidence?: number;
};

export type ActionItem = {
  readonly text: string;
  readonly timestamp?: number; // seconds in video
  readonly priority?: "high" | "medium" | "low";
};

export const videos = pgTable("videos", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  description: text("description"),
  duration: text("duration").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  videoUrl: text("video_url"),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  channelId: text("channel_id").references(() => channels.id),
  collectionId: text("collection_id").references(() => collections.id),
  // Transcription fields
  transcript: text("transcript"),
  transcriptSegments: jsonb("transcript_segments").$type<TranscriptSegment[]>(),
  // AI Analysis fields
  processingStatus: processingStatusEnum("processing_status").default("pending").notNull(),
  processingError: text("processing_error"),
  aiSummary: text("ai_summary"),
  aiTags: jsonb("ai_tags").$type<string[]>(),
  aiActionItems: jsonb("ai_action_items").$type<ActionItem[]>(),
  // Soft-delete fields
  deletedAt: timestamp("deleted_at"),
  retentionUntil: timestamp("retention_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const comments = pgTable("comments", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  content: text("content").notNull(),
  timestamp: text("timestamp"),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  videoId: text("video_id")
    .notNull()
    .references(() => videos.id, { onDelete: "cascade" }),
  parentId: text("parent_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const videoProgresses = pgTable(
  "video_progresses",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    currentTime: text("current_time").notNull(),
    completed: boolean("completed").default(false).notNull(),
    lastWatchedAt: timestamp("last_watched_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueUserVideo: unique().on(table.userId, table.videoId),
  }),
);

export const videoChapters = pgTable("video_chapters", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  videoId: text("video_id")
    .notNull()
    .references(() => videos.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  summary: text("summary"),
  startTime: integer("start_time").notNull(), // seconds
  endTime: integer("end_time"), // seconds
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const videoCodeSnippets = pgTable("video_code_snippets", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  videoId: text("video_id")
    .notNull()
    .references(() => videos.id, { onDelete: "cascade" }),
  language: text("language"),
  code: text("code").notNull(),
  title: text("title"),
  description: text("description"),
  timestamp: integer("timestamp"), // seconds in video
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Notification types enum
export const notificationTypeEnum = pgEnum("NotificationType", [
  "comment_reply",
  "comment_mention",
  "new_comment_on_video",
  "video_shared",
  "video_processing_complete",
  "video_processing_failed",
  "invitation_received",
  "trial_ending",
  "subscription_created",
  "subscription_updated",
  "subscription_canceled",
  "payment_failed",
  "payment_succeeded",
]);

// Integration provider enum
export const integrationProviderEnum = pgEnum("IntegrationProvider", ["zoom", "google_meet"]);

// Import status enum
export const importStatusEnum = pgEnum("ImportStatus", ["pending", "downloading", "processing", "completed", "failed"]);

// Billing enums
export const subscriptionStatusEnum = pgEnum("SubscriptionStatus", [
  "active",
  "canceled",
  "past_due",
  "trialing",
  "incomplete",
  "incomplete_expired",
  "unpaid",
]);

export const invoiceStatusEnum = pgEnum("InvoiceStatus", ["draft", "open", "paid", "void", "uncollectible"]);

export const notifications = pgTable("notifications", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  resourceType: text("resource_type"), // 'video', 'comment', etc.
  resourceId: text("resource_id"),
  actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Types for integration metadata
export type ZoomIntegrationMetadata = {
  readonly accountId?: string;
  readonly email?: string;
};

export type GoogleIntegrationMetadata = {
  readonly email?: string;
  readonly scope?: string;
};

export type IntegrationMetadata = ZoomIntegrationMetadata | GoogleIntegrationMetadata;

// Types for meeting participants
export type MeetingParticipant = {
  readonly name: string;
  readonly email?: string;
  readonly joinTime?: string;
  readonly leaveTime?: string;
};

// Integration connections table
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
  (table) => ({
    uniqueUserProvider: unique().on(table.userId, table.provider),
  }),
);

// Imported meetings table
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
  (table) => ({
    uniqueIntegrationExternalId: unique().on(table.integrationId, table.externalId),
  }),
);

// =====================
// Billing Tables
// =====================

// Types for JSONB columns in billing
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

export const plans = pgTable("plans", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  stripePriceIdMonthly: text("stripe_price_id_monthly"),
  stripePriceIdYearly: text("stripe_price_id_yearly"),
  priceMonthly: integer("price_monthly").notNull().default(0), // cents
  priceYearly: integer("price_yearly"), // cents
  limits: jsonb("limits").$type<PlanLimits>().notNull(),
  features: jsonb("features").$type<PlanFeatures>().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const subscriptions = pgTable("subscriptions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" })
    .unique(),
  planId: text("plan_id")
    .notNull()
    .references(() => plans.id),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  stripeCustomerId: text("stripe_customer_id"),
  status: subscriptionStatusEnum("status").notNull().default("active"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
  canceledAt: timestamp("canceled_at"),
  trialStart: timestamp("trial_start"),
  trialEnd: timestamp("trial_end"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const usage = pgTable(
  "usage",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    periodStart: timestamp("period_start").notNull(),
    periodEnd: timestamp("period_end").notNull(),
    storageUsed: bigint("storage_used", { mode: "number" }).default(0).notNull(), // bytes
    videosUploaded: integer("videos_uploaded").default(0).notNull(),
    bandwidthUsed: bigint("bandwidth_used", { mode: "number" }).default(0).notNull(), // bytes
    aiRequests: integer("ai_requests").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueOrgPeriod: unique().on(table.organizationId, table.periodStart),
  }),
);

export const invoices = pgTable("invoices", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  stripeInvoiceId: text("stripe_invoice_id").unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  amount: integer("amount").notNull(), // cents
  amountPaid: integer("amount_paid").default(0).notNull(), // cents
  currency: text("currency").default("usd").notNull(),
  status: invoiceStatusEnum("status").notNull(),
  pdfUrl: text("pdf_url"),
  hostedInvoiceUrl: text("hosted_invoice_url"),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  dueDate: timestamp("due_date"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const paymentMethods = pgTable("payment_methods", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  stripePaymentMethodId: text("stripe_payment_method_id").notNull().unique(),
  type: text("type").notNull(), // 'card', 'bank_account', etc.
  brand: text("brand"), // 'visa', 'mastercard', etc.
  last4: text("last4"),
  expMonth: integer("exp_month"),
  expYear: integer("exp_year"),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const userRelations = relations(users, ({ many }) => ({
  videos: many(videos),
  comments: many(comments),
  videoProgresses: many(videoProgresses),
}));

export const organizationRelations = relations(organizations, ({ one, many }) => ({
  videos: many(videos),
  channels: many(channels),
  collections: many(collections),
  subscription: one(subscriptions),
  usageRecords: many(usage),
  invoices: many(invoices),
  paymentMethods: many(paymentMethods),
}));

export const videosRelations = relations(videos, ({ one, many }) => ({
  author: one(users, {
    fields: [videos.authorId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [videos.organizationId],
    references: [organizations.id],
  }),
  channel: one(channels, {
    fields: [videos.channelId],
    references: [channels.id],
  }),
  collection: one(collections, {
    fields: [videos.collectionId],
    references: [collections.id],
  }),
  comments: many(comments),
  videoProgresses: many(videoProgresses),
  chapters: many(videoChapters),
  codeSnippets: many(videoCodeSnippets),
}));

export const videoChaptersRelations = relations(videoChapters, ({ one }) => ({
  video: one(videos, {
    fields: [videoChapters.videoId],
    references: [videos.id],
  }),
}));

export const videoCodeSnippetsRelations = relations(videoCodeSnippets, ({ one }) => ({
  video: one(videos, {
    fields: [videoCodeSnippets.videoId],
    references: [videos.id],
  }),
}));

export const channelRelations = relations(channels, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [channels.organizationId],
    references: [organizations.id],
  }),
  videos: many(videos),
}));

export const collectionRelations = relations(collections, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [collections.organizationId],
    references: [organizations.id],
  }),
  createdBy: one(users, {
    fields: [collections.createdById],
    references: [users.id],
  }),
  videos: many(videos),
  seriesVideos: many(seriesVideos),
  seriesProgress: many(seriesProgress),
}));

export const seriesVideosRelations = relations(seriesVideos, ({ one }) => ({
  series: one(collections, {
    fields: [seriesVideos.seriesId],
    references: [collections.id],
  }),
  video: one(videos, {
    fields: [seriesVideos.videoId],
    references: [videos.id],
  }),
}));

export const seriesProgressRelations = relations(seriesProgress, ({ one }) => ({
  user: one(users, {
    fields: [seriesProgress.userId],
    references: [users.id],
  }),
  series: one(collections, {
    fields: [seriesProgress.seriesId],
    references: [collections.id],
  }),
  lastVideo: one(videos, {
    fields: [seriesProgress.lastVideoId],
    references: [videos.id],
  }),
}));

export const commentRelations = relations(comments, ({ one, many }) => ({
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id],
  }),
  video: one(videos, {
    fields: [comments.videoId],
    references: [videos.id],
  }),
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
    relationName: "CommentThread",
  }),
  replies: many(comments, {
    relationName: "CommentThread",
  }),
}));

export const videoProgressRelations = relations(videoProgresses, ({ one }) => ({
  user: one(users, {
    fields: [videoProgresses.userId],
    references: [users.id],
  }),
  video: one(videos, {
    fields: [videoProgresses.videoId],
    references: [videos.id],
  }),
}));

export const notificationRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
    relationName: "NotificationRecipient",
  }),
  actor: one(users, {
    fields: [notifications.actorId],
    references: [users.id],
    relationName: "NotificationActor",
  }),
}));

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

// Billing relations
export const plansRelations = relations(plans, ({ many }) => ({
  subscriptions: many(subscriptions),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  organization: one(organizations, {
    fields: [subscriptions.organizationId],
    references: [organizations.id],
  }),
  plan: one(plans, {
    fields: [subscriptions.planId],
    references: [plans.id],
  }),
}));

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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type Member = typeof members.$inferSelect;
export type NewMember = typeof members.$inferInsert;
export type Video = typeof videos.$inferSelect;
export type NewVideo = typeof videos.$inferInsert;
export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;
export type Collection = typeof collections.$inferSelect;
export type NewCollection = typeof collections.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type VideoProgress = typeof videoProgresses.$inferSelect;
export type NewVideoProgress = typeof videoProgresses.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type VideoChapter = typeof videoChapters.$inferSelect;
export type NewVideoChapter = typeof videoChapters.$inferInsert;
export type VideoCodeSnippet = typeof videoCodeSnippets.$inferSelect;
export type NewVideoCodeSnippet = typeof videoCodeSnippets.$inferInsert;
export type SeriesVideo = typeof seriesVideos.$inferSelect;
export type NewSeriesVideo = typeof seriesVideos.$inferInsert;
export type SeriesProgress = typeof seriesProgress.$inferSelect;
export type NewSeriesProgress = typeof seriesProgress.$inferInsert;

// Processing status type
export type ProcessingStatus = (typeof processingStatusEnum.enumValues)[number];

// Integration types
export type IntegrationProvider = (typeof integrationProviderEnum.enumValues)[number];
export type ImportStatus = (typeof importStatusEnum.enumValues)[number];
export type Integration = typeof integrations.$inferSelect;
export type NewIntegration = typeof integrations.$inferInsert;
export type ImportedMeeting = typeof importedMeetings.$inferSelect;
export type NewImportedMeeting = typeof importedMeetings.$inferInsert;

// Billing types
export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type Usage = typeof usage.$inferSelect;
export type NewUsage = typeof usage.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type NewPaymentMethod = typeof paymentMethods.$inferInsert;
export type SubscriptionStatus = (typeof subscriptionStatusEnum.enumValues)[number];
export type InvoiceStatus = (typeof invoiceStatusEnum.enumValues)[number];
