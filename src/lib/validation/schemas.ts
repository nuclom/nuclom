import { z } from "zod";

// =============================================================================
// Common Schemas
// =============================================================================

export const uuidSchema = z.string().uuid("Invalid UUID format");

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const timestampSchema = z.string().regex(/^\d+:\d{2}(:\d{2})?$/, "Invalid timestamp format (expected MM:SS or HH:MM:SS)");

// =============================================================================
// Video Schemas
// =============================================================================

export const createVideoSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or less")
    .trim(),
  description: z
    .string()
    .max(5000, "Description must be 5000 characters or less")
    .trim()
    .optional()
    .nullable(),
  duration: z.string().min(1, "Duration is required"),
  thumbnailUrl: z.string().url("Invalid thumbnail URL").optional().nullable(),
  videoUrl: z.string().url("Invalid video URL").optional().nullable(),
  organizationId: uuidSchema,
  channelId: uuidSchema.optional().nullable(),
  collectionId: uuidSchema.optional().nullable(),
  transcript: z.string().optional().nullable(),
  aiSummary: z.string().optional().nullable(),
});

export const updateVideoSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or less")
    .trim()
    .optional(),
  description: z
    .string()
    .max(5000, "Description must be 5000 characters or less")
    .trim()
    .optional()
    .nullable(),
  channelId: uuidSchema.optional().nullable(),
  collectionId: uuidSchema.optional().nullable(),
});

export const videoUploadSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or less")
    .trim(),
  description: z
    .string()
    .max(5000, "Description must be 5000 characters or less")
    .trim()
    .optional(),
  organizationId: uuidSchema,
  authorId: uuidSchema,
  channelId: uuidSchema.optional(),
  collectionId: uuidSchema.optional(),
  skipAIProcessing: z.enum(["true", "false"]).optional(),
});

export const getVideosSchema = z.object({
  organizationId: uuidSchema,
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// =============================================================================
// Video Chapter Schemas
// =============================================================================

export const createChapterSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(100, "Title must be 100 characters or less")
    .trim(),
  summary: z
    .string()
    .max(500, "Summary must be 500 characters or less")
    .trim()
    .optional()
    .nullable(),
  startTime: z.number().int().nonnegative("Start time must be positive"),
  endTime: z.number().int().positive("End time must be positive").optional().nullable(),
}).refine(
  (data) => !data.endTime || data.endTime > data.startTime,
  { message: "End time must be greater than start time", path: ["endTime"] }
);

// =============================================================================
// Video Code Snippet Schemas
// =============================================================================

export const createCodeSnippetSchema = z.object({
  code: z
    .string()
    .min(1, "Code is required")
    .max(10000, "Code must be 10000 characters or less"),
  language: z
    .string()
    .max(50, "Language must be 50 characters or less")
    .optional()
    .nullable(),
  title: z
    .string()
    .max(100, "Title must be 100 characters or less")
    .trim()
    .optional()
    .nullable(),
  description: z
    .string()
    .max(500, "Description must be 500 characters or less")
    .trim()
    .optional()
    .nullable(),
  timestamp: z.number().int().nonnegative().optional().nullable(),
});

// =============================================================================
// Series Schemas
// =============================================================================

export const createSeriesSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less")
    .trim(),
  description: z
    .string()
    .max(1000, "Description must be 1000 characters or less")
    .trim()
    .optional()
    .nullable(),
  thumbnailUrl: z.string().url("Invalid thumbnail URL").optional().nullable(),
  organizationId: uuidSchema,
  isPublic: z.boolean().default(false),
});

export const updateSeriesSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less")
    .trim()
    .optional(),
  description: z
    .string()
    .max(1000, "Description must be 1000 characters or less")
    .trim()
    .optional()
    .nullable(),
  thumbnailUrl: z.string().url("Invalid thumbnail URL").optional().nullable(),
  isPublic: z.boolean().optional(),
});

export const getSeriesSchema = z.object({
  organizationId: uuidSchema,
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const addVideoToSeriesSchema = z.object({
  videoId: uuidSchema,
  position: z.number().int().nonnegative().optional(),
});

export const reorderSeriesVideosSchema = z.object({
  videoIds: z.array(uuidSchema).min(1, "At least one video ID is required"),
});

// =============================================================================
// Comment Schemas
// =============================================================================

export const createCommentSchema = z.object({
  content: z
    .string()
    .min(1, "Comment content is required")
    .max(2000, "Comment must be 2000 characters or less")
    .trim(),
  timestamp: timestampSchema.optional().nullable(),
  parentId: uuidSchema.optional().nullable(),
});

export const updateCommentSchema = z.object({
  content: z
    .string()
    .min(1, "Comment content is required")
    .max(2000, "Comment must be 2000 characters or less")
    .trim(),
});

// =============================================================================
// Organization Schemas
// =============================================================================

export const createOrganizationSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less")
    .trim(),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(50, "Slug must be 50 characters or less")
    .regex(/^[a-z0-9-]+$/, "Slug must only contain lowercase letters, numbers, and hyphens")
    .optional(),
  description: z
    .string()
    .max(500, "Description must be 500 characters or less")
    .trim()
    .optional()
    .nullable(),
  logo: z.string().url("Invalid logo URL").optional().nullable(),
});

export const updateOrganizationSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less")
    .trim()
    .optional(),
  description: z
    .string()
    .max(500, "Description must be 500 characters or less")
    .trim()
    .optional()
    .nullable(),
  logo: z.string().url("Invalid logo URL").optional().nullable(),
});

// =============================================================================
// Invitation Schemas
// =============================================================================

export const createInvitationSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["owner", "member"]).default("member"),
});

// =============================================================================
// Video Progress Schemas
// =============================================================================

export const updateProgressSchema = z.object({
  currentTime: z.string().min(1, "Current time is required"),
  completed: z.boolean().optional(),
});

// =============================================================================
// Series Progress Schemas
// =============================================================================

export const updateSeriesProgressSchema = z.object({
  lastVideoId: uuidSchema.optional(),
  lastPosition: z.number().int().nonnegative().optional(),
  completedVideoIds: z.array(uuidSchema).optional(),
});

// =============================================================================
// Notification Schemas
// =============================================================================

export const updateNotificationSchema = z.object({
  read: z.boolean(),
});

// =============================================================================
// Billing Schemas
// =============================================================================

export const createCheckoutSchema = z.object({
  planId: z.string().min(1, "Plan ID is required"),
  billingPeriod: z.enum(["monthly", "yearly"]).default("monthly"),
  successUrl: z.string().url("Invalid success URL").optional(),
  cancelUrl: z.string().url("Invalid cancel URL").optional(),
});

// =============================================================================
// Integration Schemas
// =============================================================================

export const importMeetingSchema = z.object({
  meetingId: z.string().min(1, "Meeting ID is required"),
  recordingId: z.string().min(1, "Recording ID is required"),
  title: z.string().max(200).trim().optional(),
});

// =============================================================================
// AI Processing Schemas
// =============================================================================

export const analyzeVideoSchema = z.object({
  videoId: uuidSchema,
  options: z.object({
    generateTranscript: z.boolean().default(true),
    generateSummary: z.boolean().default(true),
    extractActionItems: z.boolean().default(true),
    generateTags: z.boolean().default(true),
  }).optional(),
});

// =============================================================================
// Type Exports
// =============================================================================

export type CreateVideoInput = z.infer<typeof createVideoSchema>;
export type UpdateVideoInput = z.infer<typeof updateVideoSchema>;
export type VideoUploadInput = z.infer<typeof videoUploadSchema>;
export type GetVideosInput = z.infer<typeof getVideosSchema>;

export type CreateChapterInput = z.infer<typeof createChapterSchema>;
export type CreateCodeSnippetInput = z.infer<typeof createCodeSnippetSchema>;

export type CreateSeriesInput = z.infer<typeof createSeriesSchema>;
export type UpdateSeriesInput = z.infer<typeof updateSeriesSchema>;
export type GetSeriesInput = z.infer<typeof getSeriesSchema>;
export type AddVideoToSeriesInput = z.infer<typeof addVideoToSeriesSchema>;
export type ReorderSeriesVideosInput = z.infer<typeof reorderSeriesVideosSchema>;

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type UpdateProgressInput = z.infer<typeof updateProgressSchema>;
export type UpdateSeriesProgressInput = z.infer<typeof updateSeriesProgressSchema>;
export type UpdateNotificationInput = z.infer<typeof updateNotificationSchema>;

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
export type ImportMeetingInput = z.infer<typeof importMeetingSchema>;
export type AnalyzeVideoInput = z.infer<typeof analyzeVideoSchema>;
