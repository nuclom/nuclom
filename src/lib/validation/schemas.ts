import { Schema } from "effect";

// =============================================================================
// Common Schemas
// =============================================================================

export const UuidSchema = Schema.UUID;

export const PaginationSchema = Schema.Struct({
  page: Schema.optionalWith(Schema.NumberFromString.pipe(Schema.int(), Schema.positive()), { default: () => 1 }),
  limit: Schema.optionalWith(
    Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1), Schema.lessThanOrEqualTo(100)),
    { default: () => 20 },
  ),
});

export const TimestampFormatSchema = Schema.String.pipe(
  Schema.pattern(/^\d+:\d{2}(:\d{2})?$/, {
    message: () => "Invalid timestamp format (expected MM:SS or HH:MM:SS)",
  }),
);

// =============================================================================
// Video Schemas
// =============================================================================

export const CreateVideoSchema = Schema.Struct({
  title: Schema.Trim.pipe(
    Schema.minLength(1, { message: () => "Title is required" }),
    Schema.maxLength(200, { message: () => "Title must be 200 characters or less" }),
  ),
  description: Schema.optionalWith(
    Schema.NullOr(
      Schema.Trim.pipe(Schema.maxLength(5000, { message: () => "Description must be 5000 characters or less" })),
    ),
    { nullable: true },
  ),
  duration: Schema.String.pipe(Schema.minLength(1, { message: () => "Duration is required" })),
  thumbnailUrl: Schema.optionalWith(
    Schema.NullOr(
      Schema.String.pipe(Schema.filter((s) => URL.canParse(s), { message: () => "Invalid thumbnail URL" })),
    ),
    { nullable: true },
  ),
  videoUrl: Schema.optionalWith(
    Schema.NullOr(Schema.String.pipe(Schema.filter((s) => URL.canParse(s), { message: () => "Invalid video URL" }))),
    { nullable: true },
  ),
  organizationId: UuidSchema,
  channelId: Schema.optionalWith(Schema.NullOr(UuidSchema), { nullable: true }),
  collectionId: Schema.optionalWith(Schema.NullOr(UuidSchema), { nullable: true }),
  transcript: Schema.optionalWith(Schema.NullOr(Schema.String), { nullable: true }),
  aiSummary: Schema.optionalWith(Schema.NullOr(Schema.String), { nullable: true }),
});

export const UpdateVideoSchema = Schema.Struct({
  title: Schema.optional(
    Schema.Trim.pipe(
      Schema.minLength(1, { message: () => "Title is required" }),
      Schema.maxLength(200, { message: () => "Title must be 200 characters or less" }),
    ),
  ),
  description: Schema.optionalWith(
    Schema.NullOr(
      Schema.Trim.pipe(Schema.maxLength(5000, { message: () => "Description must be 5000 characters or less" })),
    ),
    { nullable: true },
  ),
  channelId: Schema.optionalWith(Schema.NullOr(UuidSchema), { nullable: true }),
  collectionId: Schema.optionalWith(Schema.NullOr(UuidSchema), { nullable: true }),
});

export const VideoUploadSchema = Schema.Struct({
  title: Schema.Trim.pipe(
    Schema.minLength(1, { message: () => "Title is required" }),
    Schema.maxLength(200, { message: () => "Title must be 200 characters or less" }),
  ),
  description: Schema.optional(
    Schema.Trim.pipe(Schema.maxLength(5000, { message: () => "Description must be 5000 characters or less" })),
  ),
  organizationId: UuidSchema,
  authorId: UuidSchema,
  channelId: Schema.optional(UuidSchema),
  collectionId: Schema.optional(UuidSchema),
  skipAIProcessing: Schema.optional(Schema.Literal("true", "false")),
});

export const GetVideosSchema = Schema.Struct({
  organizationId: UuidSchema,
  page: Schema.optionalWith(Schema.NumberFromString.pipe(Schema.int(), Schema.positive()), { default: () => 1 }),
  limit: Schema.optionalWith(
    Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1), Schema.lessThanOrEqualTo(100)),
    { default: () => 20 },
  ),
});

// =============================================================================
// Video Chapter Schemas
// =============================================================================

const BaseChapterSchema = Schema.Struct({
  title: Schema.Trim.pipe(
    Schema.minLength(1, { message: () => "Title is required" }),
    Schema.maxLength(100, { message: () => "Title must be 100 characters or less" }),
  ),
  summary: Schema.optionalWith(
    Schema.NullOr(Schema.Trim.pipe(Schema.maxLength(500, { message: () => "Summary must be 500 characters or less" }))),
    { nullable: true },
  ),
  startTime: Schema.Number.pipe(Schema.int(), Schema.nonNegative({ message: () => "Start time must be positive" })),
  endTime: Schema.optionalWith(
    Schema.NullOr(Schema.Number.pipe(Schema.int(), Schema.positive({ message: () => "End time must be positive" }))),
    { nullable: true },
  ),
});

export const CreateChapterSchema = BaseChapterSchema.pipe(
  Schema.filter((data) => !data.endTime || data.endTime > data.startTime, {
    message: () => "End time must be greater than start time",
  }),
);

// =============================================================================
// Video Code Snippet Schemas
// =============================================================================

export const CreateCodeSnippetSchema = Schema.Struct({
  code: Schema.String.pipe(
    Schema.minLength(1, { message: () => "Code is required" }),
    Schema.maxLength(10000, { message: () => "Code must be 10000 characters or less" }),
  ),
  language: Schema.optionalWith(
    Schema.NullOr(
      Schema.String.pipe(Schema.maxLength(50, { message: () => "Language must be 50 characters or less" })),
    ),
    { nullable: true },
  ),
  title: Schema.optionalWith(
    Schema.NullOr(Schema.Trim.pipe(Schema.maxLength(100, { message: () => "Title must be 100 characters or less" }))),
    { nullable: true },
  ),
  description: Schema.optionalWith(
    Schema.NullOr(
      Schema.Trim.pipe(Schema.maxLength(500, { message: () => "Description must be 500 characters or less" })),
    ),
    { nullable: true },
  ),
  timestamp: Schema.optionalWith(Schema.NullOr(Schema.Number.pipe(Schema.int(), Schema.nonNegative())), {
    nullable: true,
  }),
});

// =============================================================================
// Series Schemas
// =============================================================================

export const CreateSeriesSchema = Schema.Struct({
  name: Schema.Trim.pipe(
    Schema.minLength(1, { message: () => "Name is required" }),
    Schema.maxLength(100, { message: () => "Name must be 100 characters or less" }),
  ),
  description: Schema.optionalWith(
    Schema.NullOr(
      Schema.Trim.pipe(Schema.maxLength(1000, { message: () => "Description must be 1000 characters or less" })),
    ),
    { nullable: true },
  ),
  thumbnailUrl: Schema.optionalWith(
    Schema.NullOr(
      Schema.String.pipe(Schema.filter((s) => URL.canParse(s), { message: () => "Invalid thumbnail URL" })),
    ),
    { nullable: true },
  ),
  organizationId: UuidSchema,
  isPublic: Schema.optionalWith(Schema.Boolean, { default: () => false }),
});

export const UpdateSeriesSchema = Schema.Struct({
  name: Schema.optional(
    Schema.Trim.pipe(
      Schema.minLength(1, { message: () => "Name is required" }),
      Schema.maxLength(100, { message: () => "Name must be 100 characters or less" }),
    ),
  ),
  description: Schema.optionalWith(
    Schema.NullOr(
      Schema.Trim.pipe(Schema.maxLength(1000, { message: () => "Description must be 1000 characters or less" })),
    ),
    { nullable: true },
  ),
  thumbnailUrl: Schema.optionalWith(
    Schema.NullOr(
      Schema.String.pipe(Schema.filter((s) => URL.canParse(s), { message: () => "Invalid thumbnail URL" })),
    ),
    { nullable: true },
  ),
  isPublic: Schema.optional(Schema.Boolean),
});

export const GetSeriesSchema = Schema.Struct({
  organizationId: UuidSchema,
  page: Schema.optionalWith(Schema.NumberFromString.pipe(Schema.int(), Schema.positive()), { default: () => 1 }),
  limit: Schema.optionalWith(
    Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1), Schema.lessThanOrEqualTo(100)),
    { default: () => 20 },
  ),
});

export const AddVideoToSeriesSchema = Schema.Struct({
  videoId: UuidSchema,
  position: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
});

export const ReorderSeriesVideosSchema = Schema.Struct({
  videoIds: Schema.Array(UuidSchema).pipe(Schema.minItems(1, { message: () => "At least one video ID is required" })),
});

// =============================================================================
// Comment Schemas
// =============================================================================

export const CreateCommentSchema = Schema.Struct({
  content: Schema.Trim.pipe(
    Schema.minLength(1, { message: () => "Comment content is required" }),
    Schema.maxLength(2000, { message: () => "Comment must be 2000 characters or less" }),
  ),
  timestamp: Schema.optionalWith(Schema.NullOr(TimestampFormatSchema), { nullable: true }),
  parentId: Schema.optionalWith(Schema.NullOr(UuidSchema), { nullable: true }),
});

export const UpdateCommentSchema = Schema.Struct({
  content: Schema.Trim.pipe(
    Schema.minLength(1, { message: () => "Comment content is required" }),
    Schema.maxLength(2000, { message: () => "Comment must be 2000 characters or less" }),
  ),
});

// =============================================================================
// Organization Schemas
// =============================================================================

export const CreateOrganizationSchema = Schema.Struct({
  name: Schema.Trim.pipe(
    Schema.minLength(1, { message: () => "Name is required" }),
    Schema.maxLength(100, { message: () => "Name must be 100 characters or less" }),
  ),
  slug: Schema.optional(
    Schema.String.pipe(
      Schema.minLength(1, { message: () => "Slug is required" }),
      Schema.maxLength(50, { message: () => "Slug must be 50 characters or less" }),
      Schema.pattern(/^[a-z0-9-]+$/, {
        message: () => "Slug must only contain lowercase letters, numbers, and hyphens",
      }),
    ),
  ),
  description: Schema.optionalWith(
    Schema.NullOr(
      Schema.Trim.pipe(Schema.maxLength(500, { message: () => "Description must be 500 characters or less" })),
    ),
    { nullable: true },
  ),
  logo: Schema.optionalWith(
    Schema.NullOr(Schema.String.pipe(Schema.filter((s) => URL.canParse(s), { message: () => "Invalid logo URL" }))),
    { nullable: true },
  ),
});

export const UpdateOrganizationSchema = Schema.Struct({
  name: Schema.optional(
    Schema.Trim.pipe(
      Schema.minLength(1, { message: () => "Name is required" }),
      Schema.maxLength(100, { message: () => "Name must be 100 characters or less" }),
    ),
  ),
  description: Schema.optionalWith(
    Schema.NullOr(
      Schema.Trim.pipe(Schema.maxLength(500, { message: () => "Description must be 500 characters or less" })),
    ),
    { nullable: true },
  ),
  logo: Schema.optionalWith(
    Schema.NullOr(Schema.String.pipe(Schema.filter((s) => URL.canParse(s), { message: () => "Invalid logo URL" }))),
    { nullable: true },
  ),
});

// =============================================================================
// Invitation Schemas
// =============================================================================

export const CreateInvitationSchema = Schema.Struct({
  email: Schema.String.pipe(
    Schema.filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s), { message: () => "Invalid email address" }),
  ),
  role: Schema.optionalWith(Schema.Literal("owner", "member"), { default: () => "member" as const }),
});

// =============================================================================
// Video Progress Schemas
// =============================================================================

export const UpdateProgressSchema = Schema.Struct({
  currentTime: Schema.String.pipe(Schema.minLength(1, { message: () => "Current time is required" })),
  completed: Schema.optional(Schema.Boolean),
});

// =============================================================================
// Series Progress Schemas
// =============================================================================

export const UpdateSeriesProgressSchema = Schema.Struct({
  lastVideoId: Schema.optional(UuidSchema),
  lastPosition: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  completedVideoIds: Schema.optional(Schema.Array(UuidSchema)),
});

// =============================================================================
// Notification Schemas
// =============================================================================

export const UpdateNotificationSchema = Schema.Struct({
  read: Schema.Boolean,
});

// =============================================================================
// Billing Schemas
// =============================================================================

export const CreateCheckoutSchema = Schema.Struct({
  planId: Schema.String.pipe(Schema.minLength(1, { message: () => "Plan ID is required" })),
  billingPeriod: Schema.optionalWith(Schema.Literal("monthly", "yearly"), { default: () => "monthly" as const }),
  successUrl: Schema.optional(
    Schema.String.pipe(Schema.filter((s) => URL.canParse(s), { message: () => "Invalid success URL" })),
  ),
  cancelUrl: Schema.optional(
    Schema.String.pipe(Schema.filter((s) => URL.canParse(s), { message: () => "Invalid cancel URL" })),
  ),
});

// =============================================================================
// Integration Schemas
// =============================================================================

export const ImportMeetingSchema = Schema.Struct({
  meetingId: Schema.String.pipe(Schema.minLength(1, { message: () => "Meeting ID is required" })),
  recordingId: Schema.String.pipe(Schema.minLength(1, { message: () => "Recording ID is required" })),
  title: Schema.optional(Schema.Trim.pipe(Schema.maxLength(200))),
});

// =============================================================================
// AI Processing Schemas
// =============================================================================

export const AnalyzeVideoSchema = Schema.Struct({
  videoId: UuidSchema,
  options: Schema.optional(
    Schema.Struct({
      generateTranscript: Schema.optionalWith(Schema.Boolean, { default: () => true }),
      generateSummary: Schema.optionalWith(Schema.Boolean, { default: () => true }),
      extractActionItems: Schema.optionalWith(Schema.Boolean, { default: () => true }),
      generateTags: Schema.optionalWith(Schema.Boolean, { default: () => true }),
    }),
  ),
});

// =============================================================================
// Type Exports
// =============================================================================

export type CreateVideoInput = typeof CreateVideoSchema.Type;
export type UpdateVideoInput = typeof UpdateVideoSchema.Type;
export type VideoUploadInput = typeof VideoUploadSchema.Type;
export type GetVideosInput = typeof GetVideosSchema.Type;

export type CreateChapterInput = typeof CreateChapterSchema.Type;
export type CreateCodeSnippetInput = typeof CreateCodeSnippetSchema.Type;

export type CreateSeriesInput = typeof CreateSeriesSchema.Type;
export type UpdateSeriesInput = typeof UpdateSeriesSchema.Type;
export type GetSeriesInput = typeof GetSeriesSchema.Type;
export type AddVideoToSeriesInput = typeof AddVideoToSeriesSchema.Type;
export type ReorderSeriesVideosInput = typeof ReorderSeriesVideosSchema.Type;

export type CreateCommentInput = typeof CreateCommentSchema.Type;
export type UpdateCommentInput = typeof UpdateCommentSchema.Type;

export type CreateOrganizationInput = typeof CreateOrganizationSchema.Type;
export type UpdateOrganizationInput = typeof UpdateOrganizationSchema.Type;

export type CreateInvitationInput = typeof CreateInvitationSchema.Type;
export type UpdateProgressInput = typeof UpdateProgressSchema.Type;
export type UpdateSeriesProgressInput = typeof UpdateSeriesProgressSchema.Type;
export type UpdateNotificationInput = typeof UpdateNotificationSchema.Type;

export type CreateCheckoutInput = typeof CreateCheckoutSchema.Type;
export type ImportMeetingInput = typeof ImportMeetingSchema.Type;
export type AnalyzeVideoInput = typeof AnalyzeVideoSchema.Type;

// =============================================================================
// Legacy aliases for backwards compatibility (lowercase names)
// =============================================================================

export const uuidSchema = UuidSchema;
export const paginationSchema = PaginationSchema;
export const timestampSchema = TimestampFormatSchema;
export const createVideoSchema = CreateVideoSchema;
export const updateVideoSchema = UpdateVideoSchema;
export const videoUploadSchema = VideoUploadSchema;
export const getVideosSchema = GetVideosSchema;
export const createChapterSchema = CreateChapterSchema;
export const createCodeSnippetSchema = CreateCodeSnippetSchema;
export const createSeriesSchema = CreateSeriesSchema;
export const updateSeriesSchema = UpdateSeriesSchema;
export const getSeriesSchema = GetSeriesSchema;
export const addVideoToSeriesSchema = AddVideoToSeriesSchema;
export const reorderSeriesVideosSchema = ReorderSeriesVideosSchema;
export const createCommentSchema = CreateCommentSchema;
export const updateCommentSchema = UpdateCommentSchema;
export const createOrganizationSchema = CreateOrganizationSchema;
export const updateOrganizationSchema = UpdateOrganizationSchema;
export const createInvitationSchema = CreateInvitationSchema;
export const updateProgressSchema = UpdateProgressSchema;
export const updateSeriesProgressSchema = UpdateSeriesProgressSchema;
export const updateNotificationSchema = UpdateNotificationSchema;
export const createCheckoutSchema = CreateCheckoutSchema;
export const importMeetingSchema = ImportMeetingSchema;
export const analyzeVideoSchema = AnalyzeVideoSchema;
