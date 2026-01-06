import { Schema } from 'effect';

// =============================================================================
// Common Field Validators
// =============================================================================

export const EmailSchema = Schema.Trim.pipe(
  Schema.minLength(1, { message: () => 'Email is required' }),
  Schema.filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s), { message: () => 'Please enter a valid email address' }),
);

export const PasswordSchema = Schema.String.pipe(
  Schema.minLength(8, { message: () => 'Password must be at least 8 characters' }),
  Schema.maxLength(100, { message: () => 'Password must be less than 100 characters' }),
);

export const NameSchema = Schema.Trim.pipe(
  Schema.minLength(1, { message: () => 'Name is required' }),
  Schema.maxLength(100, { message: () => 'Name must be less than 100 characters' }),
);

export const SlugSchema = Schema.Trim.pipe(
  Schema.minLength(1, { message: () => 'Slug is required' }),
  Schema.maxLength(50, { message: () => 'Slug must be less than 50 characters' }),
  Schema.pattern(/^[a-z0-9-]+$/, { message: () => 'Slug can only contain lowercase letters, numbers, and hyphens' }),
);

export const UrlOptionalSchema = Schema.optional(
  Schema.Union(
    Schema.String.pipe(Schema.filter((s) => URL.canParse(s), { message: () => 'Please enter a valid URL' })),
    Schema.Literal(''),
  ),
);

export const DescriptionOptionalSchema = Schema.optional(
  Schema.String.pipe(Schema.maxLength(2000, { message: () => 'Description must be less than 2000 characters' })),
);

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
    message: () => 'Invalid timestamp format (expected MM:SS or HH:MM:SS)',
  }),
);

// =============================================================================
// Authentication Schemas
// =============================================================================

export const LoginSchema = Schema.Struct({
  email: EmailSchema,
  password: Schema.String.pipe(Schema.minLength(1, { message: () => 'Password is required' })),
});

const BaseRegisterSchema = Schema.Struct({
  name: NameSchema,
  email: EmailSchema,
  password: PasswordSchema,
  confirmPassword: Schema.String.pipe(Schema.minLength(1, { message: () => 'Please confirm your password' })),
});

export const RegisterSchema = BaseRegisterSchema.pipe(
  Schema.filter((data) => data.password === data.confirmPassword, {
    message: () => 'Passwords do not match',
  }),
);

export const ForgotPasswordSchema = Schema.Struct({
  email: EmailSchema,
});

const BaseResetPasswordSchema = Schema.Struct({
  password: PasswordSchema,
  confirmPassword: Schema.String.pipe(Schema.minLength(1, { message: () => 'Please confirm your password' })),
  token: Schema.String,
});

export const ResetPasswordSchema = BaseResetPasswordSchema.pipe(
  Schema.filter((data) => data.password === data.confirmPassword, {
    message: () => 'Passwords do not match',
  }),
);

const BaseChangePasswordSchema = Schema.Struct({
  currentPassword: Schema.String.pipe(Schema.minLength(1, { message: () => 'Current password is required' })),
  newPassword: PasswordSchema,
  confirmPassword: Schema.String.pipe(Schema.minLength(1, { message: () => 'Please confirm your password' })),
});

export const ChangePasswordSchema = BaseChangePasswordSchema.pipe(
  Schema.filter((data) => data.newPassword === data.confirmPassword, {
    message: () => 'Passwords do not match',
  }),
  Schema.filter((data) => data.currentPassword !== data.newPassword, {
    message: () => 'New password must be different from current password',
  }),
);

// =============================================================================
// Profile Schemas
// =============================================================================

export const UpdateProfileSchema = Schema.Struct({
  name: Schema.optional(NameSchema),
  avatarUrl: UrlOptionalSchema,
  bio: Schema.optional(
    Schema.String.pipe(Schema.maxLength(500, { message: () => 'Bio must be less than 500 characters' })),
  ),
});

// =============================================================================
// Search Schemas
// =============================================================================

export const SearchSchema = Schema.Struct({
  query: Schema.String.pipe(
    Schema.minLength(1, { message: () => 'Search query is required' }),
    Schema.maxLength(200, { message: () => 'Search query is too long' }),
  ),
  type: Schema.optionalWith(Schema.Literal('all', 'videos', 'series', 'channels'), { default: () => 'all' as const }),
  page: Schema.optionalWith(Schema.Number.pipe(Schema.greaterThanOrEqualTo(1)), { default: () => 1 }),
  limit: Schema.optionalWith(Schema.Number.pipe(Schema.greaterThanOrEqualTo(1), Schema.lessThanOrEqualTo(100)), {
    default: () => 20,
  }),
});

// =============================================================================
// Contact/Support Schemas
// =============================================================================

export const ContactSchema = Schema.Struct({
  name: NameSchema,
  email: EmailSchema,
  subject: Schema.Trim.pipe(
    Schema.minLength(1, { message: () => 'Subject is required' }),
    Schema.maxLength(200, { message: () => 'Subject must be less than 200 characters' }),
  ),
  message: Schema.Trim.pipe(
    Schema.minLength(10, { message: () => 'Message must be at least 10 characters' }),
    Schema.maxLength(5000, { message: () => 'Message must be less than 5000 characters' }),
  ),
});

// =============================================================================
// Invite Member Schema
// =============================================================================

export const InviteMemberSchema = Schema.Struct({
  email: EmailSchema,
  role: Schema.Literal('admin', 'member', 'viewer'),
});

// =============================================================================
// Video Schemas
// =============================================================================

export const CreateVideoSchema = Schema.Struct({
  title: Schema.Trim.pipe(
    Schema.minLength(1, { message: () => 'Title is required' }),
    Schema.maxLength(200, { message: () => 'Title must be 200 characters or less' }),
  ),
  description: Schema.optionalWith(
    Schema.NullOr(
      Schema.Trim.pipe(Schema.maxLength(5000, { message: () => 'Description must be 5000 characters or less' })),
    ),
    { nullable: true },
  ),
  duration: Schema.String.pipe(Schema.minLength(1, { message: () => 'Duration is required' })),
  thumbnailUrl: Schema.optionalWith(
    Schema.NullOr(
      Schema.String.pipe(Schema.filter((s) => URL.canParse(s), { message: () => 'Invalid thumbnail URL' })),
    ),
    { nullable: true },
  ),
  videoUrl: Schema.optionalWith(
    Schema.NullOr(Schema.String.pipe(Schema.filter((s) => URL.canParse(s), { message: () => 'Invalid video URL' }))),
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
      Schema.minLength(1, { message: () => 'Title is required' }),
      Schema.maxLength(200, { message: () => 'Title must be 200 characters or less' }),
    ),
  ),
  description: Schema.optionalWith(
    Schema.NullOr(
      Schema.Trim.pipe(Schema.maxLength(5000, { message: () => 'Description must be 5000 characters or less' })),
    ),
    { nullable: true },
  ),
  channelId: Schema.optionalWith(Schema.NullOr(UuidSchema), { nullable: true }),
  collectionId: Schema.optionalWith(Schema.NullOr(UuidSchema), { nullable: true }),
});

export const VideoUploadSchema = Schema.Struct({
  title: Schema.Trim.pipe(
    Schema.minLength(1, { message: () => 'Title is required' }),
    Schema.maxLength(200, { message: () => 'Title must be 200 characters or less' }),
  ),
  description: Schema.optional(
    Schema.Trim.pipe(Schema.maxLength(5000, { message: () => 'Description must be 5000 characters or less' })),
  ),
  organizationId: UuidSchema,
  authorId: UuidSchema,
  channelId: Schema.optional(UuidSchema),
  collectionId: Schema.optional(UuidSchema),
  skipAIProcessing: Schema.optional(Schema.Literal('true', 'false')),
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
    Schema.minLength(1, { message: () => 'Title is required' }),
    Schema.maxLength(100, { message: () => 'Title must be 100 characters or less' }),
  ),
  summary: Schema.optionalWith(
    Schema.NullOr(Schema.Trim.pipe(Schema.maxLength(500, { message: () => 'Summary must be 500 characters or less' }))),
    { nullable: true },
  ),
  startTime: Schema.Number.pipe(Schema.int(), Schema.nonNegative({ message: () => 'Start time must be positive' })),
  endTime: Schema.optionalWith(
    Schema.NullOr(Schema.Number.pipe(Schema.int(), Schema.positive({ message: () => 'End time must be positive' }))),
    { nullable: true },
  ),
});

export const CreateChapterSchema = BaseChapterSchema.pipe(
  Schema.filter((data) => !data.endTime || data.endTime > data.startTime, {
    message: () => 'End time must be greater than start time',
  }),
);

// =============================================================================
// Video Code Snippet Schemas
// =============================================================================

export const CreateCodeSnippetSchema = Schema.Struct({
  code: Schema.String.pipe(
    Schema.minLength(1, { message: () => 'Code is required' }),
    Schema.maxLength(10000, { message: () => 'Code must be 10000 characters or less' }),
  ),
  language: Schema.optionalWith(
    Schema.NullOr(
      Schema.String.pipe(Schema.maxLength(50, { message: () => 'Language must be 50 characters or less' })),
    ),
    { nullable: true },
  ),
  title: Schema.optionalWith(
    Schema.NullOr(Schema.Trim.pipe(Schema.maxLength(100, { message: () => 'Title must be 100 characters or less' }))),
    { nullable: true },
  ),
  description: Schema.optionalWith(
    Schema.NullOr(
      Schema.Trim.pipe(Schema.maxLength(500, { message: () => 'Description must be 500 characters or less' })),
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
    Schema.minLength(1, { message: () => 'Name is required' }),
    Schema.maxLength(100, { message: () => 'Name must be 100 characters or less' }),
  ),
  description: Schema.optionalWith(
    Schema.NullOr(
      Schema.Trim.pipe(Schema.maxLength(1000, { message: () => 'Description must be 1000 characters or less' })),
    ),
    { nullable: true },
  ),
  thumbnailUrl: Schema.optionalWith(
    Schema.NullOr(
      Schema.String.pipe(Schema.filter((s) => URL.canParse(s), { message: () => 'Invalid thumbnail URL' })),
    ),
    { nullable: true },
  ),
  organizationId: UuidSchema,
  isPublic: Schema.optionalWith(Schema.Boolean, { default: () => false }),
});

export const UpdateSeriesSchema = Schema.Struct({
  name: Schema.optional(
    Schema.Trim.pipe(
      Schema.minLength(1, { message: () => 'Name is required' }),
      Schema.maxLength(100, { message: () => 'Name must be 100 characters or less' }),
    ),
  ),
  description: Schema.optionalWith(
    Schema.NullOr(
      Schema.Trim.pipe(Schema.maxLength(1000, { message: () => 'Description must be 1000 characters or less' })),
    ),
    { nullable: true },
  ),
  thumbnailUrl: Schema.optionalWith(
    Schema.NullOr(
      Schema.String.pipe(Schema.filter((s) => URL.canParse(s), { message: () => 'Invalid thumbnail URL' })),
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
  videoIds: Schema.Array(UuidSchema).pipe(Schema.minItems(1, { message: () => 'At least one video ID is required' })),
});

// =============================================================================
// Comment Schemas
// =============================================================================

export const CreateCommentSchema = Schema.Struct({
  content: Schema.Trim.pipe(
    Schema.minLength(1, { message: () => 'Comment content is required' }),
    Schema.maxLength(2000, { message: () => 'Comment must be 2000 characters or less' }),
  ),
  timestamp: Schema.optionalWith(Schema.NullOr(TimestampFormatSchema), { nullable: true }),
  parentId: Schema.optionalWith(Schema.NullOr(UuidSchema), { nullable: true }),
});

export const UpdateCommentSchema = Schema.Struct({
  content: Schema.Trim.pipe(
    Schema.minLength(1, { message: () => 'Comment content is required' }),
    Schema.maxLength(2000, { message: () => 'Comment must be 2000 characters or less' }),
  ),
});

// =============================================================================
// Organization Schemas
// =============================================================================

export const CreateOrganizationSchema = Schema.Struct({
  name: Schema.Trim.pipe(
    Schema.minLength(1, { message: () => 'Name is required' }),
    Schema.maxLength(100, { message: () => 'Name must be 100 characters or less' }),
  ),
  slug: Schema.optional(
    Schema.String.pipe(
      Schema.minLength(1, { message: () => 'Slug is required' }),
      Schema.maxLength(50, { message: () => 'Slug must be 50 characters or less' }),
      Schema.pattern(/^[a-z0-9-]+$/, {
        message: () => 'Slug must only contain lowercase letters, numbers, and hyphens',
      }),
    ),
  ),
  description: Schema.optionalWith(
    Schema.NullOr(
      Schema.Trim.pipe(Schema.maxLength(500, { message: () => 'Description must be 500 characters or less' })),
    ),
    { nullable: true },
  ),
  logo: Schema.optionalWith(
    Schema.NullOr(Schema.String.pipe(Schema.filter((s) => URL.canParse(s), { message: () => 'Invalid logo URL' }))),
    { nullable: true },
  ),
});

export const UpdateOrganizationSchema = Schema.Struct({
  name: Schema.optional(
    Schema.Trim.pipe(
      Schema.minLength(1, { message: () => 'Name is required' }),
      Schema.maxLength(100, { message: () => 'Name must be 100 characters or less' }),
    ),
  ),
  description: Schema.optionalWith(
    Schema.NullOr(
      Schema.Trim.pipe(Schema.maxLength(500, { message: () => 'Description must be 500 characters or less' })),
    ),
    { nullable: true },
  ),
  logo: Schema.optionalWith(
    Schema.NullOr(Schema.String.pipe(Schema.filter((s) => URL.canParse(s), { message: () => 'Invalid logo URL' }))),
    { nullable: true },
  ),
});

// =============================================================================
// Invitation Schemas
// =============================================================================

export const CreateInvitationSchema = Schema.Struct({
  email: Schema.String.pipe(
    Schema.filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s), { message: () => 'Invalid email address' }),
  ),
  role: Schema.optionalWith(Schema.Literal('owner', 'member'), { default: () => 'member' as const }),
});

// =============================================================================
// Video Progress Schemas
// =============================================================================

export const UpdateProgressSchema = Schema.Struct({
  currentTime: Schema.String.pipe(Schema.minLength(1, { message: () => 'Current time is required' })),
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
// Clip Schemas
// =============================================================================

export const MomentTypeSchema = Schema.Literal(
  'decision',
  'action_item',
  'question',
  'answer',
  'emphasis',
  'demonstration',
  'conclusion',
  'highlight',
);

export const ClipTypeSchema = Schema.Literal('auto', 'manual');

export const ClipStatusSchema = Schema.Literal('pending', 'processing', 'ready', 'failed');

export const HighlightReelStatusSchema = Schema.Literal('draft', 'rendering', 'ready', 'failed');

export const CreateClipSchema = Schema.Struct({
  title: Schema.Trim.pipe(
    Schema.minLength(1, { message: () => 'Title is required' }),
    Schema.maxLength(200, { message: () => 'Title must be less than 200 characters' }),
  ),
  description: Schema.optionalWith(
    Schema.String.pipe(Schema.maxLength(1000, { message: () => 'Description must be less than 1000 characters' })),
    { nullable: true },
  ),
  startTime: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0, { message: () => 'Start time must be non-negative' })),
  endTime: Schema.Number.pipe(Schema.greaterThan(0, { message: () => 'End time must be positive' })),
  momentId: Schema.optionalWith(Schema.NullOr(UuidSchema), { nullable: true }),
  momentType: Schema.optional(MomentTypeSchema),
  transcriptExcerpt: Schema.optionalWith(
    Schema.String.pipe(Schema.maxLength(5000, { message: () => 'Transcript excerpt too long' })),
    { nullable: true },
  ),
}).pipe(
  Schema.filter((data) => data.endTime > data.startTime, {
    message: () => 'End time must be greater than start time',
  }),
);

export const UpdateClipSchema = Schema.Struct({
  title: Schema.optional(
    Schema.Trim.pipe(
      Schema.minLength(1, { message: () => 'Title is required' }),
      Schema.maxLength(200, { message: () => 'Title must be less than 200 characters' }),
    ),
  ),
  description: Schema.optionalWith(
    Schema.NullOr(
      Schema.String.pipe(Schema.maxLength(1000, { message: () => 'Description must be less than 1000 characters' })),
    ),
    { nullable: true },
  ),
  startTime: Schema.optional(
    Schema.Number.pipe(Schema.greaterThanOrEqualTo(0, { message: () => 'Start time must be non-negative' })),
  ),
  endTime: Schema.optional(Schema.Number.pipe(Schema.greaterThan(0, { message: () => 'End time must be positive' }))),
});

export const CreateHighlightReelSchema = Schema.Struct({
  title: Schema.Trim.pipe(
    Schema.minLength(1, { message: () => 'Title is required' }),
    Schema.maxLength(200, { message: () => 'Title must be less than 200 characters' }),
  ),
  description: Schema.optionalWith(
    Schema.String.pipe(Schema.maxLength(1000, { message: () => 'Description must be less than 1000 characters' })),
    { nullable: true },
  ),
  clipIds: Schema.optionalWith(Schema.Array(UuidSchema), { default: () => [] }),
});

export const UpdateHighlightReelSchema = Schema.Struct({
  title: Schema.optional(
    Schema.Trim.pipe(
      Schema.minLength(1, { message: () => 'Title is required' }),
      Schema.maxLength(200, { message: () => 'Title must be less than 200 characters' }),
    ),
  ),
  description: Schema.optionalWith(
    Schema.NullOr(
      Schema.String.pipe(Schema.maxLength(1000, { message: () => 'Description must be less than 1000 characters' })),
    ),
    { nullable: true },
  ),
  clipIds: Schema.optional(Schema.Array(UuidSchema)),
});

export const CreateQuoteCardSchema = Schema.Struct({
  quoteText: Schema.Trim.pipe(
    Schema.minLength(1, { message: () => 'Quote text is required' }),
    Schema.maxLength(500, { message: () => 'Quote text must be less than 500 characters' }),
  ),
  speaker: Schema.optionalWith(
    Schema.String.pipe(Schema.maxLength(100, { message: () => 'Speaker name must be less than 100 characters' })),
    { nullable: true },
  ),
  timestampSeconds: Schema.optionalWith(
    Schema.Number.pipe(Schema.greaterThanOrEqualTo(0, { message: () => 'Timestamp must be non-negative' })),
    { nullable: true },
  ),
  templateId: Schema.optional(Schema.String),
});

export const UpdateQuoteCardSchema = Schema.Struct({
  quoteText: Schema.optional(
    Schema.Trim.pipe(
      Schema.minLength(1, { message: () => 'Quote text is required' }),
      Schema.maxLength(500, { message: () => 'Quote text must be less than 500 characters' }),
    ),
  ),
  speaker: Schema.optionalWith(
    Schema.NullOr(
      Schema.String.pipe(Schema.maxLength(100, { message: () => 'Speaker name must be less than 100 characters' })),
    ),
    { nullable: true },
  ),
});

// =============================================================================
// Billing Schemas
// =============================================================================

export const CreateCheckoutSchema = Schema.Struct({
  planId: Schema.String.pipe(Schema.minLength(1, { message: () => 'Plan ID is required' })),
  billingPeriod: Schema.optionalWith(Schema.Literal('monthly', 'yearly'), { default: () => 'monthly' as const }),
  successUrl: Schema.optional(
    Schema.String.pipe(Schema.filter((s) => URL.canParse(s), { message: () => 'Invalid success URL' })),
  ),
  cancelUrl: Schema.optional(
    Schema.String.pipe(Schema.filter((s) => URL.canParse(s), { message: () => 'Invalid cancel URL' })),
  ),
});

// =============================================================================
// Integration Schemas
// =============================================================================

export const ImportMeetingSchema = Schema.Struct({
  meetingId: Schema.String.pipe(Schema.minLength(1, { message: () => 'Meeting ID is required' })),
  recordingId: Schema.String.pipe(Schema.minLength(1, { message: () => 'Recording ID is required' })),
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

// Authentication types
export type LoginInput = typeof LoginSchema.Type;
export type RegisterInput = typeof RegisterSchema.Type;
export type ForgotPasswordInput = typeof ForgotPasswordSchema.Type;
export type ResetPasswordInput = typeof ResetPasswordSchema.Type;
export type ChangePasswordInput = typeof ChangePasswordSchema.Type;

// Profile types
export type UpdateProfileInput = typeof UpdateProfileSchema.Type;

// Search types
export type SearchInput = typeof SearchSchema.Type;
export type ContactInput = typeof ContactSchema.Type;
export type InviteMemberInput = typeof InviteMemberSchema.Type;

// Video types
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

// Common field validators
export const emailSchema = EmailSchema;
export const passwordSchema = PasswordSchema;
export const nameSchema = NameSchema;
export const slugSchema = SlugSchema;
export const urlSchema = UrlOptionalSchema;
export const descriptionSchema = DescriptionOptionalSchema;

// Common schemas
export const uuidSchema = UuidSchema;
export const paginationSchema = PaginationSchema;
export const timestampSchema = TimestampFormatSchema;

// Authentication schemas
export const loginSchema = LoginSchema;
export const registerSchema = RegisterSchema;
export const forgotPasswordSchema = ForgotPasswordSchema;
export const resetPasswordSchema = ResetPasswordSchema;
export const changePasswordSchema = ChangePasswordSchema;

// Profile schemas
export const updateProfileSchema = UpdateProfileSchema;

// Search & contact schemas
export const searchSchema = SearchSchema;
export const contactSchema = ContactSchema;
export const inviteMemberSchema = InviteMemberSchema;

// Video schemas
export const createVideoSchema = CreateVideoSchema;
export const updateVideoSchema = UpdateVideoSchema;
export const videoUploadSchema = VideoUploadSchema;
export const getVideosSchema = GetVideosSchema;
export const createChapterSchema = CreateChapterSchema;
export const createCodeSnippetSchema = CreateCodeSnippetSchema;

// Series schemas
export const createSeriesSchema = CreateSeriesSchema;
export const updateSeriesSchema = UpdateSeriesSchema;
export const getSeriesSchema = GetSeriesSchema;
export const addVideoToSeriesSchema = AddVideoToSeriesSchema;
export const reorderSeriesVideosSchema = ReorderSeriesVideosSchema;

// Comment schemas
export const createCommentSchema = CreateCommentSchema;
export const updateCommentSchema = UpdateCommentSchema;

// Organization schemas
export const createOrganizationSchema = CreateOrganizationSchema;
export const updateOrganizationSchema = UpdateOrganizationSchema;
export const createInvitationSchema = CreateInvitationSchema;

// Progress schemas
export const updateProgressSchema = UpdateProgressSchema;
export const updateSeriesProgressSchema = UpdateSeriesProgressSchema;
export const updateNotificationSchema = UpdateNotificationSchema;

// Billing schemas
export const createCheckoutSchema = CreateCheckoutSchema;
export const importMeetingSchema = ImportMeetingSchema;
export const analyzeVideoSchema = AnalyzeVideoSchema;

// Clip schemas
export const createClipSchema = CreateClipSchema;
export const updateClipSchema = UpdateClipSchema;
export const createHighlightReelSchema = CreateHighlightReelSchema;
export const updateHighlightReelSchema = UpdateHighlightReelSchema;
export const createQuoteCardSchema = CreateQuoteCardSchema;
export const updateQuoteCardSchema = UpdateQuoteCardSchema;
