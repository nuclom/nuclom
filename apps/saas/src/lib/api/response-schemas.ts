/**
 * API Response Schemas
 *
 * These schemas define the shape of API responses and are used by:
 * 1. API routes for type-safe responses
 * 2. OpenAPI spec generator for documentation
 *
 * Reference these schemas in route JSDoc annotations:
 * @response 200 Video - Video details
 */

import { Schema } from 'effect';

// =============================================================================
// Common Response Schemas
// =============================================================================

export const ErrorResponse = Schema.Struct({
  error: Schema.String,
  code: Schema.String,
  details: Schema.optional(Schema.Unknown),
});

export const SuccessResponse = Schema.Struct({
  success: Schema.Boolean,
  message: Schema.optional(Schema.String),
});

export const PaginationMeta = Schema.Struct({
  page: Schema.Number,
  limit: Schema.Number,
  total: Schema.Number,
  totalPages: Schema.Number,
});

export const HealthResponse = Schema.Struct({
  status: Schema.String,
  timestamp: Schema.String,
});

// =============================================================================
// User Schemas
// =============================================================================

export const UserSummary = Schema.Struct({
  id: Schema.UUID,
  name: Schema.String,
  image: Schema.NullOr(Schema.String),
});

export const UserWithEmail = UserSummary.pipe(Schema.extend(Schema.Struct({ email: Schema.String })));

// =============================================================================
// Video Schemas
// =============================================================================

export const Video = Schema.Struct({
  id: Schema.UUID,
  title: Schema.String,
  description: Schema.NullOr(Schema.String),
  duration: Schema.String,
  thumbnailUrl: Schema.NullOr(Schema.String),
  videoUrl: Schema.NullOr(Schema.String),
  authorId: Schema.UUID,
  organizationId: Schema.UUID,
  channelId: Schema.NullOr(Schema.UUID),
  collectionId: Schema.NullOr(Schema.UUID),
  transcript: Schema.NullOr(Schema.String),
  aiSummary: Schema.NullOr(Schema.String),
  viewCount: Schema.Number,
  isPublic: Schema.Boolean,
  isDeleted: Schema.Boolean,
  deletedAt: Schema.NullOr(Schema.String),
  retentionUntil: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
});

export const VideoWithDetails = Video.pipe(
  Schema.extend(
    Schema.Struct({
      author: Schema.optional(UserSummary),
      chapters: Schema.optional(Schema.Array(Schema.Unknown)),
    }),
  ),
);

export const PaginatedVideos = Schema.Struct({
  data: Schema.Array(Video),
  pagination: PaginationMeta,
});

export const VideoDeleteResponse = Schema.Struct({
  success: Schema.Boolean,
  data: Schema.Struct({
    message: Schema.String,
    deletedAt: Schema.optional(Schema.String),
    retentionUntil: Schema.optional(Schema.String),
  }),
});

// =============================================================================
// Series Schemas
// =============================================================================

export const Series = Schema.Struct({
  id: Schema.UUID,
  name: Schema.String,
  description: Schema.NullOr(Schema.String),
  thumbnailUrl: Schema.NullOr(Schema.String),
  organizationId: Schema.UUID,
  isPublic: Schema.Boolean,
  videoCount: Schema.Number,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});

export const SeriesWithVideos = Series.pipe(Schema.extend(Schema.Struct({ videos: Schema.Array(Video) })));

export const PaginatedSeries = Schema.Struct({
  data: Schema.Array(Series),
  pagination: PaginationMeta,
});

// =============================================================================
// Chapter Schemas
// =============================================================================

export const Chapter = Schema.Struct({
  id: Schema.UUID,
  title: Schema.String,
  summary: Schema.NullOr(Schema.String),
  startTime: Schema.Number,
  endTime: Schema.NullOr(Schema.Number),
  videoId: Schema.UUID,
  createdAt: Schema.String,
});

export const ChapterList = Schema.Array(Chapter);

// =============================================================================
// Organization Schemas
// =============================================================================

export const Organization = Schema.Struct({
  id: Schema.UUID,
  name: Schema.String,
  slug: Schema.String,
  description: Schema.NullOr(Schema.String),
  logo: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
});

export const OrganizationMember = Schema.Struct({
  id: Schema.UUID,
  organizationId: Schema.UUID,
  userId: Schema.UUID,
  role: Schema.Literal('owner', 'member'),
  user: Schema.optional(UserWithEmail),
  createdAt: Schema.String,
});

export const OrganizationList = Schema.Array(Organization);
export const OrganizationMemberList = Schema.Array(OrganizationMember);

// =============================================================================
// Notification Schemas
// =============================================================================

export const Notification = Schema.Struct({
  id: Schema.UUID,
  type: Schema.String,
  title: Schema.String,
  message: Schema.String,
  read: Schema.Boolean,
  userId: Schema.UUID,
  data: Schema.optional(Schema.Unknown),
  createdAt: Schema.String,
});

export const PaginatedNotifications = Schema.Struct({
  data: Schema.Array(Notification),
  pagination: PaginationMeta,
  unreadCount: Schema.Number,
});

// =============================================================================
// Billing Schemas
// =============================================================================

export const BillingPlan = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.String,
  price: Schema.Struct({ monthly: Schema.Number, yearly: Schema.Number }),
  features: Schema.Array(Schema.String),
  limits: Schema.Struct({
    videos: Schema.Number,
    storage: Schema.Number,
    members: Schema.Number,
  }),
});

export const Subscription = Schema.Struct({
  id: Schema.String,
  planId: Schema.String,
  status: Schema.String,
  currentPeriodStart: Schema.String,
  currentPeriodEnd: Schema.String,
  cancelAtPeriodEnd: Schema.Boolean,
});

export const BillingUsage = Schema.Struct({
  videos: Schema.Struct({ used: Schema.Number, limit: Schema.Number }),
  storage: Schema.Struct({ used: Schema.Number, limit: Schema.Number }),
  members: Schema.Struct({ used: Schema.Number, limit: Schema.Number }),
});

export const CheckoutResponse = Schema.Struct({
  sessionId: Schema.String,
  url: Schema.String,
});

export const BillingPlanList = Schema.Array(BillingPlan);

// =============================================================================
// Search Schemas
// =============================================================================

export const SearchResult = Schema.Struct({
  type: Schema.Literal('video', 'series', 'channel'),
  id: Schema.UUID,
  title: Schema.String,
  description: Schema.NullOr(Schema.String),
  thumbnailUrl: Schema.NullOr(Schema.String),
  score: Schema.Number,
  highlights: Schema.optional(Schema.Array(Schema.String)),
});

export const SearchResponse = Schema.Struct({
  results: Schema.Array(SearchResult),
  pagination: PaginationMeta,
  query: Schema.String,
});

// =============================================================================
// AI Schemas
// =============================================================================

export const AIAnalysisResult = Schema.Struct({
  videoId: Schema.UUID,
  transcript: Schema.optional(Schema.String),
  summary: Schema.optional(Schema.String),
  actionItems: Schema.optional(Schema.Array(Schema.String)),
  tags: Schema.optional(Schema.Array(Schema.String)),
  processingTime: Schema.Number,
});

// =============================================================================
// Integration Schemas
// =============================================================================

export const IntegrationStatus = Schema.Struct({
  connected: Schema.Boolean,
  accountEmail: Schema.optional(Schema.String),
  connectedAt: Schema.optional(Schema.String),
});

export const MeetingRecording = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  startTime: Schema.String,
  duration: Schema.Number,
  downloadUrl: Schema.optional(Schema.String),
});

export const MeetingRecordingList = Schema.Array(MeetingRecording);

// =============================================================================
// Clip Schemas
// =============================================================================

export const Clip = Schema.Struct({
  id: Schema.UUID,
  title: Schema.String,
  description: Schema.NullOr(Schema.String),
  startTime: Schema.Number,
  endTime: Schema.Number,
  videoId: Schema.UUID,
  status: Schema.Literal('pending', 'processing', 'ready', 'failed'),
  clipUrl: Schema.NullOr(Schema.String),
  thumbnailUrl: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
});

export const ClipList = Schema.Array(Clip);

export const HighlightReel = Schema.Struct({
  id: Schema.UUID,
  title: Schema.String,
  description: Schema.NullOr(Schema.String),
  status: Schema.Literal('draft', 'rendering', 'ready', 'failed'),
  videoUrl: Schema.NullOr(Schema.String),
  thumbnailUrl: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
});
