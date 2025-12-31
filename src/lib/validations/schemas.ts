/**
 * Effect Schema Validation Schemas
 *
 * Centralized validation schemas for forms and API requests.
 * These schemas provide consistent validation across client and server.
 */

import { Schema } from "effect";

// =============================================================================
// Common Field Validators
// =============================================================================

export const EmailSchema = Schema.Trim.pipe(
  Schema.minLength(1, { message: () => "Email is required" }),
  Schema.filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s), { message: () => "Please enter a valid email address" }),
);

export const PasswordSchema = Schema.String.pipe(
  Schema.minLength(8, { message: () => "Password must be at least 8 characters" }),
  Schema.maxLength(100, { message: () => "Password must be less than 100 characters" }),
);

export const NameSchema = Schema.Trim.pipe(
  Schema.minLength(1, { message: () => "Name is required" }),
  Schema.maxLength(100, { message: () => "Name must be less than 100 characters" }),
);

export const SlugSchema = Schema.Trim.pipe(
  Schema.minLength(1, { message: () => "Slug is required" }),
  Schema.maxLength(50, { message: () => "Slug must be less than 50 characters" }),
  Schema.pattern(/^[a-z0-9-]+$/, { message: () => "Slug can only contain lowercase letters, numbers, and hyphens" }),
);

export const UrlSchema = Schema.optional(
  Schema.Union(
    Schema.String.pipe(Schema.filter((s) => URL.canParse(s), { message: () => "Please enter a valid URL" })),
    Schema.Literal(""),
  ),
);

export const DescriptionSchema = Schema.optional(
  Schema.String.pipe(Schema.maxLength(2000, { message: () => "Description must be less than 2000 characters" })),
);

// =============================================================================
// Authentication Schemas
// =============================================================================

export const LoginSchema = Schema.Struct({
  email: EmailSchema,
  password: Schema.String.pipe(Schema.minLength(1, { message: () => "Password is required" })),
});

export type LoginInput = typeof LoginSchema.Type;

const BaseRegisterSchema = Schema.Struct({
  name: NameSchema,
  email: EmailSchema,
  password: PasswordSchema,
  confirmPassword: Schema.String.pipe(Schema.minLength(1, { message: () => "Please confirm your password" })),
});

export const RegisterSchema = BaseRegisterSchema.pipe(
  Schema.filter((data) => data.password === data.confirmPassword, {
    message: () => "Passwords do not match",
  }),
);

export type RegisterInput = typeof RegisterSchema.Type;

export const ForgotPasswordSchema = Schema.Struct({
  email: EmailSchema,
});

export type ForgotPasswordInput = typeof ForgotPasswordSchema.Type;

const BaseResetPasswordSchema = Schema.Struct({
  password: PasswordSchema,
  confirmPassword: Schema.String.pipe(Schema.minLength(1, { message: () => "Please confirm your password" })),
  token: Schema.String,
});

export const ResetPasswordSchema = BaseResetPasswordSchema.pipe(
  Schema.filter((data) => data.password === data.confirmPassword, {
    message: () => "Passwords do not match",
  }),
);

export type ResetPasswordInput = typeof ResetPasswordSchema.Type;

// =============================================================================
// Organization Schemas
// =============================================================================

export const CreateOrganizationSchema = Schema.Struct({
  name: NameSchema,
  slug: SlugSchema,
  description: DescriptionSchema,
});

export type CreateOrganizationInput = typeof CreateOrganizationSchema.Type;

export const UpdateOrganizationSchema = Schema.Struct({
  name: Schema.optional(NameSchema),
  slug: Schema.optional(SlugSchema),
  description: DescriptionSchema,
  logoUrl: UrlSchema,
});

export type UpdateOrganizationInput = typeof UpdateOrganizationSchema.Type;

// =============================================================================
// Video Schemas
// =============================================================================

export const CreateVideoSchema = Schema.Struct({
  title: Schema.Trim.pipe(
    Schema.minLength(1, { message: () => "Title is required" }),
    Schema.maxLength(200, { message: () => "Title must be less than 200 characters" }),
  ),
  description: DescriptionSchema,
  seriesId: Schema.optional(Schema.String),
  channelId: Schema.optional(Schema.String),
});

export type CreateVideoInput = typeof CreateVideoSchema.Type;

export const UpdateVideoSchema = Schema.Struct({
  title: Schema.optional(
    Schema.Trim.pipe(
      Schema.minLength(1, { message: () => "Title is required" }),
      Schema.maxLength(200, { message: () => "Title must be less than 200 characters" }),
    ),
  ),
  description: DescriptionSchema,
  seriesId: Schema.optionalWith(Schema.NullOr(Schema.String), { nullable: true }),
  channelId: Schema.optionalWith(Schema.NullOr(Schema.String), { nullable: true }),
  thumbnailUrl: UrlSchema,
});

export type UpdateVideoInput = typeof UpdateVideoSchema.Type;

// =============================================================================
// Series Schemas
// =============================================================================

export const CreateSeriesSchema = Schema.Struct({
  name: Schema.Trim.pipe(
    Schema.minLength(1, { message: () => "Name is required" }),
    Schema.maxLength(100, { message: () => "Name must be less than 100 characters" }),
  ),
  description: DescriptionSchema,
});

export type CreateSeriesInput = typeof CreateSeriesSchema.Type;

export const UpdateSeriesSchema = Schema.Struct({
  name: Schema.optional(
    Schema.Trim.pipe(
      Schema.minLength(1, { message: () => "Name is required" }),
      Schema.maxLength(100, { message: () => "Name must be less than 100 characters" }),
    ),
  ),
  description: DescriptionSchema,
  thumbnailUrl: UrlSchema,
});

export type UpdateSeriesInput = typeof UpdateSeriesSchema.Type;

// =============================================================================
// Comment Schemas
// =============================================================================

export const CreateCommentSchema = Schema.Struct({
  content: Schema.Trim.pipe(
    Schema.minLength(1, { message: () => "Comment cannot be empty" }),
    Schema.maxLength(5000, { message: () => "Comment must be less than 5000 characters" }),
  ),
  videoId: Schema.String.pipe(Schema.minLength(1, { message: () => "Video ID is required" })),
  timestamp: Schema.optional(Schema.Number.pipe(Schema.greaterThanOrEqualTo(0))),
  parentId: Schema.optional(Schema.String),
});

export type CreateCommentInput = typeof CreateCommentSchema.Type;

export const UpdateCommentSchema = Schema.Struct({
  content: Schema.Trim.pipe(
    Schema.minLength(1, { message: () => "Comment cannot be empty" }),
    Schema.maxLength(5000, { message: () => "Comment must be less than 5000 characters" }),
  ),
});

export type UpdateCommentInput = typeof UpdateCommentSchema.Type;

// =============================================================================
// Profile Schemas
// =============================================================================

export const UpdateProfileSchema = Schema.Struct({
  name: Schema.optional(NameSchema),
  avatarUrl: UrlSchema,
  bio: Schema.optional(Schema.String.pipe(Schema.maxLength(500, { message: () => "Bio must be less than 500 characters" }))),
});

export type UpdateProfileInput = typeof UpdateProfileSchema.Type;

const BaseChangePasswordSchema = Schema.Struct({
  currentPassword: Schema.String.pipe(Schema.minLength(1, { message: () => "Current password is required" })),
  newPassword: PasswordSchema,
  confirmPassword: Schema.String.pipe(Schema.minLength(1, { message: () => "Please confirm your password" })),
});

export const ChangePasswordSchema = BaseChangePasswordSchema.pipe(
  Schema.filter((data) => data.newPassword === data.confirmPassword, {
    message: () => "Passwords do not match",
  }),
  Schema.filter((data) => data.currentPassword !== data.newPassword, {
    message: () => "New password must be different from current password",
  }),
);

export type ChangePasswordInput = typeof ChangePasswordSchema.Type;

// =============================================================================
// Invite Schemas
// =============================================================================

export const InviteMemberSchema = Schema.Struct({
  email: EmailSchema,
  role: Schema.Literal("admin", "member", "viewer"),
});

export type InviteMemberInput = typeof InviteMemberSchema.Type;

// =============================================================================
// Search Schemas
// =============================================================================

export const SearchSchema = Schema.Struct({
  query: Schema.String.pipe(
    Schema.minLength(1, { message: () => "Search query is required" }),
    Schema.maxLength(200, { message: () => "Search query is too long" }),
  ),
  type: Schema.optionalWith(Schema.Literal("all", "videos", "series", "channels"), { default: () => "all" as const }),
  page: Schema.optionalWith(Schema.Number.pipe(Schema.greaterThanOrEqualTo(1)), { default: () => 1 }),
  limit: Schema.optionalWith(Schema.Number.pipe(Schema.greaterThanOrEqualTo(1), Schema.lessThanOrEqualTo(100)), {
    default: () => 20,
  }),
});

export type SearchInput = typeof SearchSchema.Type;

// =============================================================================
// Contact/Support Schemas
// =============================================================================

export const ContactSchema = Schema.Struct({
  name: NameSchema,
  email: EmailSchema,
  subject: Schema.Trim.pipe(
    Schema.minLength(1, { message: () => "Subject is required" }),
    Schema.maxLength(200, { message: () => "Subject must be less than 200 characters" }),
  ),
  message: Schema.Trim.pipe(
    Schema.minLength(10, { message: () => "Message must be at least 10 characters" }),
    Schema.maxLength(5000, { message: () => "Message must be less than 5000 characters" }),
  ),
});

export type ContactInput = typeof ContactSchema.Type;

// =============================================================================
// Legacy aliases for backwards compatibility (lowercase names)
// =============================================================================

export const emailSchema = EmailSchema;
export const passwordSchema = PasswordSchema;
export const nameSchema = NameSchema;
export const slugSchema = SlugSchema;
export const urlSchema = UrlSchema;
export const descriptionSchema = DescriptionSchema;
export const loginSchema = LoginSchema;
export const registerSchema = RegisterSchema;
export const forgotPasswordSchema = ForgotPasswordSchema;
export const resetPasswordSchema = ResetPasswordSchema;
export const createOrganizationSchema = CreateOrganizationSchema;
export const updateOrganizationSchema = UpdateOrganizationSchema;
export const createVideoSchema = CreateVideoSchema;
export const updateVideoSchema = UpdateVideoSchema;
export const createSeriesSchema = CreateSeriesSchema;
export const updateSeriesSchema = UpdateSeriesSchema;
export const createCommentSchema = CreateCommentSchema;
export const updateCommentSchema = UpdateCommentSchema;
export const updateProfileSchema = UpdateProfileSchema;
export const changePasswordSchema = ChangePasswordSchema;
export const inviteMemberSchema = InviteMemberSchema;
export const searchSchema = SearchSchema;
export const contactSchema = ContactSchema;
