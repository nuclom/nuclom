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
  type: Schema.optionalWith(Schema.Literal('all', 'videos', 'collections'), { default: () => 'all' as const }),
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
// Collection Schemas
// =============================================================================

export const CreateCollectionSchema = Schema.Struct({
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
  type: Schema.optionalWith(Schema.Literal('folder', 'playlist'), { default: () => 'folder' as const }),
  isPublic: Schema.optionalWith(Schema.Boolean, { default: () => false }),
});

export const UpdateCollectionSchema = Schema.Struct({
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

export const GetCollectionsSchema = Schema.Struct({
  organizationId: UuidSchema,
  type: Schema.optional(Schema.Literal('folder', 'playlist')),
  page: Schema.optionalWith(Schema.NumberFromString.pipe(Schema.int(), Schema.positive()), { default: () => 1 }),
  limit: Schema.optionalWith(
    Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1), Schema.lessThanOrEqualTo(100)),
    { default: () => 20 },
  ),
});

export const AddVideoToCollectionSchema = Schema.Struct({
  videoId: UuidSchema,
  position: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
});

export const ReorderCollectionVideosSchema = Schema.Struct({
  videoIds: Schema.Array(UuidSchema).pipe(Schema.minItems(1, { message: () => 'At least one video ID is required' })),
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
// Collection Progress Schemas
// =============================================================================

export const UpdateCollectionProgressSchema = Schema.Struct({
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

// Collection types
export type CreateCollectionInput = typeof CreateCollectionSchema.Type;
export type UpdateCollectionInput = typeof UpdateCollectionSchema.Type;
export type GetCollectionsInput = typeof GetCollectionsSchema.Type;
export type AddVideoToCollectionInput = typeof AddVideoToCollectionSchema.Type;
export type ReorderCollectionVideosInput = typeof ReorderCollectionVideosSchema.Type;
export type UpdateCollectionProgressInput = typeof UpdateCollectionProgressSchema.Type;

export type CreateOrganizationInput = typeof CreateOrganizationSchema.Type;
export type UpdateOrganizationInput = typeof UpdateOrganizationSchema.Type;

export type CreateInvitationInput = typeof CreateInvitationSchema.Type;
export type UpdateProgressInput = typeof UpdateProgressSchema.Type;
export type UpdateNotificationInput = typeof UpdateNotificationSchema.Type;

export type CreateCheckoutInput = typeof CreateCheckoutSchema.Type;
export type ImportMeetingInput = typeof ImportMeetingSchema.Type;
export type AnalyzeVideoInput = typeof AnalyzeVideoSchema.Type;
