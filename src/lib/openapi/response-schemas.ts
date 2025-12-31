/**
 * Response Schemas for OpenAPI Generation
 *
 * These schemas define the response types for API endpoints,
 * complementing the request validation schemas.
 */
import { Schema } from "effect";

// =============================================================================
// Common Response Types
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

// =============================================================================
// Health
// =============================================================================

export const HealthResponse = Schema.Struct({
  status: Schema.String,
  timestamp: Schema.String,
});

// =============================================================================
// Video Types
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
      author: Schema.optional(
        Schema.Struct({
          id: Schema.UUID,
          name: Schema.String,
          image: Schema.NullOr(Schema.String),
        }),
      ),
      comments: Schema.optional(Schema.Array(Schema.Unknown)),
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
// Series Types
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

export const SeriesWithVideos = Series.pipe(
  Schema.extend(
    Schema.Struct({
      videos: Schema.Array(Video),
    }),
  ),
);

export const PaginatedSeries = Schema.Struct({
  data: Schema.Array(Series),
  pagination: PaginationMeta,
});

// =============================================================================
// Comment Types
// =============================================================================

export const Comment = Schema.Struct({
  id: Schema.UUID,
  content: Schema.String,
  timestamp: Schema.NullOr(Schema.String),
  videoId: Schema.UUID,
  authorId: Schema.UUID,
  parentId: Schema.NullOr(Schema.UUID),
  author: Schema.optional(
    Schema.Struct({
      id: Schema.UUID,
      name: Schema.String,
      image: Schema.NullOr(Schema.String),
    }),
  ),
  replies: Schema.optional(Schema.Array(Schema.Unknown)),
  reactions: Schema.optional(Schema.Array(Schema.Unknown)),
  createdAt: Schema.String,
  updatedAt: Schema.String,
});

// =============================================================================
// Chapter Types
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

// =============================================================================
// Code Snippet Types
// =============================================================================

export const CodeSnippet = Schema.Struct({
  id: Schema.UUID,
  code: Schema.String,
  language: Schema.NullOr(Schema.String),
  title: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
  timestamp: Schema.NullOr(Schema.Number),
  videoId: Schema.UUID,
  createdAt: Schema.String,
});

// =============================================================================
// Organization Types
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
  role: Schema.Literal("owner", "member"),
  user: Schema.optional(
    Schema.Struct({
      id: Schema.UUID,
      name: Schema.String,
      email: Schema.String,
      image: Schema.NullOr(Schema.String),
    }),
  ),
  createdAt: Schema.String,
});

// =============================================================================
// Notification Types
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
// Billing Types
// =============================================================================

export const BillingPlan = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.String,
  price: Schema.Struct({
    monthly: Schema.Number,
    yearly: Schema.Number,
  }),
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
  videos: Schema.Struct({
    used: Schema.Number,
    limit: Schema.Number,
  }),
  storage: Schema.Struct({
    used: Schema.Number,
    limit: Schema.Number,
  }),
  members: Schema.Struct({
    used: Schema.Number,
    limit: Schema.Number,
  }),
});

export const CheckoutResponse = Schema.Struct({
  sessionId: Schema.String,
  url: Schema.String,
});

// =============================================================================
// Search Types
// =============================================================================

export const SearchResult = Schema.Struct({
  type: Schema.Literal("video", "series", "channel"),
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
// AI Types
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
// Integration Types
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
