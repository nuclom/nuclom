/**
 * API Endpoint Definitions
 *
 * Declarative endpoint definitions that reference Effect Schemas.
 * These definitions are used to generate the OpenAPI specification automatically.
 */
import { Schema } from "effect";
import * as RequestSchemas from "@/lib/validation/schemas";
import type { ApiEndpoint, ApiInfo, ApiServer, ApiTag } from "./generator";
import * as ResponseSchemas from "./response-schemas";

// =============================================================================
// API Metadata
// =============================================================================

export const apiInfo: ApiInfo = {
  title: "Nuclom API",
  version: "1.0.0",
  description:
    "Nuclom is a video collaboration platform that helps teams organize, share, and collaborate on video content. This API provides programmatic access to videos, organizations, series, comments, and more.",
  contact: {
    name: "Nuclom Support",
    url: "https://nuclom.com/support",
  },
  license: {
    name: "Elastic License 2.0",
    url: "https://www.elastic.co/licensing/elastic-license",
  },
};

export const apiServers: ApiServer[] = [
  {
    url: "https://nuclom.com/api",
    description: "Production server",
  },
  {
    url: "http://localhost:3000/api",
    description: "Local development server",
  },
];

export const apiTags: ApiTag[] = [
  { name: "Videos", description: "Video management endpoints" },
  { name: "Series", description: "Video series/playlist management" },
  { name: "Channels", description: "Channel management" },
  { name: "Organizations", description: "Organization and team management" },
  { name: "Comments", description: "Video comments and discussions" },
  { name: "Search", description: "Search functionality" },
  { name: "Notifications", description: "User notifications" },
  { name: "Billing", description: "Subscription and billing management" },
  { name: "AI", description: "AI-powered video analysis" },
  { name: "Integrations", description: "Third-party integrations (Google Meet, Zoom)" },
  { name: "Health", description: "System health endpoints" },
];

// =============================================================================
// Common Schemas for Parameters
// =============================================================================

const UuidParam = Schema.UUID;
// For query parameters, we use the base schema (not optionalWith which is for struct properties)
const PageParam = Schema.NumberFromString.pipe(Schema.int(), Schema.positive());
const LimitParam = Schema.NumberFromString.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(1),
  Schema.lessThanOrEqualTo(100),
);

// =============================================================================
// Health Endpoints
// =============================================================================

const healthEndpoints: ApiEndpoint[] = [
  {
    path: "/health",
    method: "get",
    operationId: "healthCheck",
    summary: "Health check",
    description: "Check if the API is running and healthy",
    tags: ["Health"],
    responses: {
      "200": {
        description: "API is healthy",
        schema: ResponseSchemas.HealthResponse,
      },
    },
  },
];

// =============================================================================
// Video Endpoints
// =============================================================================

const videoEndpoints: ApiEndpoint[] = [
  {
    path: "/videos",
    method: "get",
    operationId: "listVideos",
    summary: "List videos",
    description: "Get a paginated list of videos for an organization",
    tags: ["Videos"],
    security: true,
    parameters: [
      { name: "organizationId", in: "query", required: true, schema: UuidParam, description: "Organization ID" },
      { name: "page", in: "query", schema: PageParam, description: "Page number" },
      { name: "limit", in: "query", schema: LimitParam, description: "Items per page" },
    ],
    responses: {
      "200": { description: "List of videos", schema: ResponseSchemas.PaginatedVideos },
      "401": { description: "Unauthorized" },
      "400": { description: "Invalid request parameters" },
    },
  },
  {
    path: "/videos",
    method: "post",
    operationId: "createVideo",
    summary: "Create video",
    description: "Create a new video entry",
    tags: ["Videos"],
    security: true,
    requestBody: {
      description: "Video creation data",
      schema: RequestSchemas.CreateVideoSchema,
    },
    responses: {
      "201": { description: "Video created", schema: ResponseSchemas.Video },
      "400": { description: "Invalid request body" },
      "401": { description: "Unauthorized" },
    },
  },
  {
    path: "/videos/upload",
    method: "post",
    operationId: "uploadVideo",
    summary: "Upload video",
    description: "Upload a video file with metadata",
    tags: ["Videos"],
    security: true,
    requestBody: {
      description: "Video file and metadata",
      schema: RequestSchemas.VideoUploadSchema,
      contentType: "multipart/form-data",
    },
    responses: {
      "201": { description: "Video uploaded successfully", schema: ResponseSchemas.Video },
      "400": { description: "Invalid request" },
      "401": { description: "Unauthorized" },
      "413": { description: "File too large" },
    },
  },
  {
    path: "/videos/search",
    method: "get",
    operationId: "searchVideos",
    summary: "Search videos",
    description: "Full-text search across video titles, descriptions, and transcripts",
    tags: ["Videos", "Search"],
    security: true,
    parameters: [
      { name: "q", in: "query", required: true, schema: Schema.String, description: "Search query" },
      { name: "organizationId", in: "query", required: true, schema: UuidParam, description: "Organization ID" },
      { name: "page", in: "query", schema: PageParam, description: "Page number" },
      { name: "limit", in: "query", schema: LimitParam, description: "Items per page" },
    ],
    responses: {
      "200": { description: "Search results", schema: ResponseSchemas.SearchResponse },
      "400": { description: "Invalid query" },
      "401": { description: "Unauthorized" },
    },
  },
  {
    path: "/videos/deleted",
    method: "get",
    operationId: "listDeletedVideos",
    summary: "List deleted videos",
    description: "Get videos that are in the trash (soft-deleted)",
    tags: ["Videos"],
    security: true,
    parameters: [
      { name: "organizationId", in: "query", required: true, schema: UuidParam, description: "Organization ID" },
    ],
    responses: {
      "200": { description: "List of deleted videos", schema: Schema.Array(ResponseSchemas.Video) },
      "401": { description: "Unauthorized" },
    },
  },
  {
    path: "/videos/{id}",
    method: "get",
    operationId: "getVideo",
    summary: "Get video",
    description: "Get detailed information about a specific video including comments",
    tags: ["Videos"],
    parameters: [{ name: "id", in: "path", required: true, schema: UuidParam, description: "Video ID" }],
    responses: {
      "200": { description: "Video details", schema: ResponseSchemas.VideoWithDetails },
      "404": { description: "Video not found" },
    },
  },
  {
    path: "/videos/{id}",
    method: "put",
    operationId: "updateVideo",
    summary: "Update video",
    description: "Update video metadata",
    tags: ["Videos"],
    security: true,
    parameters: [{ name: "id", in: "path", required: true, schema: UuidParam, description: "Video ID" }],
    requestBody: {
      description: "Video update data",
      schema: RequestSchemas.UpdateVideoSchema,
    },
    responses: {
      "200": { description: "Video updated", schema: ResponseSchemas.Video },
      "400": { description: "Invalid request body" },
      "401": { description: "Unauthorized" },
      "404": { description: "Video not found" },
    },
  },
  {
    path: "/videos/{id}",
    method: "delete",
    operationId: "deleteVideo",
    summary: "Delete video",
    description:
      "Delete a video. By default performs soft-delete with 30-day retention. Use permanent=true for immediate deletion.",
    tags: ["Videos"],
    security: true,
    parameters: [
      { name: "id", in: "path", required: true, schema: UuidParam, description: "Video ID" },
      { name: "permanent", in: "query", schema: Schema.Boolean, description: "Permanently delete the video" },
      {
        name: "retentionDays",
        in: "query",
        schema: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1), Schema.lessThanOrEqualTo(365)),
        description: "Override default retention period (days)",
      },
    ],
    responses: {
      "200": { description: "Video deleted", schema: ResponseSchemas.VideoDeleteResponse },
      "401": { description: "Unauthorized" },
      "404": { description: "Video not found" },
    },
  },
  {
    path: "/videos/{id}/restore",
    method: "post",
    operationId: "restoreVideo",
    summary: "Restore video",
    description: "Restore a soft-deleted video from trash",
    tags: ["Videos"],
    security: true,
    parameters: [{ name: "id", in: "path", required: true, schema: UuidParam, description: "Video ID" }],
    responses: {
      "200": { description: "Video restored", schema: ResponseSchemas.Video },
      "401": { description: "Unauthorized" },
      "404": { description: "Video not found" },
    },
  },
  {
    path: "/videos/{id}/comments",
    method: "get",
    operationId: "listVideoComments",
    summary: "List video comments",
    description: "Get all comments for a video",
    tags: ["Videos", "Comments"],
    parameters: [{ name: "id", in: "path", required: true, schema: UuidParam, description: "Video ID" }],
    responses: {
      "200": { description: "List of comments", schema: Schema.Array(ResponseSchemas.Comment) },
      "404": { description: "Video not found" },
    },
  },
  {
    path: "/videos/{id}/comments",
    method: "post",
    operationId: "createComment",
    summary: "Add comment",
    description: "Add a comment to a video",
    tags: ["Videos", "Comments"],
    security: true,
    parameters: [{ name: "id", in: "path", required: true, schema: UuidParam, description: "Video ID" }],
    requestBody: {
      description: "Comment data",
      schema: RequestSchemas.CreateCommentSchema,
    },
    responses: {
      "201": { description: "Comment created", schema: ResponseSchemas.Comment },
      "400": { description: "Invalid request body" },
      "401": { description: "Unauthorized" },
      "404": { description: "Video not found" },
    },
  },
  {
    path: "/videos/{id}/chapters",
    method: "get",
    operationId: "listVideoChapters",
    summary: "List video chapters",
    description: "Get chapters/markers for a video",
    tags: ["Videos"],
    parameters: [{ name: "id", in: "path", required: true, schema: UuidParam, description: "Video ID" }],
    responses: {
      "200": { description: "List of chapters", schema: Schema.Array(ResponseSchemas.Chapter) },
      "404": { description: "Video not found" },
    },
  },
  {
    path: "/videos/{id}/chapters",
    method: "post",
    operationId: "createChapter",
    summary: "Create chapter",
    description: "Add a chapter marker to a video",
    tags: ["Videos"],
    security: true,
    parameters: [{ name: "id", in: "path", required: true, schema: UuidParam, description: "Video ID" }],
    requestBody: {
      description: "Chapter data",
      schema: RequestSchemas.CreateChapterSchema,
    },
    responses: {
      "201": { description: "Chapter created", schema: ResponseSchemas.Chapter },
      "400": { description: "Invalid request body" },
      "401": { description: "Unauthorized" },
      "404": { description: "Video not found" },
    },
  },
  {
    path: "/videos/{id}/transcript",
    method: "get",
    operationId: "getVideoTranscript",
    summary: "Get video transcript",
    description: "Get the full transcript of a video",
    tags: ["Videos"],
    parameters: [{ name: "id", in: "path", required: true, schema: UuidParam, description: "Video ID" }],
    responses: {
      "200": { description: "Video transcript", schema: Schema.Struct({ transcript: Schema.String }) },
      "404": { description: "Video not found" },
    },
  },
  {
    path: "/videos/{id}/code-snippets",
    method: "get",
    operationId: "listVideoCodeSnippets",
    summary: "List code snippets",
    description: "Get code snippets associated with a video",
    tags: ["Videos"],
    parameters: [{ name: "id", in: "path", required: true, schema: UuidParam, description: "Video ID" }],
    responses: {
      "200": { description: "List of code snippets", schema: Schema.Array(ResponseSchemas.CodeSnippet) },
      "404": { description: "Video not found" },
    },
  },
  {
    path: "/videos/{id}/code-snippets",
    method: "post",
    operationId: "createCodeSnippet",
    summary: "Create code snippet",
    description: "Add a code snippet to a video",
    tags: ["Videos"],
    security: true,
    parameters: [{ name: "id", in: "path", required: true, schema: UuidParam, description: "Video ID" }],
    requestBody: {
      description: "Code snippet data",
      schema: RequestSchemas.CreateCodeSnippetSchema,
    },
    responses: {
      "201": { description: "Code snippet created", schema: ResponseSchemas.CodeSnippet },
      "400": { description: "Invalid request body" },
      "401": { description: "Unauthorized" },
      "404": { description: "Video not found" },
    },
  },
  {
    path: "/videos/{id}/progress",
    method: "get",
    operationId: "getVideoProgress",
    summary: "Get video progress",
    description: "Get the user's watch progress for a video",
    tags: ["Videos"],
    security: true,
    parameters: [{ name: "id", in: "path", required: true, schema: UuidParam, description: "Video ID" }],
    responses: {
      "200": {
        description: "Video progress",
        schema: Schema.Struct({
          currentTime: Schema.String,
          completed: Schema.Boolean,
          lastWatched: Schema.String,
        }),
      },
      "401": { description: "Unauthorized" },
      "404": { description: "Video not found" },
    },
  },
  {
    path: "/videos/{id}/progress",
    method: "put",
    operationId: "updateVideoProgress",
    summary: "Update video progress",
    description: "Update the user's watch progress for a video",
    tags: ["Videos"],
    security: true,
    parameters: [{ name: "id", in: "path", required: true, schema: UuidParam, description: "Video ID" }],
    requestBody: {
      description: "Progress update",
      schema: RequestSchemas.UpdateProgressSchema,
    },
    responses: {
      "200": { description: "Progress updated", schema: ResponseSchemas.SuccessResponse },
      "400": { description: "Invalid request body" },
      "401": { description: "Unauthorized" },
      "404": { description: "Video not found" },
    },
  },
];

// =============================================================================
// Series Endpoints
// =============================================================================

const seriesEndpoints: ApiEndpoint[] = [
  {
    path: "/series",
    method: "get",
    operationId: "listSeries",
    summary: "List series",
    description: "Get a paginated list of video series for an organization",
    tags: ["Series"],
    security: true,
    parameters: [
      { name: "organizationId", in: "query", required: true, schema: UuidParam, description: "Organization ID" },
      { name: "page", in: "query", schema: PageParam, description: "Page number" },
      { name: "limit", in: "query", schema: LimitParam, description: "Items per page" },
    ],
    responses: {
      "200": { description: "List of series", schema: ResponseSchemas.PaginatedSeries },
      "401": { description: "Unauthorized" },
    },
  },
  {
    path: "/series",
    method: "post",
    operationId: "createSeries",
    summary: "Create series",
    description: "Create a new video series/playlist",
    tags: ["Series"],
    security: true,
    requestBody: {
      description: "Series creation data",
      schema: RequestSchemas.CreateSeriesSchema,
    },
    responses: {
      "201": { description: "Series created", schema: ResponseSchemas.Series },
      "400": { description: "Invalid request body" },
      "401": { description: "Unauthorized" },
    },
  },
  {
    path: "/series/{id}",
    method: "get",
    operationId: "getSeries",
    summary: "Get series",
    description: "Get a series with its videos",
    tags: ["Series"],
    parameters: [{ name: "id", in: "path", required: true, schema: UuidParam, description: "Series ID" }],
    responses: {
      "200": { description: "Series with videos", schema: ResponseSchemas.SeriesWithVideos },
      "404": { description: "Series not found" },
    },
  },
  {
    path: "/series/{id}",
    method: "put",
    operationId: "updateSeries",
    summary: "Update series",
    description: "Update series metadata",
    tags: ["Series"],
    security: true,
    parameters: [{ name: "id", in: "path", required: true, schema: UuidParam, description: "Series ID" }],
    requestBody: {
      description: "Series update data",
      schema: RequestSchemas.UpdateSeriesSchema,
    },
    responses: {
      "200": { description: "Series updated", schema: ResponseSchemas.Series },
      "400": { description: "Invalid request body" },
      "401": { description: "Unauthorized" },
      "404": { description: "Series not found" },
    },
  },
  {
    path: "/series/{id}",
    method: "delete",
    operationId: "deleteSeries",
    summary: "Delete series",
    description: "Delete a series (videos are not deleted)",
    tags: ["Series"],
    security: true,
    parameters: [{ name: "id", in: "path", required: true, schema: UuidParam, description: "Series ID" }],
    responses: {
      "200": { description: "Series deleted", schema: ResponseSchemas.SuccessResponse },
      "401": { description: "Unauthorized" },
      "404": { description: "Series not found" },
    },
  },
  {
    path: "/series/{id}/videos",
    method: "post",
    operationId: "addVideoToSeries",
    summary: "Add video to series",
    description: "Add a video to a series",
    tags: ["Series"],
    security: true,
    parameters: [{ name: "id", in: "path", required: true, schema: UuidParam, description: "Series ID" }],
    requestBody: {
      description: "Video to add",
      schema: RequestSchemas.AddVideoToSeriesSchema,
    },
    responses: {
      "200": { description: "Video added to series", schema: ResponseSchemas.SeriesWithVideos },
      "400": { description: "Invalid request body" },
      "401": { description: "Unauthorized" },
      "404": { description: "Series or video not found" },
    },
  },
  {
    path: "/series/{id}/videos/{videoId}",
    method: "delete",
    operationId: "removeVideoFromSeries",
    summary: "Remove video from series",
    description: "Remove a video from a series",
    tags: ["Series"],
    security: true,
    parameters: [
      { name: "id", in: "path", required: true, schema: UuidParam, description: "Series ID" },
      { name: "videoId", in: "path", required: true, schema: UuidParam, description: "Video ID" },
    ],
    responses: {
      "200": { description: "Video removed from series", schema: ResponseSchemas.SuccessResponse },
      "401": { description: "Unauthorized" },
      "404": { description: "Series or video not found" },
    },
  },
  {
    path: "/series/{id}/reorder",
    method: "put",
    operationId: "reorderSeriesVideos",
    summary: "Reorder series videos",
    description: "Change the order of videos in a series",
    tags: ["Series"],
    security: true,
    parameters: [{ name: "id", in: "path", required: true, schema: UuidParam, description: "Series ID" }],
    requestBody: {
      description: "New video order",
      schema: RequestSchemas.ReorderSeriesVideosSchema,
    },
    responses: {
      "200": { description: "Videos reordered", schema: ResponseSchemas.SeriesWithVideos },
      "400": { description: "Invalid request body" },
      "401": { description: "Unauthorized" },
      "404": { description: "Series not found" },
    },
  },
];

// =============================================================================
// Organization Endpoints
// =============================================================================

const organizationEndpoints: ApiEndpoint[] = [
  {
    path: "/organizations",
    method: "get",
    operationId: "listOrganizations",
    summary: "List organizations",
    description: "Get organizations the current user is a member of",
    tags: ["Organizations"],
    security: true,
    responses: {
      "200": { description: "List of organizations", schema: Schema.Array(ResponseSchemas.Organization) },
      "401": { description: "Unauthorized" },
    },
  },
  {
    path: "/organizations",
    method: "post",
    operationId: "createOrganization",
    summary: "Create organization",
    description: "Create a new organization",
    tags: ["Organizations"],
    security: true,
    requestBody: {
      description: "Organization data",
      schema: RequestSchemas.CreateOrganizationSchema,
    },
    responses: {
      "201": { description: "Organization created", schema: ResponseSchemas.Organization },
      "400": { description: "Invalid request body" },
      "401": { description: "Unauthorized" },
    },
  },
  {
    path: "/organizations/{id}",
    method: "get",
    operationId: "getOrganization",
    summary: "Get organization",
    description: "Get organization details",
    tags: ["Organizations"],
    security: true,
    parameters: [{ name: "id", in: "path", required: true, schema: UuidParam, description: "Organization ID" }],
    responses: {
      "200": { description: "Organization details", schema: ResponseSchemas.Organization },
      "401": { description: "Unauthorized" },
      "404": { description: "Organization not found" },
    },
  },
  {
    path: "/organizations/{id}",
    method: "put",
    operationId: "updateOrganization",
    summary: "Update organization",
    description: "Update organization details",
    tags: ["Organizations"],
    security: true,
    parameters: [{ name: "id", in: "path", required: true, schema: UuidParam, description: "Organization ID" }],
    requestBody: {
      description: "Organization update data",
      schema: RequestSchemas.UpdateOrganizationSchema,
    },
    responses: {
      "200": { description: "Organization updated", schema: ResponseSchemas.Organization },
      "400": { description: "Invalid request body" },
      "401": { description: "Unauthorized" },
      "404": { description: "Organization not found" },
    },
  },
  {
    path: "/organizations/{id}/members",
    method: "get",
    operationId: "listOrganizationMembers",
    summary: "List members",
    description: "Get members of an organization",
    tags: ["Organizations"],
    security: true,
    parameters: [{ name: "id", in: "path", required: true, schema: UuidParam, description: "Organization ID" }],
    responses: {
      "200": { description: "List of members", schema: Schema.Array(ResponseSchemas.OrganizationMember) },
      "401": { description: "Unauthorized" },
      "404": { description: "Organization not found" },
    },
  },
  {
    path: "/organizations/{id}/invitations",
    method: "post",
    operationId: "createInvitation",
    summary: "Invite member",
    description: "Invite a user to join the organization",
    tags: ["Organizations"],
    security: true,
    parameters: [{ name: "id", in: "path", required: true, schema: UuidParam, description: "Organization ID" }],
    requestBody: {
      description: "Invitation data",
      schema: RequestSchemas.CreateInvitationSchema,
    },
    responses: {
      "201": { description: "Invitation sent", schema: ResponseSchemas.SuccessResponse },
      "400": { description: "Invalid request body" },
      "401": { description: "Unauthorized" },
      "404": { description: "Organization not found" },
    },
  },
];

// =============================================================================
// Notification Endpoints
// =============================================================================

const notificationEndpoints: ApiEndpoint[] = [
  {
    path: "/notifications",
    method: "get",
    operationId: "listNotifications",
    summary: "List notifications",
    description: "Get paginated notifications for the current user",
    tags: ["Notifications"],
    security: true,
    parameters: [
      { name: "page", in: "query", schema: PageParam, description: "Page number" },
      { name: "limit", in: "query", schema: LimitParam, description: "Items per page" },
      { name: "unreadOnly", in: "query", schema: Schema.Boolean, description: "Only return unread notifications" },
    ],
    responses: {
      "200": { description: "List of notifications", schema: ResponseSchemas.PaginatedNotifications },
      "401": { description: "Unauthorized" },
    },
  },
  {
    path: "/notifications/{id}",
    method: "put",
    operationId: "updateNotification",
    summary: "Update notification",
    description: "Mark a notification as read/unread",
    tags: ["Notifications"],
    security: true,
    parameters: [{ name: "id", in: "path", required: true, schema: UuidParam, description: "Notification ID" }],
    requestBody: {
      description: "Notification update",
      schema: RequestSchemas.UpdateNotificationSchema,
    },
    responses: {
      "200": { description: "Notification updated", schema: ResponseSchemas.Notification },
      "401": { description: "Unauthorized" },
      "404": { description: "Notification not found" },
    },
  },
  {
    path: "/notifications/mark-all-read",
    method: "post",
    operationId: "markAllNotificationsRead",
    summary: "Mark all read",
    description: "Mark all notifications as read",
    tags: ["Notifications"],
    security: true,
    responses: {
      "200": { description: "All notifications marked as read", schema: ResponseSchemas.SuccessResponse },
      "401": { description: "Unauthorized" },
    },
  },
];

// =============================================================================
// Billing Endpoints
// =============================================================================

const billingEndpoints: ApiEndpoint[] = [
  {
    path: "/billing/plans",
    method: "get",
    operationId: "listBillingPlans",
    summary: "List plans",
    description: "Get available billing plans",
    tags: ["Billing"],
    responses: {
      "200": { description: "List of billing plans", schema: Schema.Array(ResponseSchemas.BillingPlan) },
    },
  },
  {
    path: "/billing/subscription",
    method: "get",
    operationId: "getSubscription",
    summary: "Get subscription",
    description: "Get the current organization's subscription",
    tags: ["Billing"],
    security: true,
    parameters: [
      { name: "organizationId", in: "query", required: true, schema: UuidParam, description: "Organization ID" },
    ],
    responses: {
      "200": { description: "Subscription details", schema: ResponseSchemas.Subscription },
      "401": { description: "Unauthorized" },
      "404": { description: "No subscription found" },
    },
  },
  {
    path: "/billing/usage",
    method: "get",
    operationId: "getBillingUsage",
    summary: "Get usage",
    description: "Get current billing usage for the organization",
    tags: ["Billing"],
    security: true,
    parameters: [
      { name: "organizationId", in: "query", required: true, schema: UuidParam, description: "Organization ID" },
    ],
    responses: {
      "200": { description: "Billing usage", schema: ResponseSchemas.BillingUsage },
      "401": { description: "Unauthorized" },
    },
  },
  {
    path: "/billing/checkout",
    method: "post",
    operationId: "createCheckoutSession",
    summary: "Create checkout",
    description: "Create a Stripe checkout session for subscription",
    tags: ["Billing"],
    security: true,
    requestBody: {
      description: "Checkout data",
      schema: RequestSchemas.CreateCheckoutSchema,
    },
    responses: {
      "200": { description: "Checkout session created", schema: ResponseSchemas.CheckoutResponse },
      "400": { description: "Invalid request body" },
      "401": { description: "Unauthorized" },
    },
  },
  {
    path: "/billing/portal",
    method: "post",
    operationId: "createPortalSession",
    summary: "Create billing portal",
    description: "Create a Stripe customer portal session",
    tags: ["Billing"],
    security: true,
    parameters: [
      { name: "organizationId", in: "query", required: true, schema: UuidParam, description: "Organization ID" },
    ],
    responses: {
      "200": {
        description: "Portal session URL",
        schema: Schema.Struct({ url: Schema.String }),
      },
      "401": { description: "Unauthorized" },
    },
  },
];

// =============================================================================
// AI Endpoints
// =============================================================================

const aiEndpoints: ApiEndpoint[] = [
  {
    path: "/ai/analyze",
    method: "post",
    operationId: "analyzeVideo",
    summary: "Analyze video",
    description: "Trigger AI analysis of a video (transcript, summary, action items, tags)",
    tags: ["AI"],
    security: true,
    requestBody: {
      description: "Analysis options",
      schema: RequestSchemas.AnalyzeVideoSchema,
    },
    responses: {
      "200": { description: "Analysis result", schema: ResponseSchemas.AIAnalysisResult },
      "400": { description: "Invalid request body" },
      "401": { description: "Unauthorized" },
      "404": { description: "Video not found" },
    },
  },
];

// =============================================================================
// Integration Endpoints
// =============================================================================

const integrationEndpoints: ApiEndpoint[] = [
  {
    path: "/integrations/google/status",
    method: "get",
    operationId: "getGoogleIntegrationStatus",
    summary: "Google status",
    description: "Check if Google Meet integration is connected",
    tags: ["Integrations"],
    security: true,
    responses: {
      "200": { description: "Integration status", schema: ResponseSchemas.IntegrationStatus },
      "401": { description: "Unauthorized" },
    },
  },
  {
    path: "/integrations/google/recordings",
    method: "get",
    operationId: "listGoogleRecordings",
    summary: "List Google recordings",
    description: "List available Google Meet recordings",
    tags: ["Integrations"],
    security: true,
    responses: {
      "200": { description: "List of recordings", schema: Schema.Array(ResponseSchemas.MeetingRecording) },
      "401": { description: "Unauthorized" },
    },
  },
  {
    path: "/integrations/google/import",
    method: "post",
    operationId: "importGoogleRecording",
    summary: "Import Google recording",
    description: "Import a Google Meet recording as a video",
    tags: ["Integrations"],
    security: true,
    requestBody: {
      description: "Recording to import",
      schema: RequestSchemas.ImportMeetingSchema,
    },
    responses: {
      "201": { description: "Recording imported", schema: ResponseSchemas.Video },
      "400": { description: "Invalid request body" },
      "401": { description: "Unauthorized" },
    },
  },
  {
    path: "/integrations/zoom/status",
    method: "get",
    operationId: "getZoomIntegrationStatus",
    summary: "Zoom status",
    description: "Check if Zoom integration is connected",
    tags: ["Integrations"],
    security: true,
    responses: {
      "200": { description: "Integration status", schema: ResponseSchemas.IntegrationStatus },
      "401": { description: "Unauthorized" },
    },
  },
  {
    path: "/integrations/zoom/recordings",
    method: "get",
    operationId: "listZoomRecordings",
    summary: "List Zoom recordings",
    description: "List available Zoom recordings",
    tags: ["Integrations"],
    security: true,
    responses: {
      "200": { description: "List of recordings", schema: Schema.Array(ResponseSchemas.MeetingRecording) },
      "401": { description: "Unauthorized" },
    },
  },
  {
    path: "/integrations/zoom/import",
    method: "post",
    operationId: "importZoomRecording",
    summary: "Import Zoom recording",
    description: "Import a Zoom recording as a video",
    tags: ["Integrations"],
    security: true,
    requestBody: {
      description: "Recording to import",
      schema: RequestSchemas.ImportMeetingSchema,
    },
    responses: {
      "201": { description: "Recording imported", schema: ResponseSchemas.Video },
      "400": { description: "Invalid request body" },
      "401": { description: "Unauthorized" },
    },
  },
];

// =============================================================================
// Export All Endpoints
// =============================================================================

export const allEndpoints: ApiEndpoint[] = [
  ...healthEndpoints,
  ...videoEndpoints,
  ...seriesEndpoints,
  ...organizationEndpoints,
  ...notificationEndpoints,
  ...billingEndpoints,
  ...aiEndpoints,
  ...integrationEndpoints,
];
