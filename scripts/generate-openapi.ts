#!/usr/bin/env npx tsx

/**
 * OpenAPI Spec Generator
 *
 * Automatically generates OpenAPI 3.1 spec by parsing all route.ts files in the API directory.
 * This is a build-time only script - no runtime code goes into the application.
 *
 * Usage:
 *   pnpm openapi [options]
 *
 * Options:
 *   --stdout        Output to stdout instead of files (use with --format)
 *   --format, -f    Output format for stdout: json or yaml (default: json)
 *   --verbose       Print detailed parsing info
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { JSONSchema, Schema } from 'effect';
import { Project, type SourceFile } from 'ts-morph';

// Import validation schemas from the app (for schema resolution)
import * as RequestSchemas from '../src/lib/validation/schemas';

// =============================================================================
// Types
// =============================================================================

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

interface ParsedRoute {
  filePath: string;
  apiPath: string;
  methods: ParsedMethod[];
}

interface ParsedMethod {
  method: HttpMethod;
  requiresAuth: boolean;
  requestSchema?: string;
  querySchema?: string;
  pathParams: string[];
  description?: string;
}

interface ApiParameter {
  name: string;
  in: 'query' | 'path' | 'header';
  description?: string;
  required?: boolean;
  schema: Schema.Schema.Any;
}

interface ApiEndpoint {
  path: string;
  method: HttpMethod;
  operationId: string;
  summary: string;
  description?: string;
  tags: string[];
  security?: boolean;
  parameters?: ApiParameter[];
  requestBody?: {
    description?: string;
    required?: boolean;
    schema: Schema.Schema.Any;
    contentType?: 'application/json' | 'multipart/form-data';
  };
  responses: {
    [statusCode: string]: {
      description: string;
      schema?: Schema.Schema.Any;
    };
  };
}

interface ApiTag {
  name: string;
  description: string;
}

interface ApiInfo {
  title: string;
  version: string;
  description?: string;
  contact?: { name?: string; url?: string; email?: string };
  license?: { name: string; url?: string };
}

interface ApiServer {
  url: string;
  description?: string;
}

interface OpenApiSpec {
  openapi: string;
  info: ApiInfo;
  servers: ApiServer[];
  tags: ApiTag[];
  paths: Record<string, unknown>;
  components: {
    schemas: Record<string, unknown>;
    parameters: Record<string, unknown>;
    responses: Record<string, unknown>;
    securitySchemes: Record<string, unknown>;
  };
}

// =============================================================================
// Response Schemas (defined inline for spec generation only)
// =============================================================================

const _ErrorResponse = Schema.Struct({
  error: Schema.String,
  code: Schema.String,
  details: Schema.optional(Schema.Unknown),
});

const SuccessResponse = Schema.Struct({
  success: Schema.Boolean,
  message: Schema.optional(Schema.String),
});

const PaginationMeta = Schema.Struct({
  page: Schema.Number,
  limit: Schema.Number,
  total: Schema.Number,
  totalPages: Schema.Number,
});

const HealthResponse = Schema.Struct({
  status: Schema.String,
  timestamp: Schema.String,
});

const Video = Schema.Struct({
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

const VideoWithDetails = Video.pipe(
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

const PaginatedVideos = Schema.Struct({
  data: Schema.Array(Video),
  pagination: PaginationMeta,
});

const VideoDeleteResponse = Schema.Struct({
  success: Schema.Boolean,
  data: Schema.Struct({
    message: Schema.String,
    deletedAt: Schema.optional(Schema.String),
    retentionUntil: Schema.optional(Schema.String),
  }),
});

const Series = Schema.Struct({
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

const SeriesWithVideos = Series.pipe(Schema.extend(Schema.Struct({ videos: Schema.Array(Video) })));

const PaginatedSeries = Schema.Struct({
  data: Schema.Array(Series),
  pagination: PaginationMeta,
});

const Comment = Schema.Struct({
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

const Chapter = Schema.Struct({
  id: Schema.UUID,
  title: Schema.String,
  summary: Schema.NullOr(Schema.String),
  startTime: Schema.Number,
  endTime: Schema.NullOr(Schema.Number),
  videoId: Schema.UUID,
  createdAt: Schema.String,
});

const CodeSnippet = Schema.Struct({
  id: Schema.UUID,
  code: Schema.String,
  language: Schema.NullOr(Schema.String),
  title: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
  timestamp: Schema.NullOr(Schema.Number),
  videoId: Schema.UUID,
  createdAt: Schema.String,
});

const Organization = Schema.Struct({
  id: Schema.UUID,
  name: Schema.String,
  slug: Schema.String,
  description: Schema.NullOr(Schema.String),
  logo: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
});

const OrganizationMember = Schema.Struct({
  id: Schema.UUID,
  organizationId: Schema.UUID,
  userId: Schema.UUID,
  role: Schema.Literal('owner', 'member'),
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

const Notification = Schema.Struct({
  id: Schema.UUID,
  type: Schema.String,
  title: Schema.String,
  message: Schema.String,
  read: Schema.Boolean,
  userId: Schema.UUID,
  data: Schema.optional(Schema.Unknown),
  createdAt: Schema.String,
});

const PaginatedNotifications = Schema.Struct({
  data: Schema.Array(Notification),
  pagination: PaginationMeta,
  unreadCount: Schema.Number,
});

const BillingPlan = Schema.Struct({
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

const Subscription = Schema.Struct({
  id: Schema.String,
  planId: Schema.String,
  status: Schema.String,
  currentPeriodStart: Schema.String,
  currentPeriodEnd: Schema.String,
  cancelAtPeriodEnd: Schema.Boolean,
});

const BillingUsage = Schema.Struct({
  videos: Schema.Struct({ used: Schema.Number, limit: Schema.Number }),
  storage: Schema.Struct({ used: Schema.Number, limit: Schema.Number }),
  members: Schema.Struct({ used: Schema.Number, limit: Schema.Number }),
});

const CheckoutResponse = Schema.Struct({
  sessionId: Schema.String,
  url: Schema.String,
});

const SearchResult = Schema.Struct({
  type: Schema.Literal('video', 'series', 'channel'),
  id: Schema.UUID,
  title: Schema.String,
  description: Schema.NullOr(Schema.String),
  thumbnailUrl: Schema.NullOr(Schema.String),
  score: Schema.Number,
  highlights: Schema.optional(Schema.Array(Schema.String)),
});

const SearchResponse = Schema.Struct({
  results: Schema.Array(SearchResult),
  pagination: PaginationMeta,
  query: Schema.String,
});

const AIAnalysisResult = Schema.Struct({
  videoId: Schema.UUID,
  transcript: Schema.optional(Schema.String),
  summary: Schema.optional(Schema.String),
  actionItems: Schema.optional(Schema.Array(Schema.String)),
  tags: Schema.optional(Schema.Array(Schema.String)),
  processingTime: Schema.Number,
});

const IntegrationStatus = Schema.Struct({
  connected: Schema.Boolean,
  accountEmail: Schema.optional(Schema.String),
  connectedAt: Schema.optional(Schema.String),
});

const MeetingRecording = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  startTime: Schema.String,
  duration: Schema.Number,
  downloadUrl: Schema.optional(Schema.String),
});

// =============================================================================
// API Configuration
// =============================================================================

const apiInfo: ApiInfo = {
  title: 'Nuclom API',
  version: '1.0.0',
  description:
    'Nuclom is a video collaboration platform that helps teams organize, share, and collaborate on video content. This API provides programmatic access to videos, organizations, series, comments, and more.',
  contact: { name: 'Nuclom Support', url: 'https://nuclom.com/support' },
  license: {
    name: 'Elastic License 2.0',
    url: 'https://www.elastic.co/licensing/elastic-license',
  },
};

const apiServers: ApiServer[] = [{ url: 'https://nuclom.com/api', description: 'Production server' }];

const apiTags: ApiTag[] = [
  { name: 'Videos', description: 'Video management endpoints' },
  { name: 'Series', description: 'Video series/playlist management' },
  { name: 'Channels', description: 'Channel management' },
  { name: 'Organizations', description: 'Organization and team management' },
  { name: 'Comments', description: 'Video comments and discussions' },
  { name: 'Search', description: 'Search functionality' },
  { name: 'Notifications', description: 'User notifications' },
  { name: 'Billing', description: 'Subscription and billing management' },
  { name: 'AI', description: 'AI-powered video analysis' },
  { name: 'Integrations', description: 'Third-party integrations (Google Meet, Zoom)' },
  { name: 'Health', description: 'System health endpoints' },
  { name: 'Users', description: 'User management' },
  { name: 'OAuth', description: 'OAuth application management' },
  { name: 'Sharing', description: 'Content sharing' },
];

// =============================================================================
// Schema Mappings
// =============================================================================

const schemaNameMapping: Record<string, unknown> = {
  createVideoSchema: RequestSchemas.CreateVideoSchema,
  CreateVideoSchema: RequestSchemas.CreateVideoSchema,
  updateVideoSchema: RequestSchemas.UpdateVideoSchema,
  UpdateVideoSchema: RequestSchemas.UpdateVideoSchema,
  getVideosSchema: RequestSchemas.GetVideosSchema,
  GetVideosSchema: RequestSchemas.GetVideosSchema,
  videoUploadSchema: RequestSchemas.VideoUploadSchema,
  VideoUploadSchema: RequestSchemas.VideoUploadSchema,
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
  createOrganizationSchema: RequestSchemas.CreateOrganizationSchema,
  CreateOrganizationSchema: RequestSchemas.CreateOrganizationSchema,
  updateOrganizationSchema: RequestSchemas.UpdateOrganizationSchema,
  UpdateOrganizationSchema: RequestSchemas.UpdateOrganizationSchema,
  createInvitationSchema: RequestSchemas.CreateInvitationSchema,
  CreateInvitationSchema: RequestSchemas.CreateInvitationSchema,
  createCommentSchema: RequestSchemas.CreateCommentSchema,
  CreateCommentSchema: RequestSchemas.CreateCommentSchema,
  updateCommentSchema: RequestSchemas.UpdateCommentSchema,
  UpdateCommentSchema: RequestSchemas.UpdateCommentSchema,
  createChapterSchema: RequestSchemas.CreateChapterSchema,
  CreateChapterSchema: RequestSchemas.CreateChapterSchema,
  createCodeSnippetSchema: RequestSchemas.CreateCodeSnippetSchema,
  CreateCodeSnippetSchema: RequestSchemas.CreateCodeSnippetSchema,
  updateProgressSchema: RequestSchemas.UpdateProgressSchema,
  UpdateProgressSchema: RequestSchemas.UpdateProgressSchema,
  updateSeriesProgressSchema: RequestSchemas.UpdateSeriesProgressSchema,
  UpdateSeriesProgressSchema: RequestSchemas.UpdateSeriesProgressSchema,
  updateNotificationSchema: RequestSchemas.UpdateNotificationSchema,
  UpdateNotificationSchema: RequestSchemas.UpdateNotificationSchema,
  createCheckoutSchema: RequestSchemas.CreateCheckoutSchema,
  CreateCheckoutSchema: RequestSchemas.CreateCheckoutSchema,
  analyzeVideoSchema: RequestSchemas.AnalyzeVideoSchema,
  AnalyzeVideoSchema: RequestSchemas.AnalyzeVideoSchema,
  importMeetingSchema: RequestSchemas.ImportMeetingSchema,
  ImportMeetingSchema: RequestSchemas.ImportMeetingSchema,
  searchSchema: RequestSchemas.SearchSchema,
  SearchSchema: RequestSchemas.SearchSchema,
};

const responseOverrides: Record<string, ApiEndpoint['responses']> = {
  'GET /health': {
    '200': { description: 'API is healthy', schema: HealthResponse },
  },
  'GET /videos': {
    '200': { description: 'List of videos', schema: PaginatedVideos },
    '401': { description: 'Unauthorized' },
    '400': { description: 'Invalid request parameters' },
  },
  'POST /videos': {
    '201': { description: 'Video created', schema: Video },
    '400': { description: 'Invalid request body' },
    '401': { description: 'Unauthorized' },
  },
  'GET /videos/{id}': {
    '200': { description: 'Video details', schema: VideoWithDetails },
    '404': { description: 'Video not found' },
  },
  'PUT /videos/{id}': {
    '200': { description: 'Video updated', schema: Video },
    '400': { description: 'Invalid request body' },
    '401': { description: 'Unauthorized' },
    '404': { description: 'Video not found' },
  },
  'DELETE /videos/{id}': {
    '200': { description: 'Video deleted', schema: VideoDeleteResponse },
    '401': { description: 'Unauthorized' },
    '404': { description: 'Video not found' },
  },
  'GET /videos/{id}/comments': {
    '200': { description: 'List of comments', schema: Schema.Array(Comment) },
    '404': { description: 'Video not found' },
  },
  'POST /videos/{id}/comments': {
    '201': { description: 'Comment created', schema: Comment },
    '400': { description: 'Invalid request body' },
    '401': { description: 'Unauthorized' },
    '404': { description: 'Video not found' },
  },
  'GET /videos/{id}/chapters': {
    '200': { description: 'List of chapters', schema: Schema.Array(Chapter) },
    '404': { description: 'Video not found' },
  },
  'POST /videos/{id}/chapters': {
    '201': { description: 'Chapter created', schema: Chapter },
    '400': { description: 'Invalid request body' },
    '401': { description: 'Unauthorized' },
    '404': { description: 'Video not found' },
  },
  'GET /videos/{id}/code-snippets': {
    '200': { description: 'List of code snippets', schema: Schema.Array(CodeSnippet) },
    '404': { description: 'Video not found' },
  },
  'GET /series': {
    '200': { description: 'List of series', schema: PaginatedSeries },
    '401': { description: 'Unauthorized' },
  },
  'POST /series': {
    '201': { description: 'Series created', schema: Series },
    '400': { description: 'Invalid request body' },
    '401': { description: 'Unauthorized' },
  },
  'GET /series/{id}': {
    '200': { description: 'Series with videos', schema: SeriesWithVideos },
    '404': { description: 'Series not found' },
  },
  'PUT /series/{id}': {
    '200': { description: 'Series updated', schema: Series },
    '400': { description: 'Invalid request body' },
    '401': { description: 'Unauthorized' },
    '404': { description: 'Series not found' },
  },
  'DELETE /series/{id}': {
    '200': { description: 'Series deleted', schema: SuccessResponse },
    '401': { description: 'Unauthorized' },
    '404': { description: 'Series not found' },
  },
  'GET /organizations': {
    '200': { description: 'List of organizations', schema: Schema.Array(Organization) },
    '401': { description: 'Unauthorized' },
  },
  'POST /organizations': {
    '201': { description: 'Organization created', schema: Organization },
    '400': { description: 'Invalid request body' },
    '401': { description: 'Unauthorized' },
  },
  'GET /organizations/{id}': {
    '200': { description: 'Organization details', schema: Organization },
    '401': { description: 'Unauthorized' },
    '404': { description: 'Organization not found' },
  },
  'GET /organizations/{id}/members': {
    '200': { description: 'List of members', schema: Schema.Array(OrganizationMember) },
    '401': { description: 'Unauthorized' },
    '404': { description: 'Organization not found' },
  },
  'GET /notifications': {
    '200': { description: 'List of notifications', schema: PaginatedNotifications },
    '401': { description: 'Unauthorized' },
  },
  'GET /billing/plans': {
    '200': { description: 'List of billing plans', schema: Schema.Array(BillingPlan) },
  },
  'GET /billing/subscription': {
    '200': { description: 'Subscription details', schema: Subscription },
    '401': { description: 'Unauthorized' },
    '404': { description: 'No subscription found' },
  },
  'GET /billing/usage': {
    '200': { description: 'Billing usage', schema: BillingUsage },
    '401': { description: 'Unauthorized' },
  },
  'POST /billing/checkout': {
    '200': { description: 'Checkout session created', schema: CheckoutResponse },
    '400': { description: 'Invalid request body' },
    '401': { description: 'Unauthorized' },
  },
  'GET /search': {
    '200': { description: 'Search results', schema: SearchResponse },
    '400': { description: 'Invalid query' },
    '401': { description: 'Unauthorized' },
  },
  'POST /ai/analyze': {
    '200': { description: 'Analysis result', schema: AIAnalysisResult },
    '400': { description: 'Invalid request body' },
    '401': { description: 'Unauthorized' },
  },
  'GET /integrations/google/status': {
    '200': { description: 'Integration status', schema: IntegrationStatus },
    '401': { description: 'Unauthorized' },
  },
  'GET /integrations/zoom/status': {
    '200': { description: 'Integration status', schema: IntegrationStatus },
    '401': { description: 'Unauthorized' },
  },
  'GET /integrations/google/recordings': {
    '200': { description: 'List of recordings', schema: Schema.Array(MeetingRecording) },
    '401': { description: 'Unauthorized' },
  },
  'GET /integrations/zoom/recordings': {
    '200': { description: 'List of recordings', schema: Schema.Array(MeetingRecording) },
    '401': { description: 'Unauthorized' },
  },
  'POST /integrations/google/import': {
    '201': { description: 'Recording imported', schema: Video },
    '400': { description: 'Invalid request body' },
    '401': { description: 'Unauthorized' },
  },
  'POST /integrations/zoom/import': {
    '201': { description: 'Recording imported', schema: Video },
    '400': { description: 'Invalid request body' },
    '401': { description: 'Unauthorized' },
  },
};

const descriptionOverrides: Record<string, { summary: string; description?: string }> = {
  'GET /health': { summary: 'Health check', description: 'Check if the API is running and healthy' },
  'GET /videos': { summary: 'List videos', description: 'Get a paginated list of videos for an organization' },
  'POST /videos': { summary: 'Create video', description: 'Create a new video entry' },
  'GET /videos/{id}': {
    summary: 'Get video',
    description: 'Get detailed information about a specific video including comments',
  },
  'PUT /videos/{id}': { summary: 'Update video', description: 'Update video metadata' },
  'DELETE /videos/{id}': {
    summary: 'Delete video',
    description:
      'Delete a video. By default performs soft-delete with 30-day retention. Use permanent=true for immediate deletion.',
  },
  'POST /videos/{id}/restore': { summary: 'Restore video', description: 'Restore a soft-deleted video from trash' },
  'GET /videos/{id}/comments': { summary: 'List video comments', description: 'Get all comments for a video' },
  'POST /videos/{id}/comments': { summary: 'Add comment', description: 'Add a comment to a video' },
  'GET /videos/{id}/chapters': { summary: 'List video chapters', description: 'Get chapters/markers for a video' },
  'POST /videos/{id}/chapters': { summary: 'Create chapter', description: 'Add a chapter marker to a video' },
  'GET /videos/search': {
    summary: 'Search videos',
    description: 'Full-text search across video titles, descriptions, and transcripts',
  },
  'POST /videos/upload': { summary: 'Upload video', description: 'Upload a video file with metadata' },
  'GET /series': { summary: 'List series', description: 'Get a paginated list of video series for an organization' },
  'POST /series': { summary: 'Create series', description: 'Create a new video series/playlist' },
  'GET /series/{id}': { summary: 'Get series', description: 'Get a series with its videos' },
  'PUT /series/{id}': { summary: 'Update series', description: 'Update series metadata' },
  'DELETE /series/{id}': { summary: 'Delete series', description: 'Delete a series (videos are not deleted)' },
  'GET /organizations': {
    summary: 'List organizations',
    description: 'Get organizations the current user is a member of',
  },
  'POST /organizations': { summary: 'Create organization', description: 'Create a new organization' },
  'GET /organizations/{id}': { summary: 'Get organization', description: 'Get organization details' },
  'GET /organizations/{id}/members': { summary: 'List members', description: 'Get members of an organization' },
  'GET /notifications': {
    summary: 'List notifications',
    description: 'Get paginated notifications for the current user',
  },
  'POST /ai/analyze': {
    summary: 'Analyze video',
    description: 'Trigger AI analysis of a video (transcript, summary, action items, tags)',
  },
  'GET /billing/plans': { summary: 'List plans', description: 'Get available billing plans' },
  'GET /billing/subscription': {
    summary: 'Get subscription',
    description: "Get the current organization's subscription",
  },
  'GET /billing/usage': { summary: 'Get usage', description: 'Get current billing usage for the organization' },
  'POST /billing/checkout': {
    summary: 'Create checkout',
    description: 'Create a Stripe checkout session for subscription',
  },
  'POST /billing/portal': { summary: 'Create billing portal', description: 'Create a Stripe customer portal session' },
  'GET /search': { summary: 'Search', description: 'Search across videos, series, and other content' },
  'GET /channels': { summary: 'List channels', description: 'Get channels for an organization' },
  'POST /channels': { summary: 'Create channel', description: 'Create a new channel' },
  'GET /channels/{id}': { summary: 'Get channel', description: 'Get channel details' },
};

const skipRoutes = [
  '/auth/{...auth}',
  '/webhooks/stripe',
  '/integrations/google/callback',
  '/integrations/google/webhook',
  '/integrations/zoom/callback',
  '/integrations/zoom/webhook',
];

// =============================================================================
// Route Parser
// =============================================================================

class RouteParser {
  private project: Project;
  private apiDir: string;
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.apiDir = path.join(projectRoot, 'src/app/api');
    this.project = new Project({
      tsConfigFilePath: path.join(projectRoot, 'tsconfig.json'),
      skipAddingFilesFromTsConfig: true,
    });
  }

  parseAllRoutes(): ParsedRoute[] {
    const routeFiles = this.findRouteFiles();
    const routes: ParsedRoute[] = [];

    for (const filePath of routeFiles) {
      try {
        const route = this.parseRouteFile(filePath);
        if (route && route.methods.length > 0) {
          routes.push(route);
        }
      } catch (error) {
        console.warn(`Failed to parse route file: ${filePath}`, error);
      }
    }

    return routes;
  }

  private findRouteFiles(): string[] {
    const files: string[] = [];
    const walkDir = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.name === 'route.ts') {
          files.push(fullPath);
        }
      }
    };
    walkDir(this.apiDir);
    return files;
  }

  private parseRouteFile(filePath: string): ParsedRoute | null {
    const sourceFile = this.project.addSourceFileAtPath(filePath);
    const apiPath = this.filePathToApiPath(filePath);
    const pathParams = this.extractPathParams(apiPath);
    const methods: ParsedMethod[] = [];
    const httpMethods: HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete'];

    for (const method of httpMethods) {
      const methodUpper = method.toUpperCase();
      const funcDecl = sourceFile.getFunction(methodUpper);
      if (funcDecl?.isExported()) {
        const parsedMethod = this.parseMethod(sourceFile, funcDecl, method, pathParams);
        methods.push(parsedMethod);
      }
    }

    this.project.removeSourceFile(sourceFile);

    if (methods.length === 0) return null;
    return { filePath: path.relative(this.projectRoot, filePath), apiPath, methods };
  }

  // biome-ignore lint/suspicious/noExplicitAny: ts-morph types
  private parseMethod(_sourceFile: SourceFile, funcDecl: any, method: HttpMethod, pathParams: string[]): ParsedMethod {
    const funcBody = funcDecl.getBody()?.getText() ?? '';
    const requiresAuth = this.detectAuthUsage(funcBody);
    const requestSchema = this.extractRequestSchema(funcBody);
    const querySchema = this.extractQuerySchema(funcBody);
    const description = this.extractDescription(funcDecl);

    return { method, requiresAuth, requestSchema, querySchema, pathParams, description };
  }

  private filePathToApiPath(filePath: string): string {
    let relativePath = path.relative(this.apiDir, filePath);
    relativePath = path.dirname(relativePath);
    if (relativePath === '.') return '/';
    let apiPath = `/${relativePath.replace(/\[([^\]]+)\]/g, '{$1}')}`;
    apiPath = apiPath.replace(/\\/g, '/');
    if (apiPath.includes('{...')) return '';
    return apiPath;
  }

  private extractPathParams(apiPath: string): string[] {
    const matches = apiPath.match(/\{([^}]+)\}/g) ?? [];
    return matches.map((m) => m.slice(1, -1));
  }

  private detectAuthUsage(funcBody: string): boolean {
    return (
      funcBody.includes('yield* Auth') ||
      funcBody.includes('authService.getSession') ||
      funcBody.includes('getSession(request') ||
      funcBody.includes('auth()')
    );
  }

  private extractRequestSchema(funcBody: string): string | undefined {
    const match = funcBody.match(/validateRequestBody\s*\(\s*(\w+)/);
    if (match) return match[1];
    const effectMatch = funcBody.match(/Schema\.decodeUnknown\s*\(\s*(\w+)\)/);
    if (effectMatch) return effectMatch[1];
    return undefined;
  }

  private extractQuerySchema(funcBody: string): string | undefined {
    const match = funcBody.match(/validateQueryParams\s*\(\s*(\w+)/);
    return match?.[1];
  }

  // biome-ignore lint/suspicious/noExplicitAny: ts-morph types
  private extractDescription(funcDecl: any): string | undefined {
    const jsDocs = funcDecl.getJsDocs?.() ?? [];
    if (jsDocs.length > 0) return jsDocs[0].getDescription?.()?.trim();
    return undefined;
  }
}

// =============================================================================
// OpenAPI Generator
// =============================================================================

function schemaToJsonSchema(schema: Schema.Schema.Any): Record<string, unknown> {
  try {
    const jsonSchema = JSONSchema.make(schema);
    const { $schema, ...rest } = jsonSchema as unknown as Record<string, unknown>;
    return rest;
  } catch {
    return { type: 'object' };
  }
}

function generateOpenApiSpec(config: {
  info: ApiInfo;
  servers: ApiServer[];
  tags: ApiTag[];
  endpoints: ApiEndpoint[];
}): OpenApiSpec {
  const { info, servers, tags, endpoints } = config;
  const paths: Record<string, Record<string, unknown>> = {};
  const schemas: Record<string, unknown> = {};

  for (const endpoint of endpoints) {
    const pathKey = endpoint.path.startsWith('/') ? endpoint.path : `/${endpoint.path}`;
    if (!paths[pathKey]) paths[pathKey] = {};

    const operation: Record<string, unknown> = {
      tags: endpoint.tags,
      summary: endpoint.summary,
      operationId: endpoint.operationId,
    };

    if (endpoint.description) operation.description = endpoint.description;
    if (endpoint.security) operation.security = [{ bearerAuth: [] }];

    if (endpoint.parameters && endpoint.parameters.length > 0) {
      operation.parameters = endpoint.parameters.map((param) => ({
        name: param.name,
        in: param.in,
        description: param.description,
        required: param.required ?? param.in === 'path',
        schema: schemaToJsonSchema(param.schema),
      }));
    }

    if (endpoint.requestBody) {
      const contentType = endpoint.requestBody.contentType ?? 'application/json';
      operation.requestBody = {
        required: endpoint.requestBody.required ?? true,
        description: endpoint.requestBody.description,
        content: { [contentType]: { schema: schemaToJsonSchema(endpoint.requestBody.schema) } },
      };
    }

    const responses: Record<string, unknown> = {};
    for (const [statusCode, response] of Object.entries(endpoint.responses)) {
      const responseObj: Record<string, unknown> = { description: response.description };
      if (response.schema) {
        responseObj.content = { 'application/json': { schema: schemaToJsonSchema(response.schema) } };
      }
      responses[statusCode] = responseObj;
    }
    operation.responses = responses;

    paths[pathKey][endpoint.method] = operation;
  }

  return {
    openapi: '3.1.0',
    info,
    servers,
    tags,
    paths,
    components: {
      schemas,
      parameters: {
        organizationId: {
          name: 'organizationId',
          in: 'query',
          description: 'Organization ID to scope the request',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
        page: {
          name: 'page',
          in: 'query',
          description: 'Page number for pagination',
          required: false,
          schema: { type: 'integer', minimum: 1, default: 1 },
        },
        limit: {
          name: 'limit',
          in: 'query',
          description: 'Number of items per page',
          required: false,
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
      },
      responses: {
        BadRequest: {
          description: 'Invalid request parameters',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { error: { type: 'string' }, code: { type: 'string' }, details: { type: 'object' } },
                required: ['error', 'code'],
              },
            },
          },
        },
        Unauthorized: {
          description: 'Missing or invalid authentication',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Unauthorized' },
                  code: { type: 'string', example: 'AUTH_REQUIRED' },
                },
                required: ['error', 'code'],
              },
            },
          },
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Not found' },
                  code: { type: 'string', example: 'NOT_FOUND' },
                },
                required: ['error', 'code'],
              },
            },
          },
        },
      },
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Authentication token from login or API key',
        },
      },
    },
  };
}

// =============================================================================
// Endpoint Generation
// =============================================================================

function capitalizeFirst(str: string): string {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

function singularize(str: string): string {
  if (str.endsWith('ies')) return `${str.slice(0, -3)}y`;
  if (str.endsWith('es') && !str.endsWith('ses')) return str.slice(0, -2);
  if (str.endsWith('s') && !str.endsWith('ss')) return str.slice(0, -1);
  return str;
}

function generateOperationId(path: string, method: HttpMethod): string {
  const parts = path.slice(1).split('/').filter(Boolean);
  const methodVerbs: Record<HttpMethod, string> = {
    get: 'get',
    post: 'create',
    put: 'update',
    patch: 'patch',
    delete: 'delete',
  };
  const verb = methodVerbs[method];
  const pathParts = parts
    .map((part) => (part.startsWith('{') && part.endsWith('}') ? '' : capitalizeFirst(singularize(part))))
    .filter(Boolean);
  if (pathParts.length === 0) return verb;
  if (method === 'get' && !path.includes('{')) return `list${pathParts.join('')}`;
  return verb + pathParts.join('');
}

function generateSummary(path: string, method: HttpMethod): string {
  const parts = path.slice(1).split('/').filter(Boolean);
  const methodLabels: Record<HttpMethod, string> = {
    get: 'Get',
    post: 'Create',
    put: 'Update',
    patch: 'Patch',
    delete: 'Delete',
  };
  const label = methodLabels[method];
  const resourceParts = parts.filter((p) => !p.startsWith('{'));
  const resource = resourceParts.length > 0 ? resourceParts[resourceParts.length - 1] : 'resource';
  if (method === 'get' && !path.includes('{')) return `List ${resource}`;
  return `${label} ${singularize(resource)}`;
}

function inferTagsFromPath(path: string): string[] {
  const parts = path.slice(1).split('/').filter(Boolean);
  if (parts.length === 0) return ['General'];
  const tagMappings: Record<string, string> = {
    videos: 'Videos',
    series: 'Series',
    organizations: 'Organizations',
    notifications: 'Notifications',
    billing: 'Billing',
    ai: 'AI',
    integrations: 'Integrations',
    health: 'Health',
    comments: 'Comments',
    channels: 'Channels',
    search: 'Search',
    users: 'Users',
    auth: 'Authentication',
    oauth: 'OAuth',
    webhooks: 'Webhooks',
    share: 'Sharing',
  };
  return [tagMappings[parts[0]] ?? capitalizeFirst(parts[0])];
}

function generateDefaultResponses(method: ParsedMethod): ApiEndpoint['responses'] {
  const responses: ApiEndpoint['responses'] = {};
  const successStatus = method.method === 'post' ? '201' : '200';
  responses[successStatus] = { description: method.method === 'post' ? 'Created successfully' : 'Success' };
  if (method.requiresAuth) responses['401'] = { description: 'Unauthorized' };
  if (method.requestSchema || method.querySchema) responses['400'] = { description: 'Invalid request' };
  if (method.pathParams.length > 0) responses['404'] = { description: 'Not found' };
  return responses;
}

function resolveSchema(schemaName: string): unknown | undefined {
  return schemaNameMapping[schemaName];
}

function generateEndpointsFromRoutes(routes: ParsedRoute[]): ApiEndpoint[] {
  const endpoints: ApiEndpoint[] = [];

  for (const route of routes) {
    if (!route.apiPath || skipRoutes.includes(route.apiPath)) continue;

    for (const method of route.methods) {
      const operationId = generateOperationId(route.apiPath, method.method);
      const summary = generateSummary(route.apiPath, method.method);
      const tags = inferTagsFromPath(route.apiPath);

      const responseKey = `${method.method.toUpperCase()} ${route.apiPath}`;
      const responses = responseOverrides[responseKey] ?? generateDefaultResponses(method);

      const endpoint: ApiEndpoint = {
        path: route.apiPath,
        method: method.method,
        operationId,
        summary,
        tags,
        security: method.requiresAuth,
        responses,
      };

      const descOverride = descriptionOverrides[responseKey];
      if (descOverride) {
        endpoint.summary = descOverride.summary;
        if (descOverride.description) endpoint.description = descOverride.description;
      }

      if (method.pathParams.length > 0) {
        endpoint.parameters = method.pathParams.map((param) => ({
          name: param,
          in: 'path' as const,
          required: true,
          schema: Schema.UUID,
          description: `${capitalizeFirst(param)} ID`,
        }));
      }

      if (method.requestSchema) {
        const requestSchemaObj = resolveSchema(method.requestSchema);
        if (requestSchemaObj) {
          endpoint.requestBody = {
            description: `${summary} data`,
            schema: requestSchemaObj as Schema.Schema.Any,
          };
        }
      }

      endpoints.push(endpoint);
    }
  }

  endpoints.sort((a, b) => {
    const pathCompare = a.path.localeCompare(b.path);
    return pathCompare !== 0 ? pathCompare : a.method.localeCompare(b.method);
  });

  return endpoints;
}

// =============================================================================
// YAML Conversion
// =============================================================================

function toYaml(value: unknown, indent: number): string {
  const spaces = '  '.repeat(indent);

  if (value === null || value === undefined) return 'null';

  if (typeof value === 'string') {
    if (
      value === '' ||
      value.includes(':') ||
      value.includes('#') ||
      value.includes('\n') ||
      value.includes('"') ||
      value.includes("'") ||
      value.startsWith(' ') ||
      value.endsWith(' ') ||
      value === 'true' ||
      value === 'false' ||
      value === 'null' ||
      /^[\d.]+$/.test(value) ||
      value.includes('{') ||
      value.includes('}') ||
      value.includes('[') ||
      value.includes(']')
    ) {
      const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
      return `"${escaped}"`;
    }
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const lines = value.map((item) => {
      const itemYaml = toYaml(item, indent + 1);
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        const firstLine = itemYaml.split('\n')[0];
        const restLines = itemYaml.split('\n').slice(1);
        if (restLines.length > 0) return `${spaces}- ${firstLine}\n${restLines.join('\n')}`;
        return `${spaces}- ${firstLine}`;
      }
      return `${spaces}- ${itemYaml}`;
    });
    return `\n${lines.join('\n')}`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    const lines = entries.map(([key, val]) => {
      const valYaml = toYaml(val, indent + 1);
      const quotedKey =
        key.includes(':') || key.includes('#') || key.includes(' ') || key.startsWith('$') ? `"${key}"` : key;
      if (typeof val === 'object' && val !== null && (Array.isArray(val) || Object.keys(val).length > 0)) {
        return `${spaces}${quotedKey}:${valYaml}`;
      }
      return `${spaces}${quotedKey}: ${valYaml}`;
    });
    if (indent === 0) return lines.join('\n');
    return `\n${lines.join('\n')}`;
  }

  return String(value);
}

function specToYaml(spec: object): string {
  return toYaml(spec, 0);
}

// =============================================================================
// Main Generation Function
// =============================================================================

function generateSpec(projectRoot: string): OpenApiSpec {
  const parser = new RouteParser(projectRoot);
  const routes = parser.parseAllRoutes();
  const endpoints = generateEndpointsFromRoutes(routes);

  return generateOpenApiSpec({
    info: apiInfo,
    servers: apiServers,
    tags: apiTags,
    endpoints,
  });
}

// =============================================================================
// CLI
// =============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { stdout: false, format: 'json' as 'json' | 'yaml', verbose: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--stdout':
        options.stdout = true;
        break;
      case '--format':
      case '-f':
        options.format = args[++i] as 'json' | 'yaml';
        break;
      case '--verbose':
        options.verbose = true;
        break;
    }
  }

  return options;
}

function main() {
  const options = parseArgs();
  const projectRoot = path.resolve(import.meta.dirname, '..');
  const jsonPath = path.join(projectRoot, 'public', 'openapi.json');
  const yamlPath = path.join(projectRoot, 'public', 'openapi.yaml');

  const log = options.stdout ? console.error : console.log;

  log('Parsing route files...');

  if (options.verbose) {
    const parser = new RouteParser(projectRoot);
    const routes = parser.parseAllRoutes();
    log(`\nFound ${routes.length} route files:\n`);
    for (const route of routes) {
      log(`  ${route.apiPath}`);
      for (const method of route.methods) {
        log(`    ${method.method.toUpperCase()} - auth: ${method.requiresAuth}`);
        if (method.requestSchema) log(`      request: ${method.requestSchema}`);
        if (method.querySchema) log(`      query: ${method.querySchema}`);
      }
    }
    log('');
  }

  const spec = generateSpec(projectRoot);
  const jsonOutput = JSON.stringify(spec, null, 2);
  const yamlOutput = specToYaml(spec);

  log(`Generated spec with ${Object.keys(spec.paths).length} paths`);

  if (options.stdout) {
    console.log(options.format === 'yaml' ? yamlOutput : jsonOutput);
    return;
  }

  const publicDir = path.dirname(jsonPath);
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

  let jsonChanged = true;
  let yamlChanged = true;

  if (fs.existsSync(jsonPath)) {
    jsonChanged = fs.readFileSync(jsonPath, 'utf-8') !== jsonOutput;
  }
  if (fs.existsSync(yamlPath)) {
    yamlChanged = fs.readFileSync(yamlPath, 'utf-8') !== yamlOutput;
  }

  if (jsonChanged) {
    fs.writeFileSync(jsonPath, jsonOutput);
    log('Updated public/openapi.json');
  }
  if (yamlChanged) {
    fs.writeFileSync(yamlPath, yamlOutput);
    log('Updated public/openapi.yaml');
  }

  if (!jsonChanged && !yamlChanged) {
    log('OpenAPI specs are up to date');
  } else {
    log('OpenAPI specs regenerated');
  }
}

main();
