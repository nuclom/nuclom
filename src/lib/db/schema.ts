import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("UserRole", ["user", "admin"]);
export const organizationRoleEnum = pgEnum("OrganizationRole", ["owner", "member"]);
export const processingStatusEnum = pgEnum("ProcessingStatus", [
  "pending",
  "transcribing",
  "diarizing",
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
  twoFactorEnabled: boolean("two_factor_enabled"),
  // Better Auth Stripe integration
  stripeCustomerId: text("stripe_customer_id"),
  // Legal consent fields
  tosAcceptedAt: timestamp("tos_accepted_at"),
  tosVersion: text("tos_version"),
  privacyAcceptedAt: timestamp("privacy_accepted_at"),
  privacyVersion: text("privacy_version"),
  marketingConsentAt: timestamp("marketing_consent_at"),
  marketingConsent: boolean("marketing_consent").default(false),
  // Account deletion fields
  deletionRequestedAt: timestamp("deletion_requested_at"),
  deletionScheduledFor: timestamp("deletion_scheduled_for"),
  // Moderation fields
  warnedAt: timestamp("warned_at"),
  warningReason: text("warning_reason"),
  suspendedUntil: timestamp("suspended_until"),
  suspensionReason: text("suspension_reason"),
  // Last login method tracking (better-auth plugin)
  lastLoginMethod: text("last_login_method"),
});

export const sessions = pgTable(
  "sessions",
  {
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
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
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
  },
  (table) => [index("accounts_user_id_idx").on(table.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").$defaultFn(() => /* @__PURE__ */ new Date()),
    updatedAt: timestamp("updated_at").$defaultFn(() => /* @__PURE__ */ new Date()),
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
);

export const organizations = pgTable(
  "organizations",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    logo: text("logo"),
    createdAt: timestamp("created_at").notNull(),
    metadata: text("metadata"),
  },
  (table) => [uniqueIndex("organizations_slug_idx").on(table.slug)],
);

export const members = pgTable(
  "members",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: organizationRoleEnum("role").default("member").notNull(),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    index("members_organization_id_idx").on(table.organizationId),
    index("members_user_id_idx").on(table.userId),
  ],
);

export const invitations = pgTable(
  "invitations",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: organizationRoleEnum("role").default("member").notNull(),
    status: text("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("invitations_organization_id_idx").on(table.organizationId),
    index("invitations_email_idx").on(table.email),
  ],
);

export const apikeys = pgTable(
  "apikeys",
  {
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
    requestCount: integer("request_count").default(0),
    remaining: integer("remaining"),
    lastRequest: timestamp("last_request"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    permissions: text("permissions"),
    metadata: text("metadata"),
  },
  (table) => [index("apikeys_key_idx").on(table.key), index("apikeys_user_id_idx").on(table.userId)],
);

// Two-Factor Authentication tables
export const twoFactors = pgTable(
  "two_factors",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
  },
  (table) => [index("two_factors_secret_idx").on(table.secret), index("two_factors_user_id_idx").on(table.userId)],
);

// Passkeys/WebAuthn table
export const passkeys = pgTable(
  "passkeys",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    credentialID: text("credential_id").notNull().unique(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type"),
    backedUp: boolean("backed_up"),
    transports: text("transports"),
    createdAt: timestamp("created_at").$defaultFn(() => new Date()),
    aaguid: text("aaguid"),
  },
  (table) => [
    index("passkeys_user_id_idx").on(table.userId),
    index("passkeys_credential_id_idx").on(table.credentialID),
  ],
);

// User preferences table
export const userPreferences = pgTable("user_preferences", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  // Notification preferences
  emailNotifications: boolean("email_notifications").default(true).notNull(),
  emailCommentReplies: boolean("email_comment_replies").default(true).notNull(),
  emailMentions: boolean("email_mentions").default(true).notNull(),
  emailVideoProcessing: boolean("email_video_processing").default(true).notNull(),
  emailWeeklyDigest: boolean("email_weekly_digest").default(false).notNull(),
  emailProductUpdates: boolean("email_product_updates").default(true).notNull(),
  // In-app notification preferences
  pushNotifications: boolean("push_notifications").default(true).notNull(),
  // Appearance preferences
  theme: text("theme").default("system").notNull(), // 'light', 'dark', 'system'
  // Privacy preferences
  showActivityStatus: boolean("show_activity_status").default(true).notNull(),
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// OAuth provider tables are managed by better-auth's oauthProvider plugin
// Run `pnpm db:generate` to create/update the schema

export const channels = pgTable(
  "channels",
  {
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
  },
  (table) => [index("channels_organization_id_idx").on(table.organizationId)],
);

export const collections = pgTable(
  "collections",
  {
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
    // Collections remain if creator is deleted, just clear the reference
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("collections_organization_id_idx").on(table.organizationId),
    index("collections_created_by_id_idx").on(table.createdById),
  ],
);

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
  (table) => [
    unique().on(table.seriesId, table.videoId),
    index("series_videos_series_id_idx").on(table.seriesId),
    index("series_videos_video_id_idx").on(table.videoId),
  ],
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
    // If the video is deleted, clear the last watched reference
    lastVideoId: text("last_video_id").references(() => videos.id, { onDelete: "set null" }),
    lastPosition: integer("last_position").default(0).notNull(),
    completedVideoIds: jsonb("completed_video_ids").$type<string[]>().default([]).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique().on(table.userId, table.seriesId),
    index("series_progress_user_id_idx").on(table.userId),
    index("series_progress_series_id_idx").on(table.seriesId),
  ],
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

export const videos = pgTable(
  "videos",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    title: text("title").notNull(),
    description: text("description"),
    duration: text("duration").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    videoUrl: text("video_url"),
    // authorId is nullable to support SET NULL on user deletion
    // Videos remain in org even if author is deleted
    authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    channelId: text("channel_id").references(() => channels.id, { onDelete: "set null" }),
    collectionId: text("collection_id").references(() => collections.id, { onDelete: "set null" }),
    // Transcription fields
    transcript: text("transcript"),
    transcriptSegments: jsonb("transcript_segments").$type<TranscriptSegment[]>(),
    // AI Analysis fields
    processingStatus: processingStatusEnum("processing_status").default("pending").notNull(),
    processingError: text("processing_error"),
    aiSummary: text("ai_summary"),
    aiTags: jsonb("ai_tags").$type<string[]>(),
    aiActionItems: jsonb("ai_action_items").$type<ActionItem[]>(),
    // Full-text search vector (managed by PostgreSQL trigger)
    // Note: This column is of type tsvector in the database, but we use text() here
    // to avoid TypeScript inference issues. The actual column type is handled by the migration.
    searchVector: text("search_vector"),
    // Soft-delete fields
    deletedAt: timestamp("deleted_at"),
    retentionUntil: timestamp("retention_until"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Note: searchVectorIdx is defined in the migration with GIN index on the actual tsvector column
    organizationCreatedIdx: index("videos_organization_created_idx").on(table.organizationId, table.createdAt),
    authorIdx: index("videos_author_id_idx").on(table.authorId),
    channelIdx: index("videos_channel_id_idx").on(table.channelId),
    collectionIdx: index("videos_collection_id_idx").on(table.collectionId),
    processingStatusIdx: index("videos_processing_status_idx").on(table.processingStatus),
  }),
);

export const comments = pgTable(
  "comments",
  {
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
  },
  (table) => [
    index("comments_video_id_idx").on(table.videoId),
    index("comments_author_id_idx").on(table.authorId),
    index("comments_parent_id_idx").on(table.parentId),
  ],
);

// Comment reactions for enhanced engagement
export const reactionTypeEnum = pgEnum("ReactionType", [
  "like",
  "love",
  "laugh",
  "surprised",
  "sad",
  "angry",
  "thinking",
  "celebrate",
]);

export const commentReactions = pgTable(
  "comment_reactions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    commentId: text("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reactionType: reactionTypeEnum("reaction_type").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueUserReaction: unique().on(table.commentId, table.userId, table.reactionType),
    commentIdx: index("comment_reactions_comment_idx").on(table.commentId),
  }),
);

// Watch later list for user bookmarks
export const watchLater = pgTable(
  "watch_later",
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
    addedAt: timestamp("added_at").defaultNow().notNull(),
    priority: integer("priority").default(0).notNull(),
    notes: text("notes"),
  },
  (table) => ({
    uniqueUserVideo: unique().on(table.userId, table.videoId),
    userIdx: index("watch_later_user_idx").on(table.userId, table.addedAt),
  }),
);

// User presence for real-time collaboration
export const userPresence = pgTable(
  "user_presence",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    videoId: text("video_id").references(() => videos.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    status: text("status").default("online").notNull(), // online, away, busy
    currentTime: integer("current_time"), // video timestamp in seconds
    lastSeen: timestamp("last_seen").defaultNow().notNull(),
    metadata: jsonb("metadata").$type<{ cursorPosition?: number; isTyping?: boolean }>(),
  },
  (table) => ({
    userIdx: index("user_presence_user_idx").on(table.userId),
    videoIdx: index("user_presence_video_idx").on(table.videoId),
    lastSeenIdx: index("user_presence_last_seen_idx").on(table.lastSeen),
  }),
);

// Performance metrics for monitoring
export const performanceMetrics = pgTable(
  "performance_metrics",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    metricType: text("metric_type").notNull(), // video_load, api_response, upload_speed, etc.
    metricName: text("metric_name").notNull(),
    value: integer("value").notNull(), // milliseconds or bytes
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    videoId: text("video_id").references(() => videos.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgTypeIdx: index("performance_metrics_org_type_idx").on(table.organizationId, table.metricType, table.createdAt),
  }),
);

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
  (table) => [
    unique().on(table.userId, table.videoId),
    index("video_progresses_user_id_idx").on(table.userId),
    index("video_progresses_video_id_idx").on(table.videoId),
  ],
);

export const videoChapters = pgTable(
  "video_chapters",
  {
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
  },
  (table) => [index("video_chapters_video_id_idx").on(table.videoId)],
);

export const videoCodeSnippets = pgTable(
  "video_code_snippets",
  {
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
  },
  (table) => [index("video_code_snippets_video_id_idx").on(table.videoId)],
);

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
export const integrationProviderEnum = pgEnum("IntegrationProvider", [
  "zoom",
  "google_meet",
  "slack",
  "microsoft_teams",
  "github",
]);

// Code link type enum for GitHub context integration
export const codeLinkTypeEnum = pgEnum("CodeLinkType", ["pr", "issue", "commit", "file", "directory"]);

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

export const notifications = pgTable(
  "notifications",
  {
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
  },
  (table) => [
    index("notifications_user_id_idx").on(table.userId),
    index("notifications_user_read_idx").on(table.userId, table.read),
    index("notifications_actor_id_idx").on(table.actorId),
  ],
);

// Types for integration metadata
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
  (table) => [
    unique().on(table.userId, table.provider),
    index("integrations_user_id_idx").on(table.userId),
    index("integrations_organization_id_idx").on(table.organizationId),
  ],
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
  (table) => [
    unique().on(table.integrationId, table.externalId),
    index("imported_meetings_integration_id_idx").on(table.integrationId),
    index("imported_meetings_video_id_idx").on(table.videoId),
    index("imported_meetings_import_status_idx").on(table.importStatus),
  ],
);

// =====================
// GitHub Context Tables
// =====================

// Types for detected code references
export type DetectedCodeRef = {
  readonly type: "pr" | "issue" | "commit" | "file" | "module";
  readonly reference: string;
  readonly timestamp: number;
  readonly confidence: number;
  readonly suggestedRepo?: string;
};

export type CodeLinkType = "pr" | "issue" | "commit" | "file" | "directory";

// GitHub connections - stores repository access per organization
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

// Code links - bidirectional links between videos and code artifacts
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

// Better Auth Stripe compatible subscription table
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // Better Auth Stripe fields
    plan: text("plan").notNull(), // Plan name (e.g., "scale", "pro")
    referenceId: text("reference_id").notNull(), // Organization ID for org-based billing
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    status: text("status").notNull().default("active"), // active, canceled, past_due, trialing, etc.
    periodStart: timestamp("period_start"),
    periodEnd: timestamp("period_end"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    cancelAt: timestamp("cancel_at"),
    canceledAt: timestamp("canceled_at"),
    endedAt: timestamp("ended_at"),
    seats: integer("seats"),
    trialStart: timestamp("trial_start"),
    trialEnd: timestamp("trial_end"),
    // Custom fields for our app
    organizationId: text("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
    planId: text("plan_id").references(() => plans.id),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Index for Better Auth Stripe queries
    referenceIdx: index("subscriptions_reference_idx").on(table.referenceId),
    stripeSubIdx: index("subscriptions_stripe_subscription_idx").on(table.stripeSubscriptionId),
    statusIdx: index("subscriptions_status_idx").on(table.status),
  }),
);

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
  (table) => [
    unique().on(table.organizationId, table.periodStart),
    index("usage_organization_id_idx").on(table.organizationId),
  ],
);

export const invoices = pgTable(
  "invoices",
  {
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
  },
  (table) => [
    index("invoices_organization_id_idx").on(table.organizationId),
    index("invoices_status_idx").on(table.status),
  ],
);

export const paymentMethods = pgTable(
  "payment_methods",
  {
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
  },
  (table) => [index("payment_methods_organization_id_idx").on(table.organizationId)],
);

// Webhook idempotency table - prevents duplicate processing of webhook events
export const processedWebhookEvents = pgTable(
  "processed_webhook_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    eventId: text("event_id").notNull().unique(), // Stripe event ID (evt_xxx)
    eventType: text("event_type").notNull(), // e.g., 'invoice.paid'
    source: text("source").notNull().default("stripe"), // 'stripe', 'github', etc.
    processedAt: timestamp("processed_at").defaultNow().notNull(),
    // TTL: Events older than 30 days can be cleaned up
    expiresAt: timestamp("expires_at")
      .notNull()
      .$defaultFn(() => {
        const date = new Date();
        date.setDate(date.getDate() + 30);
        return date;
      }),
  },
  (table) => ({
    eventIdIdx: index("processed_webhook_events_event_id_idx").on(table.eventId),
    expiresAtIdx: index("processed_webhook_events_expires_at_idx").on(table.expiresAt),
    sourceTypeIdx: index("processed_webhook_events_source_type_idx").on(table.source, table.eventType),
  }),
);

export type ProcessedWebhookEvent = typeof processedWebhookEvents.$inferSelect;
export type NewProcessedWebhookEvent = typeof processedWebhookEvents.$inferInsert;

// =====================
// Search Tables
// =====================

// Types for search filters
export type SearchFilters = {
  readonly types?: ReadonlyArray<"video" | "series" | "channel">;
  readonly authorId?: string;
  readonly channelId?: string;
  readonly collectionId?: string;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly hasTranscript?: boolean;
  readonly hasAiSummary?: boolean;
  readonly processingStatus?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly sortBy?: "relevance" | "date" | "title";
  readonly sortOrder?: "asc" | "desc";
};

export const searchHistory = pgTable(
  "search_history",
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
    query: text("query").notNull(),
    filters: jsonb("filters").$type<SearchFilters>(),
    resultsCount: integer("results_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userOrgIdx: index("search_history_user_org_idx").on(table.userId, table.organizationId, table.createdAt),
  }),
);

export const savedSearches = pgTable(
  "saved_searches",
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
    name: text("name").notNull(),
    query: text("query").notNull(),
    filters: jsonb("filters").$type<SearchFilters>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userOrgIdx: index("saved_searches_user_org_idx").on(table.userId, table.organizationId),
    uniqueUserName: unique("saved_searches_user_name_unique").on(table.userId, table.organizationId, table.name),
  }),
);

// =====================
// Legal & Compliance Tables
// =====================

// Document type enum for legal consents
export const legalDocumentTypeEnum = pgEnum("LegalDocumentType", ["terms_of_service", "privacy_policy"]);

// Consent audit action enum
export const consentActionEnum = pgEnum("ConsentAction", ["granted", "withdrawn", "updated"]);

// Report category enum
export const reportCategoryEnum = pgEnum("ReportCategory", [
  "inappropriate",
  "spam",
  "copyright",
  "harassment",
  "other",
]);

// Report status enum
export const reportStatusEnum = pgEnum("ReportStatus", ["pending", "reviewing", "resolved", "dismissed"]);

// Report resolution enum
export const reportResolutionEnum = pgEnum("ReportResolution", [
  "content_removed",
  "user_warned",
  "user_suspended",
  "no_action",
]);

// Resource type enum for reports
export const reportResourceTypeEnum = pgEnum("ReportResourceType", ["video", "comment", "user"]);

// Legal consents table - tracks each user's consent to legal documents
export const legalConsents = pgTable(
  "legal_consents",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    documentType: legalDocumentTypeEnum("document_type").notNull(),
    version: text("version").notNull(), // e.g., "2025-01-01"
    acceptedAt: timestamp("accepted_at").defaultNow().notNull(),
    ipAddress: text("ip_address"),
  },
  (table) => ({
    userDocIdx: index("legal_consents_user_doc_idx").on(table.userId, table.documentType),
    uniqueUserDocVersion: unique().on(table.userId, table.documentType, table.version),
  }),
);

// Consent audit log - tracks all consent changes for compliance
export const consentAuditLog = pgTable(
  "consent_audit_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: consentActionEnum("action").notNull(),
    details: jsonb("details").$type<{
      documentType?: string;
      version?: string;
      previousValue?: boolean;
      newValue?: boolean;
      consentType?: string;
    }>(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("consent_audit_log_user_idx").on(table.userId, table.createdAt),
  }),
);

// Reports table - tracks abuse reports
export const reports = pgTable(
  "reports",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    reporterId: text("reporter_id").references(() => users.id, { onDelete: "set null" }),
    resourceType: reportResourceTypeEnum("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    category: reportCategoryEnum("category").notNull(),
    description: text("description"),
    status: reportStatusEnum("status").default("pending").notNull(),
    resolution: reportResolutionEnum("resolution"),
    resolvedById: text("resolved_by_id").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at"),
    resolutionNotes: text("resolution_notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    statusIdx: index("reports_status_idx").on(table.status, table.createdAt),
    resourceIdx: index("reports_resource_idx").on(table.resourceType, table.resourceId),
    reporterIdx: index("reports_reporter_idx").on(table.reporterId),
  }),
);

// Data export requests - tracks GDPR data export requests
export const dataExportRequests = pgTable(
  "data_export_requests",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").default("pending").notNull(), // pending, processing, completed, failed
    downloadUrl: text("download_url"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    userIdx: index("data_export_requests_user_idx").on(table.userId, table.createdAt),
  }),
);

// =====================
// Knowledge Graph Tables
// =====================

// Enums for knowledge graph
export const decisionStatusEnum = pgEnum("DecisionStatus", ["proposed", "decided", "revisited", "superseded"]);

export const participantRoleEnum = pgEnum("ParticipantRole", ["decider", "participant", "mentioned"]);

export const knowledgeNodeTypeEnum = pgEnum("KnowledgeNodeType", ["person", "topic", "artifact", "decision", "video"]);

export const decisionTypeEnum = pgEnum("DecisionType", ["technical", "process", "product", "team", "other"]);

// Decisions extracted from videos
export const decisions = pgTable(
  "decisions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    timestampStart: integer("timestamp_start"), // seconds into video
    timestampEnd: integer("timestamp_end"),
    summary: text("summary").notNull(), // "We decided to use PostgreSQL instead of MongoDB"
    context: text("context"), // surrounding discussion that led to decision
    reasoning: text("reasoning"), // why the decision was made
    status: decisionStatusEnum("status").default("decided").notNull(),
    decisionType: decisionTypeEnum("decision_type").default("other").notNull(),
    confidence: integer("confidence"), // AI confidence score 0-100
    tags: jsonb("tags").$type<string[]>().default([]),
    // Embedding for semantic search (stored as JSON array for pgvector compatibility)
    embedding: jsonb("embedding").$type<number[]>(),
    metadata: jsonb("metadata").$type<{
      alternatives?: string[];
      relatedDecisionIds?: string[];
      externalRefs?: Array<{ type: string; id: string; url?: string }>;
    }>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("decisions_org_idx").on(table.organizationId, table.createdAt),
    videoIdx: index("decisions_video_idx").on(table.videoId),
    statusIdx: index("decisions_status_idx").on(table.status),
    typeIdx: index("decisions_type_idx").on(table.decisionType),
  }),
);

// Participants in a decision
export const decisionParticipants = pgTable(
  "decision_participants",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    decisionId: text("decision_id")
      .notNull()
      .references(() => decisions.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    role: participantRoleEnum("role").default("participant").notNull(),
    speakerName: text("speaker_name"), // name from transcript if not linked to user
    attributedText: text("attributed_text"), // what they said
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    decisionIdx: index("decision_participants_decision_idx").on(table.decisionId),
    userIdx: index("decision_participants_user_idx").on(table.userId),
  }),
);

// Knowledge graph nodes - entities that can be connected
export const knowledgeNodes = pgTable(
  "knowledge_nodes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    type: knowledgeNodeTypeEnum("type").notNull(),
    externalId: text("external_id"), // github:pr:123, linear:issue:ABC, etc.
    name: text("name").notNull(),
    description: text("description"),
    // Embedding for semantic search
    embedding: jsonb("embedding").$type<number[]>(),
    metadata: jsonb("metadata").$type<{
      url?: string;
      attributes?: Record<string, unknown>;
    }>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("knowledge_nodes_org_idx").on(table.organizationId),
    typeIdx: index("knowledge_nodes_type_idx").on(table.type),
    externalIdx: index("knowledge_nodes_external_idx").on(table.externalId),
    uniqueOrgExternal: unique("knowledge_nodes_org_external_unique").on(table.organizationId, table.externalId),
  }),
);

// Knowledge graph edges - relationships between nodes
export const knowledgeEdges = pgTable(
  "knowledge_edges",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sourceNodeId: text("source_node_id")
      .notNull()
      .references(() => knowledgeNodes.id, { onDelete: "cascade" }),
    targetNodeId: text("target_node_id")
      .notNull()
      .references(() => knowledgeNodes.id, { onDelete: "cascade" }),
    relationship: text("relationship").notNull(), // decided, mentioned, references, supersedes, related_to
    weight: integer("weight").default(100), // 0-100 for relationship strength
    metadata: jsonb("metadata").$type<{
      videoId?: string;
      timestamp?: number;
      context?: string;
    }>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    sourceIdx: index("knowledge_edges_source_idx").on(table.sourceNodeId),
    targetIdx: index("knowledge_edges_target_idx").on(table.targetNodeId),
    relationshipIdx: index("knowledge_edges_relationship_idx").on(table.relationship),
    uniqueEdge: unique("knowledge_edges_unique").on(table.sourceNodeId, table.targetNodeId, table.relationship),
  }),
);

// Links between decisions and external entities (polymorphic linking)
export const decisionLinks = pgTable(
  "decision_links",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    decisionId: text("decision_id")
      .notNull()
      .references(() => decisions.id, { onDelete: "cascade" }),
    // Polymorphic reference - can link to various entity types
    entityType: text("entity_type").notNull(), // video, document, code, issue
    entityId: text("entity_id").notNull(), // ID of the entity
    entityRef: text("entity_ref"), // human-readable ref like "PR #123"
    linkType: text("link_type").notNull(), // implements, references, supersedes, relates_to
    url: text("url"), // external URL if applicable
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    decisionIdx: index("decision_links_decision_idx").on(table.decisionId),
    entityIdx: index("decision_links_entity_idx").on(table.entityType, table.entityId),
    uniqueLink: unique("decision_links_unique").on(table.decisionId, table.entityType, table.entityId, table.linkType),
  }),
);

// =====================
// AI Insights Tables
// =====================

// Enums for AI insights
export const topicTrendEnum = pgEnum("TopicTrend", ["rising", "stable", "declining"]);
export const actionItemStatusEnum = pgEnum("ActionItemStatus", ["pending", "in_progress", "completed", "cancelled"]);
export const actionItemPriorityEnum = pgEnum("ActionItemPriority", ["high", "medium", "low"]);

// Aggregated topic tracking for organization-wide topic trends
export const aiTopics = pgTable(
  "ai_topics",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(), // lowercase, trimmed for deduplication
    description: text("description"),
    // Aggregated stats
    mentionCount: integer("mention_count").default(1).notNull(),
    videoCount: integer("video_count").default(1).notNull(),
    lastMentionedAt: timestamp("last_mentioned_at").defaultNow().notNull(),
    firstMentionedAt: timestamp("first_mentioned_at").defaultNow().notNull(),
    // Trend calculation (based on recent vs older mentions)
    trend: topicTrendEnum("trend").default("stable").notNull(),
    trendScore: integer("trend_score").default(0), // -100 to 100
    // Related keywords for word cloud
    keywords: jsonb("keywords").$type<string[]>().default([]),
    // Metadata for additional context
    metadata: jsonb("metadata").$type<{
      recentVideos?: Array<{ id: string; title: string; mentionCount: number }>;
      relatedTopics?: string[];
    }>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("ai_topics_org_idx").on(table.organizationId),
    nameIdx: index("ai_topics_name_idx").on(table.organizationId, table.normalizedName),
    trendIdx: index("ai_topics_trend_idx").on(table.organizationId, table.trend),
    mentionIdx: index("ai_topics_mention_idx").on(table.organizationId, table.mentionCount),
    uniqueOrgName: unique("ai_topics_org_name_unique").on(table.organizationId, table.normalizedName),
  }),
);

// Organization-wide action items extracted from videos
export const aiActionItems = pgTable(
  "ai_action_items",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    // Action item content
    title: text("title").notNull(),
    description: text("description"),
    // Assignment and status
    assignee: text("assignee"), // Could be speaker name or user mention
    assigneeUserId: text("assignee_user_id").references(() => users.id, { onDelete: "set null" }),
    status: actionItemStatusEnum("status").default("pending").notNull(),
    priority: actionItemPriorityEnum("priority").default("medium").notNull(),
    // Timing
    dueDate: timestamp("due_date"),
    completedAt: timestamp("completed_at"),
    completedById: text("completed_by_id").references(() => users.id, { onDelete: "set null" }),
    // Video context
    timestampStart: integer("timestamp_start"), // seconds into video
    timestampEnd: integer("timestamp_end"),
    // AI extraction metadata
    confidence: integer("confidence"), // 0-100
    extractedFrom: text("extracted_from"), // transcript snippet
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("ai_action_items_org_idx").on(table.organizationId, table.status),
    videoIdx: index("ai_action_items_video_idx").on(table.videoId),
    assigneeIdx: index("ai_action_items_assignee_idx").on(table.assigneeUserId),
    statusIdx: index("ai_action_items_status_idx").on(table.status, table.priority),
    dueDateIdx: index("ai_action_items_due_date_idx").on(table.dueDate),
  }),
);

// Types for AI insights
export type TopicTrend = (typeof topicTrendEnum.enumValues)[number];
export type ActionItemStatus = (typeof actionItemStatusEnum.enumValues)[number];
export type ActionItemPriority = (typeof actionItemPriorityEnum.enumValues)[number];

export type AiTopic = typeof aiTopics.$inferSelect;
export type NewAiTopic = typeof aiTopics.$inferInsert;
export type AiActionItem = typeof aiActionItems.$inferSelect;
export type NewAiActionItem = typeof aiActionItems.$inferInsert;

// Types for knowledge graph
export type DecisionStatus = (typeof decisionStatusEnum.enumValues)[number];
export type ParticipantRole = (typeof participantRoleEnum.enumValues)[number];
export type KnowledgeNodeType = (typeof knowledgeNodeTypeEnum.enumValues)[number];
export type DecisionType = (typeof decisionTypeEnum.enumValues)[number];

export type Decision = typeof decisions.$inferSelect;
export type NewDecision = typeof decisions.$inferInsert;
export type DecisionParticipant = typeof decisionParticipants.$inferSelect;
export type NewDecisionParticipant = typeof decisionParticipants.$inferInsert;
export type KnowledgeNode = typeof knowledgeNodes.$inferSelect;
export type NewKnowledgeNode = typeof knowledgeNodes.$inferInsert;
export type KnowledgeEdge = typeof knowledgeEdges.$inferSelect;
export type NewKnowledgeEdge = typeof knowledgeEdges.$inferInsert;
export type DecisionLink = typeof decisionLinks.$inferSelect;
export type NewDecisionLink = typeof decisionLinks.$inferInsert;

// Relations
export const userRelations = relations(users, ({ one, many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  members: many(members),
  invitations: many(invitations),
  videos: many(videos),
  comments: many(comments),
  videoProgresses: many(videoProgresses),
  twoFactor: one(twoFactors),
  passkeys: many(passkeys),
  preferences: one(userPreferences),
  apiKeys: many(apikeys),
  // OAuth provider relations are managed by better-auth
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const membersRelations = relations(members, ({ one }) => ({
  organization: one(organizations, {
    fields: [members.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [members.userId],
    references: [users.id],
  }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  organization: one(organizations, {
    fields: [invitations.organizationId],
    references: [organizations.id],
  }),
  inviter: one(users, {
    fields: [invitations.inviterId],
    references: [users.id],
  }),
}));

export const twoFactorRelations = relations(twoFactors, ({ one }) => ({
  user: one(users, {
    fields: [twoFactors.userId],
    references: [users.id],
  }),
}));

export const passkeyRelations = relations(passkeys, ({ one }) => ({
  user: one(users, {
    fields: [passkeys.userId],
    references: [users.id],
  }),
}));

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userPreferences.userId],
    references: [users.id],
  }),
}));

export const apiKeyRelations = relations(apikeys, ({ one }) => ({
  user: one(users, {
    fields: [apikeys.userId],
    references: [users.id],
  }),
}));

// OAuth provider relations are managed by better-auth's oauthProvider plugin

export const organizationRelations = relations(organizations, ({ one, many }) => ({
  members: many(members),
  invitations: many(invitations),
  videos: many(videos),
  channels: many(channels),
  collections: many(collections),
  subscription: one(subscriptions),
  usageRecords: many(usage),
  invoices: many(invoices),
  paymentMethods: many(paymentMethods),
  decisions: many(decisions),
  knowledgeNodes: many(knowledgeNodes),
  aiTopics: many(aiTopics),
  aiActionItems: many(aiActionItems),
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
  codeLinks: many(codeLinks),
  decisions: many(decisions),
  speakers: many(videoSpeakers),
  speakerSegments: many(speakerSegments),
  aiActionItems: many(aiActionItems),
  transcriptChunks: many(transcriptChunks),
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
  reactions: many(commentReactions),
}));

export const commentReactionsRelations = relations(commentReactions, ({ one }) => ({
  comment: one(comments, {
    fields: [commentReactions.commentId],
    references: [comments.id],
  }),
  user: one(users, {
    fields: [commentReactions.userId],
    references: [users.id],
  }),
}));

export const watchLaterRelations = relations(watchLater, ({ one }) => ({
  user: one(users, {
    fields: [watchLater.userId],
    references: [users.id],
  }),
  video: one(videos, {
    fields: [watchLater.videoId],
    references: [videos.id],
  }),
}));

export const userPresenceRelations = relations(userPresence, ({ one }) => ({
  user: one(users, {
    fields: [userPresence.userId],
    references: [users.id],
  }),
  video: one(videos, {
    fields: [userPresence.videoId],
    references: [videos.id],
  }),
  organization: one(organizations, {
    fields: [userPresence.organizationId],
    references: [organizations.id],
  }),
}));

export const performanceMetricsRelations = relations(performanceMetrics, ({ one }) => ({
  organization: one(organizations, {
    fields: [performanceMetrics.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [performanceMetrics.userId],
    references: [users.id],
  }),
  video: one(videos, {
    fields: [performanceMetrics.videoId],
    references: [videos.id],
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

// GitHub context relations
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

// Knowledge Graph Relations
export const decisionsRelations = relations(decisions, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [decisions.organizationId],
    references: [organizations.id],
  }),
  video: one(videos, {
    fields: [decisions.videoId],
    references: [videos.id],
  }),
  participants: many(decisionParticipants),
  links: many(decisionLinks),
}));

export const decisionParticipantsRelations = relations(decisionParticipants, ({ one }) => ({
  decision: one(decisions, {
    fields: [decisionParticipants.decisionId],
    references: [decisions.id],
  }),
  user: one(users, {
    fields: [decisionParticipants.userId],
    references: [users.id],
  }),
}));

export const knowledgeNodesRelations = relations(knowledgeNodes, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [knowledgeNodes.organizationId],
    references: [organizations.id],
  }),
  outgoingEdges: many(knowledgeEdges, { relationName: "SourceNode" }),
  incomingEdges: many(knowledgeEdges, { relationName: "TargetNode" }),
}));

export const knowledgeEdgesRelations = relations(knowledgeEdges, ({ one }) => ({
  sourceNode: one(knowledgeNodes, {
    fields: [knowledgeEdges.sourceNodeId],
    references: [knowledgeNodes.id],
    relationName: "SourceNode",
  }),
  targetNode: one(knowledgeNodes, {
    fields: [knowledgeEdges.targetNodeId],
    references: [knowledgeNodes.id],
    relationName: "TargetNode",
  }),
}));

export const decisionLinksRelations = relations(decisionLinks, ({ one }) => ({
  decision: one(decisions, {
    fields: [decisionLinks.decisionId],
    references: [decisions.id],
  }),
}));

// AI Insights Relations
export const aiTopicsRelations = relations(aiTopics, ({ one }) => ({
  organization: one(organizations, {
    fields: [aiTopics.organizationId],
    references: [organizations.id],
  }),
}));

export const aiActionItemsRelations = relations(aiActionItems, ({ one }) => ({
  organization: one(organizations, {
    fields: [aiActionItems.organizationId],
    references: [organizations.id],
  }),
  video: one(videos, {
    fields: [aiActionItems.videoId],
    references: [videos.id],
  }),
  assigneeUser: one(users, {
    fields: [aiActionItems.assigneeUserId],
    references: [users.id],
    relationName: "ActionItemAssignee",
  }),
  completedBy: one(users, {
    fields: [aiActionItems.completedById],
    references: [users.id],
    relationName: "ActionItemCompletedBy",
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

// =====================
// Video Analytics Tables
// =====================

export const videoViewSourceEnum = pgEnum("VideoViewSource", ["direct", "share_link", "embed"]);

export const videoViews = pgTable(
  "video_views",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }), // null for anonymous
    sessionId: text("session_id").notNull(), // browser session fingerprint
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    watchDuration: integer("watch_duration").default(0), // seconds watched
    completionPercent: integer("completion_percent").default(0), // 0-100
    source: videoViewSourceEnum("source").default("direct"),
    referrer: text("referrer"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    videoIdx: index("video_views_video_idx").on(table.videoId),
    sessionVideoIdx: unique("video_views_session_video_idx").on(table.sessionId, table.videoId),
    orgDateIdx: index("video_views_org_date_idx").on(table.organizationId, table.createdAt),
  }),
);

// Aggregated daily stats for faster queries
export const videoAnalyticsDaily = pgTable(
  "video_analytics_daily",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    date: timestamp("date").notNull(),
    viewCount: integer("view_count").default(0),
    uniqueViewers: integer("unique_viewers").default(0),
    totalWatchTime: integer("total_watch_time").default(0), // seconds
    avgCompletionPercent: integer("avg_completion_percent").default(0),
  },
  (table) => ({
    videoDateIdx: unique("video_analytics_video_date_idx").on(table.videoId, table.date),
  }),
);

// =====================
// Speaker Diarization Tables
// =====================

// Types for speaker segments with diarization
export type SpeakerSegment = {
  readonly startTime: number; // seconds
  readonly endTime: number; // seconds
  readonly text: string;
  readonly speakerId: string; // references speaker_profiles.id
  readonly speakerLabel: string; // "Speaker 1", "Speaker 2", etc.
  readonly confidence?: number;
};

// Speaker profiles for an organization (can be linked to org members)
export const speakerProfiles = pgTable(
  "speaker_profiles",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // Optional link to org member
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    displayName: text("display_name").notNull(),
    // Voice embedding for voice matching (optional, stored as JSON array)
    voiceEmbedding: jsonb("voice_embedding").$type<number[]>(),
    // Metadata for the speaker
    metadata: jsonb("metadata").$type<{
      jobTitle?: string;
      department?: string;
      avatarUrl?: string;
    }>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("speaker_profiles_org_idx").on(table.organizationId),
    userIdx: index("speaker_profiles_user_idx").on(table.userId),
    uniqueOrgUser: unique("speaker_profiles_org_user_unique").on(table.organizationId, table.userId),
  }),
);

// Video-level speaker information (speakers detected in a specific video)
export const videoSpeakers = pgTable(
  "video_speakers",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    // Links to speaker profile (may be created or matched during diarization)
    speakerProfileId: text("speaker_profile_id").references(() => speakerProfiles.id, { onDelete: "set null" }),
    // Original label from diarization ("Speaker A", "Speaker 1", etc.)
    speakerLabel: text("speaker_label").notNull(),
    // Computed stats
    totalSpeakingTime: integer("total_speaking_time").default(0).notNull(), // seconds
    segmentCount: integer("segment_count").default(0).notNull(),
    // Speaking percentage of total video duration
    speakingPercentage: integer("speaking_percentage").default(0), // 0-100
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    videoIdx: index("video_speakers_video_idx").on(table.videoId),
    profileIdx: index("video_speakers_profile_idx").on(table.speakerProfileId),
    uniqueVideoLabel: unique("video_speakers_video_label_unique").on(table.videoId, table.speakerLabel),
  }),
);

// Individual speaker segments within a video
export const speakerSegments = pgTable(
  "speaker_segments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    videoSpeakerId: text("video_speaker_id")
      .notNull()
      .references(() => videoSpeakers.id, { onDelete: "cascade" }),
    startTime: integer("start_time").notNull(), // milliseconds for precision
    endTime: integer("end_time").notNull(), // milliseconds
    transcriptText: text("transcript_text"),
    confidence: integer("confidence"), // 0-100
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    videoIdx: index("speaker_segments_video_idx").on(table.videoId),
    speakerIdx: index("speaker_segments_speaker_idx").on(table.videoSpeakerId),
    timeIdx: index("speaker_segments_time_idx").on(table.videoId, table.startTime),
  }),
);

// Aggregated speaker analytics per organization (for trends)
export const speakerAnalytics = pgTable(
  "speaker_analytics",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    speakerProfileId: text("speaker_profile_id")
      .notNull()
      .references(() => speakerProfiles.id, { onDelete: "cascade" }),
    // Aggregation period
    periodStart: timestamp("period_start").notNull(),
    periodEnd: timestamp("period_end").notNull(),
    // Aggregated stats
    videoCount: integer("video_count").default(0).notNull(),
    totalSpeakingTime: integer("total_speaking_time").default(0).notNull(), // seconds
    avgSpeakingPercentage: integer("avg_speaking_percentage").default(0), // 0-100
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgPeriodIdx: index("speaker_analytics_org_period_idx").on(table.organizationId, table.periodStart),
    profileIdx: index("speaker_analytics_profile_idx").on(table.speakerProfileId),
    uniqueProfilePeriod: unique("speaker_analytics_profile_period_unique").on(
      table.speakerProfileId,
      table.periodStart,
    ),
  }),
);

// =====================
// Transcript Chunks for Semantic Search
// =====================

// Stores chunked transcript segments with vector embeddings for semantic search
// Each video's transcript is chunked into ~500 token segments for better semantic matching
export const transcriptChunks = pgTable(
  "transcript_chunks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    text: text("text").notNull(),
    tokenCount: integer("token_count"),
    timestampStart: integer("timestamp_start"), // seconds into video
    timestampEnd: integer("timestamp_end"), // seconds into video
    speakers: jsonb("speakers").$type<string[]>(), // speaker names if available
    // Embedding stored as JSON array (compatible with pgvector via migration)
    // The actual vector column is created in the migration
    embedding: jsonb("embedding").$type<number[]>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    videoIdx: index("transcript_chunks_video_idx").on(table.videoId),
    orgIdx: index("transcript_chunks_org_idx").on(table.organizationId),
    uniqueChunkIndex: unique("transcript_chunks_unique_index").on(table.videoId, table.chunkIndex),
  }),
);

// =====================
// Video Sharing Tables
// =====================

export const videoShareLinkStatusEnum = pgEnum("VideoShareLinkStatus", ["active", "expired", "revoked"]);

export const videoShareLinkAccessEnum = pgEnum("VideoShareLinkAccess", ["view", "comment", "download"]);

export const videoShareLinks = pgTable(
  "video_share_links",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Access control
    accessLevel: videoShareLinkAccessEnum("access_level").notNull().default("view"),
    password: text("password"), // hashed, null = no password

    // Limits
    expiresAt: timestamp("expires_at"), // null = never expires
    maxViews: integer("max_views"), // null = unlimited
    viewCount: integer("view_count").default(0),

    // Status
    status: videoShareLinkStatusEnum("status").default("active"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastAccessedAt: timestamp("last_accessed_at"),
  },
  (table) => ({
    videoIdx: index("video_share_links_video_idx").on(table.videoId),
    statusIdx: index("video_share_links_status_idx").on(table.status),
  }),
);

// =====================
// Video Workflow Templates
// =====================

export const workflowTemplateTypeEnum = pgEnum("WorkflowTemplateType", [
  "onboarding",
  "tutorial",
  "meeting_recap",
  "product_demo",
  "training",
  "marketing",
  "custom",
]);

// Predefined workflow templates
export const workflowTemplates = pgTable("workflow_templates", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  type: workflowTemplateTypeEnum("type").default("custom").notNull(),
  icon: text("icon"), // Lucide icon name
  // Template configuration
  config: jsonb("config")
    .$type<{
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
    }>()
    .notNull(),
  // Ownership - null means system template
  organizationId: text("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
  isSystem: boolean("is_system").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  usageCount: integer("usage_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Track which template was used for a video
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
  (table) => ({
    videoIdx: index("video_workflow_history_video_idx").on(table.videoId),
    templateIdx: index("video_workflow_history_template_idx").on(table.templateId),
  }),
);

// =====================
// Video Clips Tables
// =====================

export const clipTypeEnum = pgEnum("ClipType", ["auto", "manual"]);

export const momentTypeEnum = pgEnum("MomentType", [
  "decision",
  "action_item",
  "question",
  "answer",
  "emphasis",
  "demonstration",
  "conclusion",
  "highlight",
]);

export const clipStatusEnum = pgEnum("ClipStatus", ["pending", "processing", "ready", "failed"]);

export const highlightReelStatusEnum = pgEnum("HighlightReelStatus", ["draft", "rendering", "ready", "failed"]);

// Types for JSONB columns in clips
export type ClipMetadata = {
  readonly confidence?: number;
  readonly transcriptExcerpt?: string;
  readonly keywords?: readonly string[];
  readonly speakerInfo?: {
    readonly name?: string;
    readonly speakerSegments?: ReadonlyArray<{ startTime: number; endTime: number }>;
  };
};

export type HighlightReelTransition = {
  readonly type: "fade" | "crossfade" | "cut" | "wipe";
  readonly durationMs: number;
};

export type HighlightReelConfig = {
  readonly transitions?: HighlightReelTransition;
  readonly backgroundMusicId?: string;
  readonly backgroundMusicVolume?: number;
  readonly introTemplate?: string;
  readonly outroTemplate?: string;
};

export type QuoteCardTemplate = {
  readonly templateId: string;
  readonly backgroundColor?: string;
  readonly textColor?: string;
  readonly fontFamily?: string;
  readonly brandingEnabled?: boolean;
};

// Video moments (AI-detected key moments)
export const videoMoments = pgTable(
  "video_moments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    startTime: integer("start_time").notNull(), // seconds
    endTime: integer("end_time").notNull(), // seconds
    momentType: momentTypeEnum("moment_type").notNull(),
    confidence: integer("confidence").notNull().default(0), // 0-100 percentage
    transcriptExcerpt: text("transcript_excerpt"),
    metadata: jsonb("metadata").$type<ClipMetadata>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    videoIdx: index("video_moments_video_idx").on(table.videoId),
    videoStartIdx: index("video_moments_video_start_idx").on(table.videoId, table.startTime),
    momentTypeIdx: index("video_moments_type_idx").on(table.momentType),
  }),
);

// Video clips (extracted segments from videos)
export const videoClips = pgTable(
  "video_clips",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // Source moment (optional - null for manual clips)
    momentId: text("moment_id").references(() => videoMoments.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    startTime: integer("start_time").notNull(), // seconds
    endTime: integer("end_time").notNull(), // seconds
    clipType: clipTypeEnum("clip_type").notNull().default("manual"),
    momentType: momentTypeEnum("moment_type"),
    // Storage
    storageKey: text("storage_key"), // R2 path for generated clip
    thumbnailUrl: text("thumbnail_url"),
    // Processing
    status: clipStatusEnum("status").notNull().default("pending"),
    processingError: text("processing_error"),
    // Metadata
    transcriptExcerpt: text("transcript_excerpt"),
    metadata: jsonb("metadata").$type<ClipMetadata>(),
    // Ownership
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    videoIdx: index("video_clips_video_idx").on(table.videoId),
    videoCreatedIdx: index("video_clips_video_created_idx").on(table.videoId, table.createdAt),
    statusIdx: index("video_clips_status_idx").on(table.status),
    organizationIdx: index("video_clips_org_idx").on(table.organizationId),
  }),
);

// Highlight reels (composed from multiple clips)
export const highlightReels = pgTable(
  "highlight_reels",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    // Clips in order
    clipIds: jsonb("clip_ids").$type<string[]>().notNull().default([]),
    // Storage
    storageKey: text("storage_key"), // R2 path for rendered reel
    thumbnailUrl: text("thumbnail_url"),
    duration: integer("duration"), // total duration in seconds
    // Processing
    status: highlightReelStatusEnum("status").notNull().default("draft"),
    processingError: text("processing_error"),
    // Configuration
    config: jsonb("config").$type<HighlightReelConfig>(),
    // Ownership
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: index("highlight_reels_org_idx").on(table.organizationId),
    statusIdx: index("highlight_reels_status_idx").on(table.status),
    createdByIdx: index("highlight_reels_created_by_idx").on(table.createdBy),
  }),
);

// Quote cards (shareable image quotes from videos)
export const quoteCards = pgTable(
  "quote_cards",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    quoteText: text("quote_text").notNull(),
    speaker: text("speaker"),
    timestampSeconds: integer("timestamp_seconds"),
    // Template styling
    template: jsonb("template").$type<QuoteCardTemplate>(),
    // Generated image
    imageUrl: text("image_url"),
    storageKey: text("storage_key"),
    // Ownership
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    videoIdx: index("quote_cards_video_idx").on(table.videoId),
    organizationIdx: index("quote_cards_org_idx").on(table.organizationId),
  }),
);

// Video Clips Relations
export const videoMomentsRelations = relations(videoMoments, ({ one, many }) => ({
  video: one(videos, {
    fields: [videoMoments.videoId],
    references: [videos.id],
  }),
  organization: one(organizations, {
    fields: [videoMoments.organizationId],
    references: [organizations.id],
  }),
  clips: many(videoClips),
}));

export const videoClipsRelations = relations(videoClips, ({ one }) => ({
  video: one(videos, {
    fields: [videoClips.videoId],
    references: [videos.id],
  }),
  organization: one(organizations, {
    fields: [videoClips.organizationId],
    references: [organizations.id],
  }),
  moment: one(videoMoments, {
    fields: [videoClips.momentId],
    references: [videoMoments.id],
  }),
  creator: one(users, {
    fields: [videoClips.createdBy],
    references: [users.id],
  }),
}));

export const highlightReelsRelations = relations(highlightReels, ({ one }) => ({
  organization: one(organizations, {
    fields: [highlightReels.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [highlightReels.createdBy],
    references: [users.id],
  }),
}));

export const quoteCardsRelations = relations(quoteCards, ({ one }) => ({
  video: one(videos, {
    fields: [quoteCards.videoId],
    references: [videos.id],
  }),
  organization: one(organizations, {
    fields: [quoteCards.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [quoteCards.createdBy],
    references: [users.id],
  }),
}));

// =====================
// Health Check Tables
// =====================

export const healthCheckServiceEnum = pgEnum("HealthCheckService", ["database", "storage", "ai", "overall"]);

export const healthCheckStatusEnum = pgEnum("HealthCheckStatus", [
  "healthy",
  "degraded",
  "unhealthy",
  "not_configured",
]);

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
  (table) => ({
    serviceCheckedAtIdx: index("health_checks_service_checked_at_idx").on(table.service, table.checkedAt),
    statusIdx: index("health_checks_status_idx").on(table.status),
  }),
);

// Health check types
export type HealthCheckService = (typeof healthCheckServiceEnum.enumValues)[number];
export type HealthCheckStatus = (typeof healthCheckStatusEnum.enumValues)[number];
export type HealthCheck = typeof healthChecks.$inferSelect;
export type NewHealthCheck = typeof healthChecks.$inferInsert;

// =====================
// Activity Feed Tables
// =====================

export const activityTypeEnum = pgEnum("ActivityType", [
  "video_uploaded",
  "video_processed",
  "video_shared",
  "comment_added",
  "comment_reply",
  "reaction_added",
  "member_joined",
  "member_left",
  "integration_connected",
  "integration_disconnected",
  "video_imported",
]);

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
  (table) => ({
    orgCreatedIdx: index("activity_feed_org_created_idx").on(table.organizationId, table.createdAt),
    actorIdx: index("activity_feed_actor_idx").on(table.actorId),
    resourceIdx: index("activity_feed_resource_idx").on(table.resourceType, table.resourceId),
  }),
);

// =====================
// Zapier Webhooks Tables
// =====================

export const zapierWebhookEventEnum = pgEnum("ZapierWebhookEvent", [
  "video.uploaded",
  "video.processed",
  "video.shared",
  "comment.created",
  "comment.replied",
  "member.joined",
  "member.left",
]);

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
  (table) => ({
    orgIdx: index("zapier_webhooks_org_idx").on(table.organizationId),
    activeIdx: index("zapier_webhooks_active_idx").on(table.isActive),
  }),
);

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
  (table) => ({
    webhookIdx: index("zapier_webhook_deliveries_webhook_idx").on(table.webhookId),
    createdIdx: index("zapier_webhook_deliveries_created_idx").on(table.createdAt),
  }),
);

// Activity Feed types
export type ActivityType = (typeof activityTypeEnum.enumValues)[number];
export type ActivityFeed = typeof activityFeed.$inferSelect;
export type NewActivityFeed = typeof activityFeed.$inferInsert;

// Zapier Webhook types
export type ZapierWebhookEvent = (typeof zapierWebhookEventEnum.enumValues)[number];
export type ZapierWebhook = typeof zapierWebhooks.$inferSelect;
export type NewZapierWebhook = typeof zapierWebhooks.$inferInsert;
export type ZapierWebhookDelivery = typeof zapierWebhookDeliveries.$inferSelect;
export type NewZapierWebhookDelivery = typeof zapierWebhookDeliveries.$inferInsert;

// Search relations
export const searchHistoryRelations = relations(searchHistory, ({ one }) => ({
  user: one(users, {
    fields: [searchHistory.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [searchHistory.organizationId],
    references: [organizations.id],
  }),
}));

export const savedSearchesRelations = relations(savedSearches, ({ one }) => ({
  user: one(users, {
    fields: [savedSearches.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [savedSearches.organizationId],
    references: [organizations.id],
  }),
}));

// Video Views relations
export const videoViewsRelations = relations(videoViews, ({ one }) => ({
  video: one(videos, {
    fields: [videoViews.videoId],
    references: [videos.id],
  }),
  user: one(users, {
    fields: [videoViews.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [videoViews.organizationId],
    references: [organizations.id],
  }),
}));

// Video Analytics Daily relations
export const videoAnalyticsDailyRelations = relations(videoAnalyticsDaily, ({ one }) => ({
  video: one(videos, {
    fields: [videoAnalyticsDaily.videoId],
    references: [videos.id],
  }),
}));

// Speaker Diarization relations
export const speakerProfilesRelations = relations(speakerProfiles, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [speakerProfiles.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [speakerProfiles.userId],
    references: [users.id],
  }),
  videoSpeakers: many(videoSpeakers),
  analytics: many(speakerAnalytics),
}));

export const videoSpeakersRelations = relations(videoSpeakers, ({ one, many }) => ({
  video: one(videos, {
    fields: [videoSpeakers.videoId],
    references: [videos.id],
  }),
  speakerProfile: one(speakerProfiles, {
    fields: [videoSpeakers.speakerProfileId],
    references: [speakerProfiles.id],
  }),
  segments: many(speakerSegments),
}));

export const speakerSegmentsRelations = relations(speakerSegments, ({ one }) => ({
  video: one(videos, {
    fields: [speakerSegments.videoId],
    references: [videos.id],
  }),
  videoSpeaker: one(videoSpeakers, {
    fields: [speakerSegments.videoSpeakerId],
    references: [videoSpeakers.id],
  }),
}));

export const speakerAnalyticsRelations = relations(speakerAnalytics, ({ one }) => ({
  organization: one(organizations, {
    fields: [speakerAnalytics.organizationId],
    references: [organizations.id],
  }),
  speakerProfile: one(speakerProfiles, {
    fields: [speakerAnalytics.speakerProfileId],
    references: [speakerProfiles.id],
  }),
}));

// Transcript Chunks relations
export const transcriptChunksRelations = relations(transcriptChunks, ({ one }) => ({
  video: one(videos, {
    fields: [transcriptChunks.videoId],
    references: [videos.id],
  }),
  organization: one(organizations, {
    fields: [transcriptChunks.organizationId],
    references: [organizations.id],
  }),
}));

// Video Share Links relations
export const videoShareLinksRelations = relations(videoShareLinks, ({ one }) => ({
  video: one(videos, {
    fields: [videoShareLinks.videoId],
    references: [videos.id],
  }),
  creator: one(users, {
    fields: [videoShareLinks.createdBy],
    references: [users.id],
  }),
}));

// Legal relations
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
    relationName: "ReportReporter",
  }),
  resolvedBy: one(users, {
    fields: [reports.resolvedById],
    references: [users.id],
    relationName: "ReportResolver",
  }),
}));

export const dataExportRequestsRelations = relations(dataExportRequests, ({ one }) => ({
  user: one(users, {
    fields: [dataExportRequests.userId],
    references: [users.id],
  }),
}));

// Activity Feed relations
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

// Zapier Webhook relations
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

// Speaker diarization types
export type SpeakerProfile = typeof speakerProfiles.$inferSelect;
export type NewSpeakerProfile = typeof speakerProfiles.$inferInsert;
export type VideoSpeaker = typeof videoSpeakers.$inferSelect;
export type NewVideoSpeaker = typeof videoSpeakers.$inferInsert;
export type SpeakerSegmentRecord = typeof speakerSegments.$inferSelect;
export type NewSpeakerSegmentRecord = typeof speakerSegments.$inferInsert;
export type SpeakerAnalyticsRecord = typeof speakerAnalytics.$inferSelect;
export type NewSpeakerAnalyticsRecord = typeof speakerAnalytics.$inferInsert;

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
// Better Auth Stripe compatible subscription statuses
export type SubscriptionStatus =
  | "active"
  | "canceled"
  | "past_due"
  | "trialing"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";
export type InvoiceStatus = (typeof invoiceStatusEnum.enumValues)[number];

// Search types
export type SearchHistory = typeof searchHistory.$inferSelect;
export type NewSearchHistory = typeof searchHistory.$inferInsert;
export type SavedSearch = typeof savedSearches.$inferSelect;
export type NewSavedSearch = typeof savedSearches.$inferInsert;

// Authentication types
export type TwoFactor = typeof twoFactors.$inferSelect;
export type NewTwoFactor = typeof twoFactors.$inferInsert;
export type Passkey = typeof passkeys.$inferSelect;
export type NewPasskey = typeof passkeys.$inferInsert;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type NewUserPreferences = typeof userPreferences.$inferInsert;
export type ApiKey = typeof apikeys.$inferSelect;
export type NewApiKey = typeof apikeys.$inferInsert;
// OAuth provider types are managed by better-auth's oauthProvider plugin

// Comment reaction types
export type ReactionType = (typeof reactionTypeEnum.enumValues)[number];
export type CommentReaction = typeof commentReactions.$inferSelect;
export type NewCommentReaction = typeof commentReactions.$inferInsert;

// Watch later types
export type WatchLater = typeof watchLater.$inferSelect;
export type NewWatchLater = typeof watchLater.$inferInsert;

// Presence types
export type UserPresence = typeof userPresence.$inferSelect;
export type NewUserPresence = typeof userPresence.$inferInsert;

// Performance metrics types
export type PerformanceMetric = typeof performanceMetrics.$inferSelect;
export type NewPerformanceMetric = typeof performanceMetrics.$inferInsert;

// Video Views types
export type VideoViewSource = (typeof videoViewSourceEnum.enumValues)[number];
export type VideoView = typeof videoViews.$inferSelect;
export type NewVideoView = typeof videoViews.$inferInsert;

// Video Analytics Daily types
export type VideoAnalyticsDaily = typeof videoAnalyticsDaily.$inferSelect;
export type NewVideoAnalyticsDaily = typeof videoAnalyticsDaily.$inferInsert;

// Video Share Links types
export type VideoShareLinkStatus = (typeof videoShareLinkStatusEnum.enumValues)[number];
export type VideoShareLinkAccess = (typeof videoShareLinkAccessEnum.enumValues)[number];
export type VideoShareLink = typeof videoShareLinks.$inferSelect;
export type NewVideoShareLink = typeof videoShareLinks.$inferInsert;

// Legal compliance types
export type LegalDocumentType = (typeof legalDocumentTypeEnum.enumValues)[number];
export type ConsentAction = (typeof consentActionEnum.enumValues)[number];
export type ReportCategory = (typeof reportCategoryEnum.enumValues)[number];
export type ReportStatus = (typeof reportStatusEnum.enumValues)[number];
export type ReportResolution = (typeof reportResolutionEnum.enumValues)[number];
export type ReportResourceType = (typeof reportResourceTypeEnum.enumValues)[number];

export type LegalConsent = typeof legalConsents.$inferSelect;
export type NewLegalConsent = typeof legalConsents.$inferInsert;
export type ConsentAuditLog = typeof consentAuditLog.$inferSelect;
export type NewConsentAuditLog = typeof consentAuditLog.$inferInsert;
export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
export type DataExportRequest = typeof dataExportRequests.$inferSelect;
export type NewDataExportRequest = typeof dataExportRequests.$inferInsert;

// =====================
// Enterprise Security: SSO/SAML Configuration
// =====================
// SSO is now handled by the Better Auth SSO plugin (@better-auth/sso)
// which manages its own ssoProvider table via migrations

// =====================
// Enterprise Security: Advanced RBAC
// =====================
// RBAC is now handled by Better Auth's organization plugin with access control
// See: src/lib/access-control.ts for permission definitions
// =====================

// =====================
// Enterprise Security: Comprehensive Audit Logs
// =====================

export const auditLogCategoryEnum = pgEnum("AuditLogCategory", [
  "authentication",
  "authorization",
  "user_management",
  "organization_management",
  "content_management",
  "billing",
  "security",
  "integration",
  "system",
]);

export const auditLogSeverityEnum = pgEnum("AuditLogSeverity", ["info", "warning", "error", "critical"]);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // Who performed the action
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    actorEmail: text("actor_email"),
    actorType: text("actor_type").notNull().default("user"), // user, system, api_key, sso
    // Organization context
    organizationId: text("organization_id").references(() => organizations.id, { onDelete: "set null" }),
    // What happened
    category: auditLogCategoryEnum("category").notNull(),
    action: text("action").notNull(), // e.g., "user.login", "video.delete", "role.assign"
    description: text("description"),
    severity: auditLogSeverityEnum("severity").default("info").notNull(),
    // Target resource
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    resourceName: text("resource_name"),
    // Changes (for update operations)
    previousValue: jsonb("previous_value").$type<Record<string, unknown>>(),
    newValue: jsonb("new_value").$type<Record<string, unknown>>(),
    // Request context
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    requestId: text("request_id"),
    sessionId: text("session_id"),
    // Additional metadata
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    actorIdx: index("audit_logs_actor_idx").on(table.actorId),
    orgIdx: index("audit_logs_org_idx").on(table.organizationId),
    categoryIdx: index("audit_logs_category_idx").on(table.category),
    actionIdx: index("audit_logs_action_idx").on(table.action),
    resourceIdx: index("audit_logs_resource_idx").on(table.resourceType, table.resourceId),
    createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
    // Composite index for common queries
    orgCreatedIdx: index("audit_logs_org_created_idx").on(table.organizationId, table.createdAt),
  }),
);

// Audit log export requests
export const auditLogExports = pgTable(
  "audit_log_exports",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    requestedBy: text("requested_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    format: text("format").notNull().default("csv"), // csv, json, pdf
    status: text("status").notNull().default("pending"), // pending, processing, completed, failed
    filters: jsonb("filters").$type<{
      startDate?: string;
      endDate?: string;
      categories?: string[];
      actions?: string[];
      actorIds?: string[];
      severity?: string[];
    }>(),
    downloadUrl: text("download_url"),
    expiresAt: timestamp("expires_at"),
    errorMessage: text("error_message"),
    recordCount: integer("record_count"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    orgIdx: index("audit_log_exports_org_idx").on(table.organizationId),
    statusIdx: index("audit_log_exports_status_idx").on(table.status),
  }),
);

// Workflow template relations
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

// Workflow template types
export type WorkflowTemplateType = (typeof workflowTemplateTypeEnum.enumValues)[number];
export type WorkflowTemplate = typeof workflowTemplates.$inferSelect;
export type NewWorkflowTemplate = typeof workflowTemplates.$inferInsert;
export type VideoWorkflowHistory = typeof videoWorkflowHistory.$inferSelect;
export type NewVideoWorkflowHistory = typeof videoWorkflowHistory.$inferInsert;

// Audit Log Relations
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

// Enterprise Security Types
// SSO types are now managed by @better-auth/sso plugin
// RBAC types are now exported from @/lib/access-control

export type AuditLogCategory = (typeof auditLogCategoryEnum.enumValues)[number];
export type AuditLogSeverity = (typeof auditLogSeverityEnum.enumValues)[number];
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type AuditLogExport = typeof auditLogExports.$inferSelect;
export type NewAuditLogExport = typeof auditLogExports.$inferInsert;

// Video Clips Types
export type ClipType = (typeof clipTypeEnum.enumValues)[number];
export type MomentType = (typeof momentTypeEnum.enumValues)[number];
export type ClipStatus = (typeof clipStatusEnum.enumValues)[number];
export type HighlightReelStatus = (typeof highlightReelStatusEnum.enumValues)[number];

export type VideoMoment = typeof videoMoments.$inferSelect;
export type NewVideoMoment = typeof videoMoments.$inferInsert;
export type VideoClip = typeof videoClips.$inferSelect;
export type NewVideoClip = typeof videoClips.$inferInsert;
export type HighlightReel = typeof highlightReels.$inferSelect;
export type NewHighlightReel = typeof highlightReels.$inferInsert;
export type QuoteCard = typeof quoteCards.$inferSelect;
export type NewQuoteCard = typeof quoteCards.$inferInsert;

// Semantic Search Types
export type TranscriptChunk = typeof transcriptChunks.$inferSelect;
export type NewTranscriptChunk = typeof transcriptChunks.$inferInsert;
