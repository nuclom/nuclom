/**
 * Auto-Generated Endpoint Definitions
 *
 * This module provides auto-generated OpenAPI endpoints by parsing route.ts files.
 * Use generateAutoEndpoints() to get endpoints based on the actual route implementations.
 *
 * Usage:
 *   import { generateAutoSpec } from "@/lib/openapi/auto-endpoints";
 *   const spec = await generateAutoSpec();
 */

import { Schema } from "effect";
import * as RequestSchemas from "@/lib/validation/schemas";
import { type ApiEndpoint, type ApiInfo, type ApiServer, type ApiTag, generateOpenApiSpec } from "./generator";
import * as ResponseSchemas from "./response-schemas";
import { generateEndpointsFromRoutes, RouteParser } from "./route-parser";

// =============================================================================
// Configuration
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
  { name: "Users", description: "User management" },
  { name: "OAuth", description: "OAuth application management" },
  { name: "Sharing", description: "Content sharing" },
];

// =============================================================================
// Schema Mappings
// =============================================================================

/**
 * Map schema names used in route files to actual schema objects
 */
export const schemaNameMapping: Record<string, unknown> = {
  // Video schemas
  createVideoSchema: RequestSchemas.CreateVideoSchema,
  CreateVideoSchema: RequestSchemas.CreateVideoSchema,
  updateVideoSchema: RequestSchemas.UpdateVideoSchema,
  UpdateVideoSchema: RequestSchemas.UpdateVideoSchema,
  getVideosSchema: RequestSchemas.GetVideosSchema,
  GetVideosSchema: RequestSchemas.GetVideosSchema,
  videoUploadSchema: RequestSchemas.VideoUploadSchema,
  VideoUploadSchema: RequestSchemas.VideoUploadSchema,

  // Series schemas
  createSeriesSchema: RequestSchemas.CreateSeriesSchema,
  CreateSeriesSchema: RequestSchemas.CreateSeriesSchema,
  updateSeriesSchema: RequestSchemas.UpdateSeriesSchema,
  UpdateSeriesSchema: RequestSchemas.UpdateSeriesSchema,
  getSeriesSchema: RequestSchemas.GetSeriesSchema,
  GetSeriesSchema: RequestSchemas.GetSeriesSchema,
  addVideoToSeriesSchema: RequestSchemas.AddVideoToSeriesSchema,
  AddVideoToSeriesSchema: RequestSchemas.AddVideoToSeriesSchema,
  reorderSeriesVideosSchema: RequestSchemas.ReorderSeriesVideosSchema,
  ReorderSeriesVideosSchema: RequestSchemas.ReorderSeriesVideosSchema,

  // Organization schemas
  createOrganizationSchema: RequestSchemas.CreateOrganizationSchema,
  CreateOrganizationSchema: RequestSchemas.CreateOrganizationSchema,
  updateOrganizationSchema: RequestSchemas.UpdateOrganizationSchema,
  UpdateOrganizationSchema: RequestSchemas.UpdateOrganizationSchema,
  createInvitationSchema: RequestSchemas.CreateInvitationSchema,
  CreateInvitationSchema: RequestSchemas.CreateInvitationSchema,

  // Comment schemas
  createCommentSchema: RequestSchemas.CreateCommentSchema,
  CreateCommentSchema: RequestSchemas.CreateCommentSchema,
  updateCommentSchema: RequestSchemas.UpdateCommentSchema,
  UpdateCommentSchema: RequestSchemas.UpdateCommentSchema,

  // Chapter and code snippet schemas
  createChapterSchema: RequestSchemas.CreateChapterSchema,
  CreateChapterSchema: RequestSchemas.CreateChapterSchema,
  createCodeSnippetSchema: RequestSchemas.CreateCodeSnippetSchema,
  CreateCodeSnippetSchema: RequestSchemas.CreateCodeSnippetSchema,

  // Progress schemas
  updateProgressSchema: RequestSchemas.UpdateProgressSchema,
  UpdateProgressSchema: RequestSchemas.UpdateProgressSchema,
  updateSeriesProgressSchema: RequestSchemas.UpdateSeriesProgressSchema,
  UpdateSeriesProgressSchema: RequestSchemas.UpdateSeriesProgressSchema,

  // Notification schemas
  updateNotificationSchema: RequestSchemas.UpdateNotificationSchema,
  UpdateNotificationSchema: RequestSchemas.UpdateNotificationSchema,

  // Billing schemas
  createCheckoutSchema: RequestSchemas.CreateCheckoutSchema,
  CreateCheckoutSchema: RequestSchemas.CreateCheckoutSchema,

  // AI schemas
  analyzeVideoSchema: RequestSchemas.AnalyzeVideoSchema,
  AnalyzeVideoSchema: RequestSchemas.AnalyzeVideoSchema,

  // Integration schemas
  importMeetingSchema: RequestSchemas.ImportMeetingSchema,
  ImportMeetingSchema: RequestSchemas.ImportMeetingSchema,

  // Search schemas
  searchSchema: RequestSchemas.SearchSchema,
  SearchSchema: RequestSchemas.SearchSchema,
};

/**
 * Response schema overrides for endpoints that need specific response types
 */
export const responseOverrides: Record<string, ApiEndpoint["responses"]> = {
  "GET /health": {
    "200": { description: "API is healthy", schema: ResponseSchemas.HealthResponse },
  },
  "GET /videos": {
    "200": { description: "List of videos", schema: ResponseSchemas.PaginatedVideos },
    "401": { description: "Unauthorized" },
    "400": { description: "Invalid request parameters" },
  },
  "POST /videos": {
    "201": { description: "Video created", schema: ResponseSchemas.Video },
    "400": { description: "Invalid request body" },
    "401": { description: "Unauthorized" },
  },
  "GET /videos/{id}": {
    "200": { description: "Video details", schema: ResponseSchemas.VideoWithDetails },
    "404": { description: "Video not found" },
  },
  "PUT /videos/{id}": {
    "200": { description: "Video updated", schema: ResponseSchemas.Video },
    "400": { description: "Invalid request body" },
    "401": { description: "Unauthorized" },
    "404": { description: "Video not found" },
  },
  "DELETE /videos/{id}": {
    "200": { description: "Video deleted", schema: ResponseSchemas.VideoDeleteResponse },
    "401": { description: "Unauthorized" },
    "404": { description: "Video not found" },
  },
  "GET /videos/{id}/comments": {
    "200": { description: "List of comments", schema: Schema.Array(ResponseSchemas.Comment) },
    "404": { description: "Video not found" },
  },
  "POST /videos/{id}/comments": {
    "201": { description: "Comment created", schema: ResponseSchemas.Comment },
    "400": { description: "Invalid request body" },
    "401": { description: "Unauthorized" },
    "404": { description: "Video not found" },
  },
  "GET /videos/{id}/chapters": {
    "200": { description: "List of chapters", schema: Schema.Array(ResponseSchemas.Chapter) },
    "404": { description: "Video not found" },
  },
  "POST /videos/{id}/chapters": {
    "201": { description: "Chapter created", schema: ResponseSchemas.Chapter },
    "400": { description: "Invalid request body" },
    "401": { description: "Unauthorized" },
    "404": { description: "Video not found" },
  },
  "GET /videos/{id}/code-snippets": {
    "200": { description: "List of code snippets", schema: Schema.Array(ResponseSchemas.CodeSnippet) },
    "404": { description: "Video not found" },
  },
  "GET /series": {
    "200": { description: "List of series", schema: ResponseSchemas.PaginatedSeries },
    "401": { description: "Unauthorized" },
  },
  "POST /series": {
    "201": { description: "Series created", schema: ResponseSchemas.Series },
    "400": { description: "Invalid request body" },
    "401": { description: "Unauthorized" },
  },
  "GET /series/{id}": {
    "200": { description: "Series with videos", schema: ResponseSchemas.SeriesWithVideos },
    "404": { description: "Series not found" },
  },
  "PUT /series/{id}": {
    "200": { description: "Series updated", schema: ResponseSchemas.Series },
    "400": { description: "Invalid request body" },
    "401": { description: "Unauthorized" },
    "404": { description: "Series not found" },
  },
  "DELETE /series/{id}": {
    "200": { description: "Series deleted", schema: ResponseSchemas.SuccessResponse },
    "401": { description: "Unauthorized" },
    "404": { description: "Series not found" },
  },
  "GET /organizations": {
    "200": { description: "List of organizations", schema: Schema.Array(ResponseSchemas.Organization) },
    "401": { description: "Unauthorized" },
  },
  "POST /organizations": {
    "201": { description: "Organization created", schema: ResponseSchemas.Organization },
    "400": { description: "Invalid request body" },
    "401": { description: "Unauthorized" },
  },
  "GET /organizations/{id}": {
    "200": { description: "Organization details", schema: ResponseSchemas.Organization },
    "401": { description: "Unauthorized" },
    "404": { description: "Organization not found" },
  },
  "GET /organizations/{id}/members": {
    "200": { description: "List of members", schema: Schema.Array(ResponseSchemas.OrganizationMember) },
    "401": { description: "Unauthorized" },
    "404": { description: "Organization not found" },
  },
  "GET /notifications": {
    "200": { description: "List of notifications", schema: ResponseSchemas.PaginatedNotifications },
    "401": { description: "Unauthorized" },
  },
  "GET /billing/plans": {
    "200": { description: "List of billing plans", schema: Schema.Array(ResponseSchemas.BillingPlan) },
  },
  "GET /billing/subscription": {
    "200": { description: "Subscription details", schema: ResponseSchemas.Subscription },
    "401": { description: "Unauthorized" },
    "404": { description: "No subscription found" },
  },
  "GET /billing/usage": {
    "200": { description: "Billing usage", schema: ResponseSchemas.BillingUsage },
    "401": { description: "Unauthorized" },
  },
  "POST /billing/checkout": {
    "200": { description: "Checkout session created", schema: ResponseSchemas.CheckoutResponse },
    "400": { description: "Invalid request body" },
    "401": { description: "Unauthorized" },
  },
  "GET /search": {
    "200": { description: "Search results", schema: ResponseSchemas.SearchResponse },
    "400": { description: "Invalid query" },
    "401": { description: "Unauthorized" },
  },
  "POST /ai/analyze": {
    "200": { description: "Analysis result", schema: ResponseSchemas.AIAnalysisResult },
    "400": { description: "Invalid request body" },
    "401": { description: "Unauthorized" },
  },
  "GET /integrations/google/status": {
    "200": { description: "Integration status", schema: ResponseSchemas.IntegrationStatus },
    "401": { description: "Unauthorized" },
  },
  "GET /integrations/zoom/status": {
    "200": { description: "Integration status", schema: ResponseSchemas.IntegrationStatus },
    "401": { description: "Unauthorized" },
  },
  "GET /integrations/google/recordings": {
    "200": { description: "List of recordings", schema: Schema.Array(ResponseSchemas.MeetingRecording) },
    "401": { description: "Unauthorized" },
  },
  "GET /integrations/zoom/recordings": {
    "200": { description: "List of recordings", schema: Schema.Array(ResponseSchemas.MeetingRecording) },
    "401": { description: "Unauthorized" },
  },
  "POST /integrations/google/import": {
    "201": { description: "Recording imported", schema: ResponseSchemas.Video },
    "400": { description: "Invalid request body" },
    "401": { description: "Unauthorized" },
  },
  "POST /integrations/zoom/import": {
    "201": { description: "Recording imported", schema: ResponseSchemas.Video },
    "400": { description: "Invalid request body" },
    "401": { description: "Unauthorized" },
  },
};

/**
 * Description overrides for endpoints
 */
export const descriptionOverrides: Record<string, { summary: string; description?: string }> = {
  "GET /health": {
    summary: "Health check",
    description: "Check if the API is running and healthy",
  },
  "GET /videos": {
    summary: "List videos",
    description: "Get a paginated list of videos for an organization",
  },
  "POST /videos": {
    summary: "Create video",
    description: "Create a new video entry",
  },
  "GET /videos/{id}": {
    summary: "Get video",
    description: "Get detailed information about a specific video including comments",
  },
  "PUT /videos/{id}": {
    summary: "Update video",
    description: "Update video metadata",
  },
  "DELETE /videos/{id}": {
    summary: "Delete video",
    description:
      "Delete a video. By default performs soft-delete with 30-day retention. Use permanent=true for immediate deletion.",
  },
  "POST /videos/{id}/restore": {
    summary: "Restore video",
    description: "Restore a soft-deleted video from trash",
  },
  "GET /videos/{id}/comments": {
    summary: "List video comments",
    description: "Get all comments for a video",
  },
  "POST /videos/{id}/comments": {
    summary: "Add comment",
    description: "Add a comment to a video",
  },
  "GET /videos/{id}/chapters": {
    summary: "List video chapters",
    description: "Get chapters/markers for a video",
  },
  "POST /videos/{id}/chapters": {
    summary: "Create chapter",
    description: "Add a chapter marker to a video",
  },
  "GET /videos/search": {
    summary: "Search videos",
    description: "Full-text search across video titles, descriptions, and transcripts",
  },
  "POST /videos/upload": {
    summary: "Upload video",
    description: "Upload a video file with metadata",
  },
  "GET /series": {
    summary: "List series",
    description: "Get a paginated list of video series for an organization",
  },
  "POST /series": {
    summary: "Create series",
    description: "Create a new video series/playlist",
  },
  "GET /series/{id}": {
    summary: "Get series",
    description: "Get a series with its videos",
  },
  "PUT /series/{id}": {
    summary: "Update series",
    description: "Update series metadata",
  },
  "DELETE /series/{id}": {
    summary: "Delete series",
    description: "Delete a series (videos are not deleted)",
  },
  "GET /organizations": {
    summary: "List organizations",
    description: "Get organizations the current user is a member of",
  },
  "POST /organizations": {
    summary: "Create organization",
    description: "Create a new organization",
  },
  "GET /organizations/{id}": {
    summary: "Get organization",
    description: "Get organization details",
  },
  "GET /organizations/{id}/members": {
    summary: "List members",
    description: "Get members of an organization",
  },
  "GET /notifications": {
    summary: "List notifications",
    description: "Get paginated notifications for the current user",
  },
  "POST /ai/analyze": {
    summary: "Analyze video",
    description: "Trigger AI analysis of a video (transcript, summary, action items, tags)",
  },
  "GET /billing/plans": {
    summary: "List plans",
    description: "Get available billing plans",
  },
  "GET /billing/subscription": {
    summary: "Get subscription",
    description: "Get the current organization's subscription",
  },
  "GET /billing/usage": {
    summary: "Get usage",
    description: "Get current billing usage for the organization",
  },
  "POST /billing/checkout": {
    summary: "Create checkout",
    description: "Create a Stripe checkout session for subscription",
  },
  "POST /billing/portal": {
    summary: "Create billing portal",
    description: "Create a Stripe customer portal session",
  },
  "GET /search": {
    summary: "Search",
    description: "Search across videos, series, and other content",
  },
  "GET /channels": {
    summary: "List channels",
    description: "Get channels for an organization",
  },
  "POST /channels": {
    summary: "Create channel",
    description: "Create a new channel",
  },
  "GET /channels/{id}": {
    summary: "Get channel",
    description: "Get channel details",
  },
};

/**
 * Routes to skip (internal routes, auth callbacks, webhooks)
 */
export const skipRoutes = [
  "/auth/{...auth}",
  "/webhooks/stripe",
  "/integrations/google/callback",
  "/integrations/google/webhook",
  "/integrations/zoom/callback",
  "/integrations/zoom/webhook",
];

// =============================================================================
// Generator Functions
// =============================================================================

/**
 * Generate endpoints by parsing route files
 * Note: This is designed for build-time generation, not runtime
 */
export function generateAutoEndpoints(projectRoot: string): ApiEndpoint[] {
  const parser = new RouteParser({ projectRoot });
  const routes = parser.parseAllRoutes();

  // Filter skipped routes
  const filteredRoutes = routes.filter((route) => !skipRoutes.includes(route.apiPath));

  // Generate endpoints
  const endpoints = generateEndpointsFromRoutes(filteredRoutes, {
    validationSchemas: schemaNameMapping,
    responseSchemas: ResponseSchemas as unknown as Record<string, unknown>,
    responseOverrides,
  });

  // Apply description overrides
  for (const endpoint of endpoints) {
    const key = `${endpoint.method.toUpperCase()} ${endpoint.path}`;
    const override = descriptionOverrides[key];
    if (override) {
      endpoint.summary = override.summary;
      if (override.description) {
        endpoint.description = override.description;
      }
    }
  }

  return endpoints;
}

/**
 * Generate complete OpenAPI spec by parsing route files
 */
export function generateAutoSpec(projectRoot: string) {
  const endpoints = generateAutoEndpoints(projectRoot);

  return generateOpenApiSpec({
    info: apiInfo,
    servers: apiServers,
    tags: apiTags,
    endpoints,
  });
}
