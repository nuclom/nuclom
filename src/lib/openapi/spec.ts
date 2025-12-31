/**
 * OpenAPI 3.1 Specification for Nuclom API
 * Auto-generated specification describing all public API endpoints
 */

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
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
  },
  servers: [
    {
      url: "https://nuclom.com/api",
      description: "Production server",
    },
    {
      url: "http://localhost:3000/api",
      description: "Local development server",
    },
  ],
  tags: [
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
  ],
  paths: {
    // ==========================================================================
    // Health
    // ==========================================================================
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        description: "Check if the API is running and healthy",
        operationId: "healthCheck",
        responses: {
          "200": {
            description: "API is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    timestamp: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ==========================================================================
    // Videos
    // ==========================================================================
    "/videos": {
      get: {
        tags: ["Videos"],
        summary: "List videos",
        description: "Get a paginated list of videos for an organization",
        operationId: "listVideos",
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/organizationId" },
          { $ref: "#/components/parameters/page" },
          { $ref: "#/components/parameters/limit" },
        ],
        responses: {
          "200": {
            description: "List of videos",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/PaginatedVideos",
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "400": { $ref: "#/components/responses/BadRequest" },
        },
      },
      post: {
        tags: ["Videos"],
        summary: "Create video",
        description: "Create a new video entry",
        operationId: "createVideo",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateVideoRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Video created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Video" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/videos/upload": {
      post: {
        tags: ["Videos"],
        summary: "Upload video",
        description: "Upload a video file with metadata",
        operationId: "uploadVideo",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file", "title", "organizationId"],
                properties: {
                  file: {
                    type: "string",
                    format: "binary",
                    description: "Video file to upload",
                  },
                  title: {
                    type: "string",
                    maxLength: 200,
                  },
                  description: {
                    type: "string",
                    maxLength: 5000,
                  },
                  organizationId: {
                    type: "string",
                    format: "uuid",
                  },
                  channelId: {
                    type: "string",
                    format: "uuid",
                  },
                  collectionId: {
                    type: "string",
                    format: "uuid",
                  },
                  skipAIProcessing: {
                    type: "string",
                    enum: ["true", "false"],
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Video uploaded successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Video" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "413": {
            description: "File too large",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/videos/search": {
      get: {
        tags: ["Videos", "Search"],
        summary: "Search videos",
        description: "Full-text search across video titles, descriptions, and transcripts",
        operationId: "searchVideos",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "q",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "Search query",
          },
          { $ref: "#/components/parameters/organizationId" },
          { $ref: "#/components/parameters/page" },
          { $ref: "#/components/parameters/limit" },
        ],
        responses: {
          "200": {
            description: "Search results",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SearchResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/videos/deleted": {
      get: {
        tags: ["Videos"],
        summary: "List deleted videos",
        description: "Get videos that are in the trash (soft-deleted)",
        operationId: "listDeletedVideos",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/organizationId" }],
        responses: {
          "200": {
            description: "List of deleted videos",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Video" },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/videos/{id}": {
      get: {
        tags: ["Videos"],
        summary: "Get video",
        description: "Get detailed information about a specific video including comments",
        operationId: "getVideo",
        parameters: [{ $ref: "#/components/parameters/videoId" }],
        responses: {
          "200": {
            description: "Video details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/VideoWithDetails" },
              },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      put: {
        tags: ["Videos"],
        summary: "Update video",
        description: "Update video metadata",
        operationId: "updateVideo",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/videoId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateVideoRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Video updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Video" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["Videos"],
        summary: "Delete video",
        description:
          "Delete a video. By default performs soft-delete with 30-day retention. Use permanent=true for immediate deletion.",
        operationId: "deleteVideo",
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/videoId" },
          {
            name: "permanent",
            in: "query",
            schema: { type: "boolean", default: false },
            description: "Permanently delete the video",
          },
          {
            name: "retentionDays",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 365 },
            description: "Override default retention period (days)",
          },
        ],
        responses: {
          "200": {
            description: "Video deleted",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        message: { type: "string" },
                        deletedAt: { type: "string", format: "date-time" },
                        retentionUntil: { type: "string", format: "date-time" },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/videos/{id}/restore": {
      post: {
        tags: ["Videos"],
        summary: "Restore video",
        description: "Restore a soft-deleted video from trash",
        operationId: "restoreVideo",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/videoId" }],
        responses: {
          "200": {
            description: "Video restored",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Video" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/videos/{id}/comments": {
      get: {
        tags: ["Videos", "Comments"],
        summary: "List video comments",
        description: "Get all comments for a video",
        operationId: "listVideoComments",
        parameters: [{ $ref: "#/components/parameters/videoId" }],
        responses: {
          "200": {
            description: "List of comments",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Comment" },
                },
              },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      post: {
        tags: ["Videos", "Comments"],
        summary: "Add comment",
        description: "Add a comment to a video",
        operationId: "createComment",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/videoId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateCommentRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Comment created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Comment" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/videos/{id}/chapters": {
      get: {
        tags: ["Videos"],
        summary: "List video chapters",
        description: "Get chapters/markers for a video",
        operationId: "listVideoChapters",
        parameters: [{ $ref: "#/components/parameters/videoId" }],
        responses: {
          "200": {
            description: "List of chapters",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Chapter" },
                },
              },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      post: {
        tags: ["Videos"],
        summary: "Create chapter",
        description: "Add a chapter marker to a video",
        operationId: "createChapter",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/videoId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateChapterRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Chapter created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Chapter" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/videos/{id}/transcript": {
      get: {
        tags: ["Videos"],
        summary: "Get video transcript",
        description: "Get the full transcript of a video",
        operationId: "getVideoTranscript",
        parameters: [{ $ref: "#/components/parameters/videoId" }],
        responses: {
          "200": {
            description: "Video transcript",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    transcript: { type: "string" },
                  },
                },
              },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/videos/{id}/subtitles": {
      get: {
        tags: ["Videos"],
        summary: "List available subtitles",
        description: "Get list of available subtitle languages for a video",
        operationId: "listSubtitles",
        parameters: [{ $ref: "#/components/parameters/videoId" }],
        responses: {
          "200": {
            description: "Available subtitles",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      language: { type: "string" },
                      url: { type: "string", format: "uri" },
                    },
                  },
                },
              },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/videos/{id}/subtitles/{lang}": {
      get: {
        tags: ["Videos"],
        summary: "Get subtitles",
        description: "Get subtitles for a video in a specific language (VTT format)",
        operationId: "getSubtitles",
        parameters: [
          { $ref: "#/components/parameters/videoId" },
          {
            name: "lang",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Language code (e.g., en, es, fr)",
          },
        ],
        responses: {
          "200": {
            description: "Subtitles in VTT format",
            content: {
              "text/vtt": {
                schema: { type: "string" },
              },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/videos/{id}/code-snippets": {
      get: {
        tags: ["Videos"],
        summary: "List code snippets",
        description: "Get code snippets extracted from or associated with a video",
        operationId: "listCodeSnippets",
        parameters: [{ $ref: "#/components/parameters/videoId" }],
        responses: {
          "200": {
            description: "List of code snippets",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/CodeSnippet" },
                },
              },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      post: {
        tags: ["Videos"],
        summary: "Add code snippet",
        description: "Add a code snippet to a video",
        operationId: "createCodeSnippet",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/videoId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateCodeSnippetRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Code snippet created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CodeSnippet" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/videos/{id}/progress": {
      get: {
        tags: ["Videos"],
        summary: "Get watch progress",
        description: "Get the current user's watch progress for a video",
        operationId: "getVideoProgress",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/videoId" }],
        responses: {
          "200": {
            description: "Watch progress",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/VideoProgress" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      put: {
        tags: ["Videos"],
        summary: "Update watch progress",
        description: "Update the current user's watch progress for a video",
        operationId: "updateVideoProgress",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/videoId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateProgressRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Progress updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/VideoProgress" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/videos/{id}/move": {
      post: {
        tags: ["Videos"],
        summary: "Move video",
        description: "Move a video to a different channel or collection",
        operationId: "moveVideo",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/videoId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  channelId: { type: "string", format: "uuid" },
                  collectionId: { type: "string", format: "uuid" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Video moved",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Video" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/videos/{id}/process": {
      post: {
        tags: ["Videos", "AI"],
        summary: "Process video",
        description: "Trigger AI processing for a video (transcription, summary, etc.)",
        operationId: "processVideo",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/videoId" }],
        responses: {
          "202": {
            description: "Processing started",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    status: { type: "string", enum: ["pending", "processing"] },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ==========================================================================
    // Series (Collections)
    // ==========================================================================
    "/series": {
      get: {
        tags: ["Series"],
        summary: "List series",
        description: "Get paginated list of video series for an organization",
        operationId: "listSeries",
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/organizationId" },
          { $ref: "#/components/parameters/page" },
          { $ref: "#/components/parameters/limit" },
        ],
        responses: {
          "200": {
            description: "List of series",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/PaginatedSeries",
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        tags: ["Series"],
        summary: "Create series",
        description: "Create a new video series",
        operationId: "createSeries",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateSeriesRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Series created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Series" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/series/{id}": {
      get: {
        tags: ["Series"],
        summary: "Get series",
        description: "Get detailed information about a series",
        operationId: "getSeries",
        parameters: [{ $ref: "#/components/parameters/seriesId" }],
        responses: {
          "200": {
            description: "Series details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SeriesWithVideos" },
              },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      put: {
        tags: ["Series"],
        summary: "Update series",
        description: "Update series metadata",
        operationId: "updateSeries",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/seriesId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateSeriesRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Series updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Series" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["Series"],
        summary: "Delete series",
        description: "Delete a series (videos are not deleted)",
        operationId: "deleteSeries",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/seriesId" }],
        responses: {
          "200": {
            description: "Series deleted",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    message: { type: "string" },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/series/{id}/videos": {
      get: {
        tags: ["Series"],
        summary: "List series videos",
        description: "Get ordered list of videos in a series",
        operationId: "listSeriesVideos",
        parameters: [{ $ref: "#/components/parameters/seriesId" }],
        responses: {
          "200": {
            description: "Videos in series",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Video" },
                },
              },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      post: {
        tags: ["Series"],
        summary: "Add video to series",
        description: "Add a video to a series at a specific position",
        operationId: "addVideoToSeries",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/seriesId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AddVideoToSeriesRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Video added to series",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SeriesWithVideos" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      put: {
        tags: ["Series"],
        summary: "Reorder series videos",
        description: "Reorder videos within a series",
        operationId: "reorderSeriesVideos",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/seriesId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ReorderSeriesVideosRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Videos reordered",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SeriesWithVideos" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/series/{id}/videos/{videoId}": {
      delete: {
        tags: ["Series"],
        summary: "Remove video from series",
        description: "Remove a video from a series",
        operationId: "removeVideoFromSeries",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/seriesId" }, { $ref: "#/components/parameters/videoId" }],
        responses: {
          "200": {
            description: "Video removed from series",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    message: { type: "string" },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/series/{id}/progress": {
      get: {
        tags: ["Series"],
        summary: "Get series progress",
        description: "Get the current user's progress through a series",
        operationId: "getSeriesProgress",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/seriesId" }],
        responses: {
          "200": {
            description: "Series progress",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SeriesProgress" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      put: {
        tags: ["Series"],
        summary: "Update series progress",
        description: "Update the current user's progress through a series",
        operationId: "updateSeriesProgress",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/seriesId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateSeriesProgressRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Progress updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SeriesProgress" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ==========================================================================
    // Channels
    // ==========================================================================
    "/channels": {
      get: {
        tags: ["Channels"],
        summary: "List channels",
        description: "Get all channels for an organization",
        operationId: "listChannels",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/organizationId" }],
        responses: {
          "200": {
            description: "List of channels",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Channel" },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        tags: ["Channels"],
        summary: "Create channel",
        description: "Create a new channel",
        operationId: "createChannel",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "organizationId"],
                properties: {
                  name: { type: "string", maxLength: 100 },
                  description: { type: "string", maxLength: 500 },
                  organizationId: { type: "string", format: "uuid" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Channel created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Channel" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/channels/{id}": {
      get: {
        tags: ["Channels"],
        summary: "Get channel",
        description: "Get channel details with videos",
        operationId: "getChannel",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Channel details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ChannelWithVideos" },
              },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      put: {
        tags: ["Channels"],
        summary: "Update channel",
        description: "Update channel metadata",
        operationId: "updateChannel",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string", maxLength: 100 },
                  description: { type: "string", maxLength: 500 },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Channel updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Channel" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["Channels"],
        summary: "Delete channel",
        description: "Delete a channel",
        operationId: "deleteChannel",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Channel deleted",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    message: { type: "string" },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ==========================================================================
    // Organizations
    // ==========================================================================
    "/organizations": {
      get: {
        tags: ["Organizations"],
        summary: "List organizations",
        description: "Get organizations the current user belongs to",
        operationId: "listOrganizations",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "List of organizations",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Organization" },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        tags: ["Organizations"],
        summary: "Create organization",
        description: "Create a new organization",
        operationId: "createOrganization",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateOrganizationRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Organization created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Organization" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "409": { $ref: "#/components/responses/Conflict" },
        },
      },
    },
    "/organizations/{id}/settings": {
      get: {
        tags: ["Organizations"],
        summary: "Get organization settings",
        description: "Get organization settings and details",
        operationId: "getOrganizationSettings",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/organizationIdPath" }],
        responses: {
          "200": {
            description: "Organization settings",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OrganizationWithMembers" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      put: {
        tags: ["Organizations"],
        summary: "Update organization settings",
        description: "Update organization settings",
        operationId: "updateOrganizationSettings",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/organizationIdPath" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateOrganizationRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Settings updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Organization" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/organizations/{id}/members": {
      get: {
        tags: ["Organizations"],
        summary: "List members",
        description: "Get all members of an organization",
        operationId: "listOrganizationMembers",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/organizationIdPath" }],
        responses: {
          "200": {
            description: "List of members",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Member" },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      post: {
        tags: ["Organizations"],
        summary: "Invite member",
        description: "Invite a new member to the organization",
        operationId: "inviteOrganizationMember",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/organizationIdPath" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateInvitationRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Invitation sent",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    message: { type: "string" },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ==========================================================================
    // Comments
    // ==========================================================================
    "/comments/{id}": {
      put: {
        tags: ["Comments"],
        summary: "Update comment",
        description: "Update an existing comment",
        operationId: "updateComment",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "Comment ID",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateCommentRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Comment updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Comment" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["Comments"],
        summary: "Delete comment",
        description: "Delete a comment",
        operationId: "deleteComment",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "Comment ID",
          },
        ],
        responses: {
          "200": {
            description: "Comment deleted",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    message: { type: "string" },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ==========================================================================
    // Search
    // ==========================================================================
    "/search": {
      get: {
        tags: ["Search"],
        summary: "Search",
        description: "Full-text search across videos",
        operationId: "search",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "q",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "Search query",
          },
          { $ref: "#/components/parameters/organizationId" },
          { $ref: "#/components/parameters/page" },
          { $ref: "#/components/parameters/limit" },
          {
            name: "channelId",
            in: "query",
            schema: { type: "string", format: "uuid" },
            description: "Filter by channel",
          },
          {
            name: "authorId",
            in: "query",
            schema: { type: "string", format: "uuid" },
            description: "Filter by author",
          },
          {
            name: "dateFrom",
            in: "query",
            schema: { type: "string", format: "date" },
            description: "Filter by start date",
          },
          {
            name: "dateTo",
            in: "query",
            schema: { type: "string", format: "date" },
            description: "Filter by end date",
          },
        ],
        responses: {
          "200": {
            description: "Search results",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SearchResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/search/quick": {
      get: {
        tags: ["Search"],
        summary: "Quick search",
        description: "Fast search for autocomplete",
        operationId: "quickSearch",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "q",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
          { $ref: "#/components/parameters/organizationId" },
        ],
        responses: {
          "200": {
            description: "Quick search results",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Video" },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/search/suggestions": {
      get: {
        tags: ["Search"],
        summary: "Search suggestions",
        description: "Get search suggestions based on history and popular queries",
        operationId: "searchSuggestions",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "q",
            in: "query",
            schema: { type: "string" },
          },
          { $ref: "#/components/parameters/organizationId" },
        ],
        responses: {
          "200": {
            description: "Search suggestions",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/SearchSuggestion" },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/search/history": {
      get: {
        tags: ["Search"],
        summary: "Search history",
        description: "Get user's search history",
        operationId: "getSearchHistory",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Search history",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      query: { type: "string" },
                      timestamp: { type: "string", format: "date-time" },
                    },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      delete: {
        tags: ["Search"],
        summary: "Clear search history",
        description: "Clear user's search history",
        operationId: "clearSearchHistory",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "History cleared",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    message: { type: "string" },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/search/saved": {
      get: {
        tags: ["Search"],
        summary: "List saved searches",
        description: "Get user's saved searches",
        operationId: "listSavedSearches",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Saved searches",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/SavedSearch" },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        tags: ["Search"],
        summary: "Save search",
        description: "Save a search query",
        operationId: "saveSearch",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["query"],
                properties: {
                  query: { type: "string" },
                  name: { type: "string" },
                  filters: { type: "object" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Search saved",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SavedSearch" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/search/saved/{id}": {
      delete: {
        tags: ["Search"],
        summary: "Delete saved search",
        description: "Delete a saved search",
        operationId: "deleteSavedSearch",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Saved search deleted",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    message: { type: "string" },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ==========================================================================
    // Notifications
    // ==========================================================================
    "/notifications": {
      get: {
        tags: ["Notifications"],
        summary: "List notifications",
        description: "Get user's notifications",
        operationId: "listNotifications",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "unreadOnly",
            in: "query",
            schema: { type: "boolean" },
            description: "Only return unread notifications",
          },
          { $ref: "#/components/parameters/page" },
          { $ref: "#/components/parameters/limit" },
        ],
        responses: {
          "200": {
            description: "List of notifications",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Notification" },
                    },
                    unreadCount: { type: "integer" },
                    pagination: { $ref: "#/components/schemas/Pagination" },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      put: {
        tags: ["Notifications"],
        summary: "Mark all as read",
        description: "Mark all notifications as read",
        operationId: "markAllNotificationsRead",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "All notifications marked as read",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    message: { type: "string" },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/notifications/{id}": {
      put: {
        tags: ["Notifications"],
        summary: "Update notification",
        description: "Update notification (mark as read/unread)",
        operationId: "updateNotification",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateNotificationRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Notification updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Notification" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["Notifications"],
        summary: "Delete notification",
        description: "Delete a notification",
        operationId: "deleteNotification",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Notification deleted",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    message: { type: "string" },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ==========================================================================
    // Billing
    // ==========================================================================
    "/billing": {
      get: {
        tags: ["Billing"],
        summary: "Get billing info",
        description: "Get current billing information for the organization",
        operationId: "getBillingInfo",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/organizationId" }],
        responses: {
          "200": {
            description: "Billing information",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BillingInfo" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/billing/plans": {
      get: {
        tags: ["Billing"],
        summary: "List plans",
        description: "Get available subscription plans",
        operationId: "listPlans",
        responses: {
          "200": {
            description: "Available plans",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Plan" },
                },
              },
            },
          },
        },
      },
    },
    "/billing/subscription": {
      get: {
        tags: ["Billing"],
        summary: "Get subscription",
        description: "Get current subscription details",
        operationId: "getSubscription",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/organizationId" }],
        responses: {
          "200": {
            description: "Subscription details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Subscription" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["Billing"],
        summary: "Cancel subscription",
        description: "Cancel the current subscription",
        operationId: "cancelSubscription",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/organizationId" }],
        responses: {
          "200": {
            description: "Subscription cancelled",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    message: { type: "string" },
                    cancelAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/billing/checkout": {
      post: {
        tags: ["Billing"],
        summary: "Create checkout",
        description: "Create a Stripe checkout session",
        operationId: "createCheckout",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateCheckoutRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Checkout session created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    url: { type: "string", format: "uri" },
                    sessionId: { type: "string" },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/billing/portal": {
      post: {
        tags: ["Billing"],
        summary: "Create portal session",
        description: "Create a Stripe billing portal session",
        operationId: "createPortalSession",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/organizationId" }],
        responses: {
          "200": {
            description: "Portal session created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    url: { type: "string", format: "uri" },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/billing/invoices": {
      get: {
        tags: ["Billing"],
        summary: "List invoices",
        description: "Get invoice history",
        operationId: "listInvoices",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/organizationId" }],
        responses: {
          "200": {
            description: "Invoice history",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Invoice" },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/billing/usage": {
      get: {
        tags: ["Billing"],
        summary: "Get usage",
        description: "Get current usage statistics",
        operationId: "getUsage",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/organizationId" }],
        responses: {
          "200": {
            description: "Usage statistics",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Usage" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    // ==========================================================================
    // AI
    // ==========================================================================
    "/ai/analyze": {
      post: {
        tags: ["AI"],
        summary: "Analyze video",
        description: "Trigger AI analysis on a video (transcript, summary, action items, tags)",
        operationId: "analyzeVideo",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AnalyzeVideoRequest" },
            },
          },
        },
        responses: {
          "202": {
            description: "Analysis started",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    message: { type: "string" },
                    videoId: { type: "string", format: "uuid" },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ==========================================================================
    // Integrations
    // ==========================================================================
    "/integrations": {
      get: {
        tags: ["Integrations"],
        summary: "List integrations",
        description: "Get configured integrations for the organization",
        operationId: "listIntegrations",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/organizationId" }],
        responses: {
          "200": {
            description: "List of integrations",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Integration" },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/integrations/google/authorize": {
      get: {
        tags: ["Integrations"],
        summary: "Authorize Google",
        description: "Start Google OAuth flow for Google Meet integration",
        operationId: "authorizeGoogle",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/organizationId" }],
        responses: {
          "302": {
            description: "Redirect to Google OAuth",
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/integrations/google/callback": {
      get: {
        tags: ["Integrations"],
        summary: "Google OAuth callback",
        description: "Handle Google OAuth callback",
        operationId: "googleCallback",
        parameters: [
          {
            name: "code",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "state",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "302": {
            description: "Redirect to app",
          },
          "400": { $ref: "#/components/responses/BadRequest" },
        },
      },
    },
    "/integrations/google/recordings": {
      get: {
        tags: ["Integrations"],
        summary: "List Google Meet recordings",
        description: "Get available Google Meet recordings",
        operationId: "listGoogleRecordings",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/organizationId" }],
        responses: {
          "200": {
            description: "List of recordings",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Recording" },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/integrations/zoom/authorize": {
      get: {
        tags: ["Integrations"],
        summary: "Authorize Zoom",
        description: "Start Zoom OAuth flow",
        operationId: "authorizeZoom",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/organizationId" }],
        responses: {
          "302": {
            description: "Redirect to Zoom OAuth",
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/integrations/zoom/callback": {
      get: {
        tags: ["Integrations"],
        summary: "Zoom OAuth callback",
        description: "Handle Zoom OAuth callback",
        operationId: "zoomCallback",
        parameters: [
          {
            name: "code",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "state",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "302": {
            description: "Redirect to app",
          },
          "400": { $ref: "#/components/responses/BadRequest" },
        },
      },
    },
    "/integrations/zoom/recordings": {
      get: {
        tags: ["Integrations"],
        summary: "List Zoom recordings",
        description: "Get available Zoom recordings",
        operationId: "listZoomRecordings",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/organizationId" }],
        responses: {
          "200": {
            description: "List of recordings",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Recording" },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/integrations/import": {
      post: {
        tags: ["Integrations"],
        summary: "Import recording",
        description: "Import a recording from an integration",
        operationId: "importRecording",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ImportMeetingRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Recording imported",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Video" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT authentication token obtained from the auth endpoints",
      },
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "better-auth.session_token",
        description: "Session cookie for browser-based authentication",
      },
    },
    parameters: {
      videoId: {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
        description: "Video ID",
      },
      seriesId: {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
        description: "Series ID",
      },
      organizationId: {
        name: "organizationId",
        in: "query",
        required: true,
        schema: { type: "string", format: "uuid" },
        description: "Organization ID",
      },
      organizationIdPath: {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
        description: "Organization ID",
      },
      page: {
        name: "page",
        in: "query",
        schema: { type: "integer", minimum: 1, default: 1 },
        description: "Page number",
      },
      limit: {
        name: "limit",
        in: "query",
        schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        description: "Items per page",
      },
    },
    responses: {
      BadRequest: {
        description: "Bad request - validation error",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      Unauthorized: {
        description: "Unauthorized - authentication required",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      Forbidden: {
        description: "Forbidden - insufficient permissions",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      NotFound: {
        description: "Resource not found",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      Conflict: {
        description: "Conflict - resource already exists",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
    },
    schemas: {
      // Error schemas
      Error: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: {
                type: "string",
                description: "Error code",
                example: "VALIDATION_FAILED",
              },
              message: {
                type: "string",
                description: "Human-readable error message",
              },
              details: {
                type: "object",
                description: "Additional error details",
              },
            },
          },
        },
      },
      Pagination: {
        type: "object",
        properties: {
          page: { type: "integer" },
          limit: { type: "integer" },
          total: { type: "integer" },
          totalPages: { type: "integer" },
        },
      },

      // User
      User: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
          image: { type: "string", format: "uri" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },

      // Video schemas
      Video: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          title: { type: "string" },
          description: { type: "string", nullable: true },
          duration: { type: "string" },
          thumbnailUrl: { type: "string", format: "uri", nullable: true },
          videoUrl: { type: "string", format: "uri", nullable: true },
          transcript: { type: "string", nullable: true },
          aiSummary: { type: "string", nullable: true },
          aiActionItems: { type: "string", nullable: true },
          aiTags: {
            type: "array",
            items: { type: "string" },
            nullable: true,
          },
          processingStatus: {
            type: "string",
            enum: ["pending", "processing", "completed", "failed"],
          },
          authorId: { type: "string", format: "uuid" },
          organizationId: { type: "string", format: "uuid" },
          channelId: { type: "string", format: "uuid", nullable: true },
          collectionId: { type: "string", format: "uuid", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      VideoWithDetails: {
        allOf: [
          { $ref: "#/components/schemas/Video" },
          {
            type: "object",
            properties: {
              author: { $ref: "#/components/schemas/User" },
              organization: { $ref: "#/components/schemas/Organization" },
              channel: { $ref: "#/components/schemas/Channel" },
              collection: { $ref: "#/components/schemas/Series" },
              comments: {
                type: "array",
                items: { $ref: "#/components/schemas/Comment" },
              },
            },
          },
        ],
      },
      PaginatedVideos: {
        type: "object",
        properties: {
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/Video" },
          },
          pagination: { $ref: "#/components/schemas/Pagination" },
        },
      },
      CreateVideoRequest: {
        type: "object",
        required: ["title", "duration", "organizationId"],
        properties: {
          title: { type: "string", minLength: 1, maxLength: 200 },
          description: { type: "string", maxLength: 5000 },
          duration: { type: "string" },
          thumbnailUrl: { type: "string", format: "uri" },
          videoUrl: { type: "string", format: "uri" },
          organizationId: { type: "string", format: "uuid" },
          channelId: { type: "string", format: "uuid" },
          collectionId: { type: "string", format: "uuid" },
          transcript: { type: "string" },
          aiSummary: { type: "string" },
        },
      },
      UpdateVideoRequest: {
        type: "object",
        properties: {
          title: { type: "string", minLength: 1, maxLength: 200 },
          description: { type: "string", maxLength: 5000 },
          channelId: { type: "string", format: "uuid" },
          collectionId: { type: "string", format: "uuid" },
        },
      },
      VideoProgress: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          videoId: { type: "string", format: "uuid" },
          userId: { type: "string", format: "uuid" },
          currentTime: { type: "string" },
          completed: { type: "boolean" },
          lastWatchedAt: { type: "string", format: "date-time" },
        },
      },
      UpdateProgressRequest: {
        type: "object",
        required: ["currentTime"],
        properties: {
          currentTime: { type: "string" },
          completed: { type: "boolean" },
        },
      },

      // Chapter schemas
      Chapter: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          videoId: { type: "string", format: "uuid" },
          title: { type: "string" },
          summary: { type: "string", nullable: true },
          startTime: { type: "integer" },
          endTime: { type: "integer", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      CreateChapterRequest: {
        type: "object",
        required: ["title", "startTime"],
        properties: {
          title: { type: "string", minLength: 1, maxLength: 100 },
          summary: { type: "string", maxLength: 500 },
          startTime: { type: "integer", minimum: 0 },
          endTime: { type: "integer", minimum: 1 },
        },
      },

      // Code snippet schemas
      CodeSnippet: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          videoId: { type: "string", format: "uuid" },
          code: { type: "string" },
          language: { type: "string", nullable: true },
          title: { type: "string", nullable: true },
          description: { type: "string", nullable: true },
          timestamp: { type: "integer", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      CreateCodeSnippetRequest: {
        type: "object",
        required: ["code"],
        properties: {
          code: { type: "string", minLength: 1, maxLength: 10000 },
          language: { type: "string", maxLength: 50 },
          title: { type: "string", maxLength: 100 },
          description: { type: "string", maxLength: 500 },
          timestamp: { type: "integer", minimum: 0 },
        },
      },

      // Series schemas
      Series: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          description: { type: "string", nullable: true },
          thumbnailUrl: { type: "string", format: "uri", nullable: true },
          organizationId: { type: "string", format: "uuid" },
          createdById: { type: "string", format: "uuid", nullable: true },
          isPublic: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      SeriesWithVideos: {
        allOf: [
          { $ref: "#/components/schemas/Series" },
          {
            type: "object",
            properties: {
              videos: {
                type: "array",
                items: { $ref: "#/components/schemas/Video" },
              },
              videoCount: { type: "integer" },
            },
          },
        ],
      },
      PaginatedSeries: {
        type: "object",
        properties: {
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/Series" },
          },
          pagination: { $ref: "#/components/schemas/Pagination" },
        },
      },
      CreateSeriesRequest: {
        type: "object",
        required: ["name", "organizationId"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 100 },
          description: { type: "string", maxLength: 1000 },
          thumbnailUrl: { type: "string", format: "uri" },
          organizationId: { type: "string", format: "uuid" },
          isPublic: { type: "boolean", default: false },
        },
      },
      UpdateSeriesRequest: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 100 },
          description: { type: "string", maxLength: 1000 },
          thumbnailUrl: { type: "string", format: "uri" },
          isPublic: { type: "boolean" },
        },
      },
      AddVideoToSeriesRequest: {
        type: "object",
        required: ["videoId"],
        properties: {
          videoId: { type: "string", format: "uuid" },
          position: { type: "integer", minimum: 0 },
        },
      },
      ReorderSeriesVideosRequest: {
        type: "object",
        required: ["videoIds"],
        properties: {
          videoIds: {
            type: "array",
            items: { type: "string", format: "uuid" },
            minItems: 1,
          },
        },
      },
      SeriesProgress: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          seriesId: { type: "string", format: "uuid" },
          userId: { type: "string", format: "uuid" },
          lastVideoId: { type: "string", format: "uuid", nullable: true },
          lastPosition: { type: "integer" },
          completedVideoIds: {
            type: "array",
            items: { type: "string", format: "uuid" },
          },
          completedCount: { type: "integer" },
          totalCount: { type: "integer" },
          progressPercentage: { type: "number" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      UpdateSeriesProgressRequest: {
        type: "object",
        properties: {
          lastVideoId: { type: "string", format: "uuid" },
          lastPosition: { type: "integer", minimum: 0 },
          completedVideoIds: {
            type: "array",
            items: { type: "string", format: "uuid" },
          },
        },
      },

      // Channel schemas
      Channel: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          description: { type: "string", nullable: true },
          organizationId: { type: "string", format: "uuid" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      ChannelWithVideos: {
        allOf: [
          { $ref: "#/components/schemas/Channel" },
          {
            type: "object",
            properties: {
              videos: {
                type: "array",
                items: { $ref: "#/components/schemas/Video" },
              },
            },
          },
        ],
      },

      // Organization schemas
      Organization: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          slug: { type: "string" },
          description: { type: "string", nullable: true },
          logo: { type: "string", format: "uri", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      OrganizationWithMembers: {
        allOf: [
          { $ref: "#/components/schemas/Organization" },
          {
            type: "object",
            properties: {
              members: {
                type: "array",
                items: { $ref: "#/components/schemas/Member" },
              },
            },
          },
        ],
      },
      CreateOrganizationRequest: {
        type: "object",
        required: ["name", "slug"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 100 },
          slug: {
            type: "string",
            minLength: 1,
            maxLength: 50,
            pattern: "^[a-z0-9-]+$",
          },
          description: { type: "string", maxLength: 500 },
          logo: { type: "string", format: "uri" },
        },
      },
      UpdateOrganizationRequest: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 100 },
          description: { type: "string", maxLength: 500 },
          logo: { type: "string", format: "uri" },
        },
      },
      Member: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          userId: { type: "string", format: "uuid" },
          organizationId: { type: "string", format: "uuid" },
          role: { type: "string", enum: ["owner", "member"] },
          user: { $ref: "#/components/schemas/User" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      CreateInvitationRequest: {
        type: "object",
        required: ["email"],
        properties: {
          email: { type: "string", format: "email" },
          role: { type: "string", enum: ["owner", "member"], default: "member" },
        },
      },

      // Comment schemas
      Comment: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          videoId: { type: "string", format: "uuid" },
          authorId: { type: "string", format: "uuid" },
          content: { type: "string" },
          timestamp: { type: "string", nullable: true },
          parentId: { type: "string", format: "uuid", nullable: true },
          author: { $ref: "#/components/schemas/User" },
          replies: {
            type: "array",
            items: { $ref: "#/components/schemas/Comment" },
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      CreateCommentRequest: {
        type: "object",
        required: ["content"],
        properties: {
          content: { type: "string", minLength: 1, maxLength: 2000 },
          timestamp: {
            type: "string",
            pattern: "^\\d+:\\d{2}(:\\d{2})?$",
          },
          parentId: { type: "string", format: "uuid" },
        },
      },
      UpdateCommentRequest: {
        type: "object",
        required: ["content"],
        properties: {
          content: { type: "string", minLength: 1, maxLength: 2000 },
        },
      },

      // Search schemas
      SearchResponse: {
        type: "object",
        properties: {
          results: {
            type: "array",
            items: {
              type: "object",
              properties: {
                video: { $ref: "#/components/schemas/Video" },
                rank: { type: "number" },
                highlights: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    transcript: { type: "string" },
                  },
                },
              },
            },
          },
          total: { type: "integer" },
          query: { type: "string" },
          filters: { type: "object" },
          pagination: { $ref: "#/components/schemas/Pagination" },
        },
      },
      SearchSuggestion: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["recent", "popular", "video"] },
          text: { type: "string" },
          videoId: { type: "string", format: "uuid" },
          count: { type: "integer" },
        },
      },
      SavedSearch: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          userId: { type: "string", format: "uuid" },
          query: { type: "string" },
          name: { type: "string", nullable: true },
          filters: { type: "object" },
          createdAt: { type: "string", format: "date-time" },
        },
      },

      // Notification schemas
      Notification: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          userId: { type: "string", format: "uuid" },
          type: {
            type: "string",
            enum: ["comment", "reply", "mention", "video_processed", "invitation", "team_update"],
          },
          title: { type: "string" },
          message: { type: "string" },
          read: { type: "boolean" },
          data: { type: "object" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      UpdateNotificationRequest: {
        type: "object",
        required: ["read"],
        properties: {
          read: { type: "boolean" },
        },
      },

      // Billing schemas
      BillingInfo: {
        type: "object",
        properties: {
          subscription: { $ref: "#/components/schemas/Subscription" },
          usage: { $ref: "#/components/schemas/Usage" },
          invoices: {
            type: "array",
            items: { $ref: "#/components/schemas/Invoice" },
          },
        },
      },
      Plan: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          priceMonthly: { type: "number" },
          priceYearly: { type: "number" },
          features: {
            type: "array",
            items: { type: "string" },
          },
          limits: {
            type: "object",
            properties: {
              videos: { type: "integer" },
              storage: { type: "integer" },
              members: { type: "integer" },
            },
          },
        },
      },
      Subscription: {
        type: "object",
        properties: {
          id: { type: "string" },
          planId: { type: "string" },
          status: {
            type: "string",
            enum: ["active", "canceled", "past_due", "trialing"],
          },
          currentPeriodStart: { type: "string", format: "date-time" },
          currentPeriodEnd: { type: "string", format: "date-time" },
          cancelAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      Invoice: {
        type: "object",
        properties: {
          id: { type: "string" },
          amount: { type: "number" },
          currency: { type: "string" },
          status: { type: "string", enum: ["paid", "open", "void", "uncollectible"] },
          invoiceUrl: { type: "string", format: "uri" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Usage: {
        type: "object",
        properties: {
          videos: {
            type: "object",
            properties: {
              used: { type: "integer" },
              limit: { type: "integer" },
            },
          },
          storage: {
            type: "object",
            properties: {
              used: { type: "integer" },
              limit: { type: "integer" },
            },
          },
          members: {
            type: "object",
            properties: {
              used: { type: "integer" },
              limit: { type: "integer" },
            },
          },
        },
      },
      CreateCheckoutRequest: {
        type: "object",
        required: ["planId"],
        properties: {
          planId: { type: "string" },
          billingPeriod: { type: "string", enum: ["monthly", "yearly"], default: "monthly" },
          successUrl: { type: "string", format: "uri" },
          cancelUrl: { type: "string", format: "uri" },
        },
      },

      // AI schemas
      AnalyzeVideoRequest: {
        type: "object",
        required: ["videoId"],
        properties: {
          videoId: { type: "string", format: "uuid" },
          options: {
            type: "object",
            properties: {
              generateTranscript: { type: "boolean", default: true },
              generateSummary: { type: "boolean", default: true },
              extractActionItems: { type: "boolean", default: true },
              generateTags: { type: "boolean", default: true },
            },
          },
        },
      },

      // Integration schemas
      Integration: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          organizationId: { type: "string", format: "uuid" },
          provider: { type: "string", enum: ["google", "zoom"] },
          status: { type: "string", enum: ["connected", "disconnected", "error"] },
          connectedAt: { type: "string", format: "date-time" },
        },
      },
      Recording: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          duration: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          thumbnailUrl: { type: "string", format: "uri", nullable: true },
          provider: { type: "string", enum: ["google", "zoom"] },
        },
      },
      ImportMeetingRequest: {
        type: "object",
        required: ["meetingId", "recordingId"],
        properties: {
          meetingId: { type: "string" },
          recordingId: { type: "string" },
          title: { type: "string", maxLength: 200 },
        },
      },
    },
  },
};
