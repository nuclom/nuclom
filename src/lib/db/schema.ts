import { relations } from "drizzle-orm";
import { bigint, boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

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
  // Security: Track password changes for session revocation
  passwordChangedAt: timestamp("password_changed_at"),
  // Security: Maximum concurrent sessions allowed (null = use default)
  maxSessions: integer("max_sessions"),
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
  // Session fingerprint for security (hash of IP + user agent)
  fingerprint: text("fingerprint"),
  // Track last validated fingerprint to detect session hijacking
  lastFingerprintCheck: timestamp("last_fingerprint_check"),
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

// Two-Factor Authentication tables
export const twoFactors = pgTable("two_factors", {
  id: text("id").primaryKey(),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
});

// Passkeys/WebAuthn table
export const passkeys = pgTable("passkeys", {
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
});

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
  // Collections remain if creator is deleted, just clear the reference
  createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
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
    // If the video is deleted, clear the last watched reference
    lastVideoId: text("last_video_id").references(() => videos.id, { onDelete: "set null" }),
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
export const integrationProviderEnum = pgEnum("IntegrationProvider", [
  "zoom",
  "google_meet",
  "slack",
  "microsoft_teams",
]);

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
// GitHub Context Integration
// =====================

export const codeLinkTypeEnum = pgEnum("CodeLinkType", [
  "pr",
  "issue",
  "commit",
  "file",
  "directory",
]);

// Cached repository info for connected repos
export type GitHubRepositoryInfo = {
  readonly id: number;
  readonly name: string;
  readonly fullName: string;
  readonly private: boolean;
  readonly defaultBranch: string;
  readonly updatedAt: string;
};

// GitHub connections at the organization level
export const githubConnections = pgTable(
  "github_connections",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // GitHub App installation ID (if using GitHub App)
    installationId: text("installation_id"),
    // User who connected the integration
    connectedByUserId: text("connected_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Access tokens for API calls (stored encrypted in production)
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    tokenExpiresAt: timestamp("token_expires_at"),
    // Cached list of accessible repositories
    repositories: jsonb("repositories").$type<GitHubRepositoryInfo[]>(),
    // Additional scopes granted
    scopes: text("scopes"),
    // Connection metadata
    connectedAt: timestamp("connected_at").defaultNow().notNull(),
    lastSyncAt: timestamp("last_sync_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("github_connections_org_idx").on(table.organizationId),
    // One connection per organization
    uniqueOrg: unique().on(table.organizationId),
  }),
);

// Video code reference metadata
export type CodeLinkMetadata = {
  // PR/Issue metadata
  readonly title?: string;
  readonly state?: string; // "open", "closed", "merged"
  readonly author?: string;
  readonly createdAt?: string;
  // Commit metadata
  readonly message?: string;
  readonly sha?: string;
  // File metadata
  readonly lineStart?: number;
  readonly lineEnd?: number;
  readonly language?: string;
};

// Links between videos and code artifacts (PRs, issues, commits, files)
export const codeLinks = pgTable(
  "code_links",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    // Type of code artifact
    linkType: codeLinkTypeEnum("link_type").notNull(),
    // GitHub repository (format: "owner/repo")
    githubRepo: text("github_repo").notNull(),
    // Reference to the artifact (PR number, commit SHA, file path, etc.)
    githubRef: text("github_ref").notNull(),
    // Full GitHub URL
    githubUrl: text("github_url"),
    // User-provided context for why this is linked
    context: text("context"),
    // Whether this was auto-detected from transcript
    autoDetected: boolean("auto_detected").default(false).notNull(),
    // Confidence score for auto-detected links (0-1)
    confidence: integer("confidence"),
    // Video timestamp where the reference was detected (in seconds)
    timestampStart: integer("timestamp_start"),
    timestampEnd: integer("timestamp_end"),
    // Cached metadata from GitHub API
    metadata: jsonb("metadata").$type<CodeLinkMetadata>(),
    // User who created the link (null if auto-detected)
    createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    videoIdx: index("code_links_video_idx").on(table.videoId),
    repoIdx: index("code_links_repo_idx").on(table.githubRepo),
    typeIdx: index("code_links_type_idx").on(table.linkType),
    // Index for querying by repo + type + ref
    repoTypeRefIdx: index("code_links_repo_type_ref_idx").on(table.githubRepo, table.linkType, table.githubRef),
    // Unique constraint: one link per video + type + repo + ref
    uniqueLink: unique().on(table.videoId, table.linkType, table.githubRepo, table.githubRef),
  }),
);

// Relations for GitHub connections
export const githubConnectionsRelations = relations(githubConnections, ({ one }) => ({
  organization: one(organizations, {
    fields: [githubConnections.organizationId],
    references: [organizations.id],
  }),
  connectedByUser: one(users, {
    fields: [githubConnections.connectedByUserId],
    references: [users.id],
  }),
}));

// Relations for code links
export const codeLinksRelations = relations(codeLinks, ({ one }) => ({
  video: one(videos, {
    fields: [codeLinks.videoId],
    references: [videos.id],
  }),
  createdByUser: one(users, {
    fields: [codeLinks.createdByUserId],
    references: [users.id],
  }),
}));

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
    plan: text("plan").notNull(), // Plan name (e.g., "pro", "enterprise")
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

// Relations
export const userRelations = relations(users, ({ one, many }) => ({
  videos: many(videos),
  comments: many(comments),
  videoProgresses: many(videoProgresses),
  twoFactor: one(twoFactors),
  passkeys: many(passkeys),
  preferences: one(userPreferences),
  apiKeys: many(apikeys),
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
  codeLinks: many(codeLinks),
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

// Processing status type
export type ProcessingStatus = (typeof processingStatusEnum.enumValues)[number];

// Integration types
export type IntegrationProvider = (typeof integrationProviderEnum.enumValues)[number];
export type ImportStatus = (typeof importStatusEnum.enumValues)[number];
export type Integration = typeof integrations.$inferSelect;
export type NewIntegration = typeof integrations.$inferInsert;
export type ImportedMeeting = typeof importedMeetings.$inferSelect;
export type NewImportedMeeting = typeof importedMeetings.$inferInsert;

// GitHub Context types
export type CodeLinkType = (typeof codeLinkTypeEnum.enumValues)[number];
export type GitHubConnection = typeof githubConnections.$inferSelect;
export type NewGitHubConnection = typeof githubConnections.$inferInsert;
export type CodeLink = typeof codeLinks.$inferSelect;
export type NewCodeLink = typeof codeLinks.$inferInsert;

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
export type OAuthApplication = typeof oauthApplications.$inferSelect;
export type NewOAuthApplication = typeof oauthApplications.$inferInsert;
export type OAuthAccessToken = typeof oauthAccessTokens.$inferSelect;
export type NewOAuthAccessToken = typeof oauthAccessTokens.$inferInsert;
export type OAuthConsent = typeof oauthConsents.$inferSelect;
export type NewOAuthConsent = typeof oauthConsents.$inferInsert;

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

export const ssoProviderTypeEnum = pgEnum("SSOProviderType", ["saml", "oidc"]);

export const ssoConfigurations = pgTable(
  "sso_configurations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" })
      .unique(),
    providerType: ssoProviderTypeEnum("provider_type").notNull(),
    enabled: boolean("enabled").default(false).notNull(),
    // SAML specific fields
    entityId: text("entity_id"), // SP Entity ID
    ssoUrl: text("sso_url"), // IdP SSO URL
    sloUrl: text("slo_url"), // IdP Single Logout URL
    certificate: text("certificate"), // IdP X.509 Certificate
    // OIDC specific fields
    issuer: text("issuer"),
    clientId: text("client_id"),
    clientSecret: text("client_secret"),
    discoveryUrl: text("discovery_url"),
    // Common settings
    autoProvision: boolean("auto_provision").default(true).notNull(),
    defaultRole: organizationRoleEnum("default_role").default("member").notNull(),
    allowedDomains: jsonb("allowed_domains").$type<string[]>(),
    attributeMapping: jsonb("attribute_mapping").$type<{
      email?: string;
      name?: string;
      firstName?: string;
      lastName?: string;
      groups?: string;
    }>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("sso_configurations_org_idx").on(table.organizationId),
  }),
);

export const ssoSessions = pgTable(
  "sso_sessions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    ssoConfigId: text("sso_config_id")
      .notNull()
      .references(() => ssoConfigurations.id, { onDelete: "cascade" }),
    externalUserId: text("external_user_id").notNull(),
    nameId: text("name_id"), // SAML NameID
    sessionIndex: text("session_index"), // SAML Session Index
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    sessionIdx: index("sso_sessions_session_idx").on(table.sessionId),
  }),
);

// =====================
// Enterprise Security: Advanced RBAC
// =====================

// Permission actions enum
export const permissionActionEnum = pgEnum("PermissionAction", [
  "create",
  "read",
  "update",
  "delete",
  "share",
  "comment",
  "download",
  "manage",
  "invite",
  "admin",
]);

// Resource types for permissions
export const permissionResourceEnum = pgEnum("PermissionResource", [
  "video",
  "channel",
  "collection",
  "comment",
  "member",
  "settings",
  "billing",
  "analytics",
  "integration",
  "audit_log",
]);

// Custom roles per organization
export const customRoles = pgTable(
  "custom_roles",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    color: text("color"), // For UI display
    isDefault: boolean("is_default").default(false).notNull(),
    isSystemRole: boolean("is_system_role").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("custom_roles_org_idx").on(table.organizationId),
    uniqueOrgName: unique("custom_roles_org_name_unique").on(table.organizationId, table.name),
  }),
);

// Role permissions - what actions a role can perform on resources
export const rolePermissions = pgTable(
  "role_permissions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    roleId: text("role_id")
      .notNull()
      .references(() => customRoles.id, { onDelete: "cascade" }),
    resource: permissionResourceEnum("resource").notNull(),
    action: permissionActionEnum("action").notNull(),
    conditions: jsonb("conditions").$type<{
      ownOnly?: boolean; // Only own resources
      channelIds?: string[]; // Specific channels
      collectionIds?: string[]; // Specific collections
    }>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    roleIdx: index("role_permissions_role_idx").on(table.roleId),
    uniqueRoleResourceAction: unique("role_permissions_unique").on(table.roleId, table.resource, table.action),
  }),
);

// User role assignments (custom roles)
export const userRoleAssignments = pgTable(
  "user_role_assignments",
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
    roleId: text("role_id")
      .notNull()
      .references(() => customRoles.id, { onDelete: "cascade" }),
    assignedBy: text("assigned_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userOrgIdx: index("user_role_assignments_user_org_idx").on(table.userId, table.organizationId),
    uniqueUserOrgRole: unique("user_role_assignments_unique").on(table.userId, table.organizationId, table.roleId),
  }),
);

// Resource-level permissions (for specific videos, channels, etc.)
export const resourcePermissions = pgTable(
  "resource_permissions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    resourceType: permissionResourceEnum("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    roleId: text("role_id").references(() => customRoles.id, { onDelete: "cascade" }),
    action: permissionActionEnum("action").notNull(),
    grantedBy: text("granted_by").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    resourceIdx: index("resource_permissions_resource_idx").on(table.resourceType, table.resourceId),
    userIdx: index("resource_permissions_user_idx").on(table.userId),
    roleIdx: index("resource_permissions_role_idx").on(table.roleId),
  }),
);

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

// =====================
// Enterprise Security: Multi-Region Storage
// =====================

export const storageRegionEnum = pgEnum("StorageRegion", [
  "us-east-1",
  "us-west-2",
  "eu-west-1",
  "eu-central-1",
  "ap-southeast-1",
  "ap-northeast-1",
  "auto",
]);

export const organizationStorageConfigs = pgTable(
  "organization_storage_configs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" })
      .unique(),
    primaryRegion: storageRegionEnum("primary_region").default("auto").notNull(),
    replicationRegions: jsonb("replication_regions").$type<string[]>(),
    dataResidency: text("data_residency"), // e.g., "EU", "US", "APAC"
    encryptionKeyId: text("encryption_key_id"), // Customer-managed encryption key
    retentionDays: integer("retention_days").default(30), // Default retention for deleted content
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("org_storage_configs_org_idx").on(table.organizationId),
  }),
);

// Track file locations across regions
export const fileRegionLocations = pgTable(
  "file_region_locations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    fileKey: text("file_key").notNull(),
    region: storageRegionEnum("region").notNull(),
    bucketName: text("bucket_name").notNull(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    replicationStatus: text("replication_status").default("pending"), // pending, synced, failed
    lastSyncedAt: timestamp("last_synced_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    fileKeyIdx: index("file_region_locations_file_key_idx").on(table.fileKey),
    orgIdx: index("file_region_locations_org_idx").on(table.organizationId),
    uniqueFileRegion: unique("file_region_locations_unique").on(table.fileKey, table.region),
  }),
);

// SSO Relations
export const ssoConfigurationsRelations = relations(ssoConfigurations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [ssoConfigurations.organizationId],
    references: [organizations.id],
  }),
  sessions: many(ssoSessions),
}));

export const ssoSessionsRelations = relations(ssoSessions, ({ one }) => ({
  session: one(sessions, {
    fields: [ssoSessions.sessionId],
    references: [sessions.id],
  }),
  ssoConfig: one(ssoConfigurations, {
    fields: [ssoSessions.ssoConfigId],
    references: [ssoConfigurations.id],
  }),
}));

// RBAC Relations
export const customRolesRelations = relations(customRoles, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [customRoles.organizationId],
    references: [organizations.id],
  }),
  permissions: many(rolePermissions),
  userAssignments: many(userRoleAssignments),
  resourcePermissions: many(resourcePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(customRoles, {
    fields: [rolePermissions.roleId],
    references: [customRoles.id],
  }),
}));

export const userRoleAssignmentsRelations = relations(userRoleAssignments, ({ one }) => ({
  user: one(users, {
    fields: [userRoleAssignments.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [userRoleAssignments.organizationId],
    references: [organizations.id],
  }),
  role: one(customRoles, {
    fields: [userRoleAssignments.roleId],
    references: [customRoles.id],
  }),
  assignedByUser: one(users, {
    fields: [userRoleAssignments.assignedBy],
    references: [users.id],
  }),
}));

export const resourcePermissionsRelations = relations(resourcePermissions, ({ one }) => ({
  organization: one(organizations, {
    fields: [resourcePermissions.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [resourcePermissions.userId],
    references: [users.id],
  }),
  role: one(customRoles, {
    fields: [resourcePermissions.roleId],
    references: [customRoles.id],
  }),
  grantedByUser: one(users, {
    fields: [resourcePermissions.grantedBy],
    references: [users.id],
  }),
}));

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

// Storage Config Relations
export const organizationStorageConfigsRelations = relations(organizationStorageConfigs, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationStorageConfigs.organizationId],
    references: [organizations.id],
  }),
}));

export const fileRegionLocationsRelations = relations(fileRegionLocations, ({ one }) => ({
  organization: one(organizations, {
    fields: [fileRegionLocations.organizationId],
    references: [organizations.id],
  }),
}));

// Enterprise Security Types
export type SSOProviderType = (typeof ssoProviderTypeEnum.enumValues)[number];
export type SSOConfiguration = typeof ssoConfigurations.$inferSelect;
export type NewSSOConfiguration = typeof ssoConfigurations.$inferInsert;
export type SSOSession = typeof ssoSessions.$inferSelect;
export type NewSSOSession = typeof ssoSessions.$inferInsert;

export type PermissionAction = (typeof permissionActionEnum.enumValues)[number];
export type PermissionResource = (typeof permissionResourceEnum.enumValues)[number];
export type CustomRole = typeof customRoles.$inferSelect;
export type NewCustomRole = typeof customRoles.$inferInsert;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type NewRolePermission = typeof rolePermissions.$inferInsert;
export type UserRoleAssignment = typeof userRoleAssignments.$inferSelect;
export type NewUserRoleAssignment = typeof userRoleAssignments.$inferInsert;
export type ResourcePermission = typeof resourcePermissions.$inferSelect;
export type NewResourcePermission = typeof resourcePermissions.$inferInsert;

export type AuditLogCategory = (typeof auditLogCategoryEnum.enumValues)[number];
export type AuditLogSeverity = (typeof auditLogSeverityEnum.enumValues)[number];
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type AuditLogExport = typeof auditLogExports.$inferSelect;
export type NewAuditLogExport = typeof auditLogExports.$inferInsert;

export type StorageRegion = (typeof storageRegionEnum.enumValues)[number];
export type OrganizationStorageConfig = typeof organizationStorageConfigs.$inferSelect;
export type NewOrganizationStorageConfig = typeof organizationStorageConfigs.$inferInsert;
export type FileRegionLocation = typeof fileRegionLocations.$inferSelect;
export type NewFileRegionLocation = typeof fileRegionLocations.$inferInsert;
