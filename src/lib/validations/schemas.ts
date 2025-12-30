/**
 * Zod Validation Schemas (Zod v4)
 *
 * Centralized validation schemas for forms and API requests.
 * These schemas provide consistent validation across client and server.
 */

import { z } from "zod";

// =============================================================================
// Common Field Validators
// =============================================================================

export const emailSchema = z.string().min(1, "Email is required").email("Please enter a valid email address");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(100, "Password must be less than 100 characters");

export const nameSchema = z
  .string()
  .min(1, "Name is required")
  .max(100, "Name must be less than 100 characters")
  .trim();

export const slugSchema = z
  .string()
  .min(1, "Slug is required")
  .max(50, "Slug must be less than 50 characters")
  .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens")
  .trim();

export const urlSchema = z.string().url("Please enter a valid URL").optional().or(z.literal(""));

export const descriptionSchema = z.string().max(2000, "Description must be less than 2000 characters").optional();

// =============================================================================
// Authentication Schemas
// =============================================================================

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
    token: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// =============================================================================
// Organization Schemas
// =============================================================================

export const createOrganizationSchema = z.object({
  name: nameSchema,
  slug: slugSchema,
  description: descriptionSchema,
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const updateOrganizationSchema = z.object({
  name: nameSchema.optional(),
  slug: slugSchema.optional(),
  description: descriptionSchema,
  logoUrl: urlSchema,
});

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

// =============================================================================
// Video Schemas
// =============================================================================

export const createVideoSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must be less than 200 characters").trim(),
  description: descriptionSchema,
  seriesId: z.string().optional(),
  channelId: z.string().optional(),
});

export type CreateVideoInput = z.infer<typeof createVideoSchema>;

export const updateVideoSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must be less than 200 characters").trim().optional(),
  description: descriptionSchema,
  seriesId: z.string().nullable().optional(),
  channelId: z.string().nullable().optional(),
  thumbnailUrl: urlSchema,
});

export type UpdateVideoInput = z.infer<typeof updateVideoSchema>;

// =============================================================================
// Series Schemas
// =============================================================================

export const createSeriesSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters").trim(),
  description: descriptionSchema,
});

export type CreateSeriesInput = z.infer<typeof createSeriesSchema>;

export const updateSeriesSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters").trim().optional(),
  description: descriptionSchema,
  thumbnailUrl: urlSchema,
});

export type UpdateSeriesInput = z.infer<typeof updateSeriesSchema>;

// =============================================================================
// Comment Schemas
// =============================================================================

export const createCommentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty").max(5000, "Comment must be less than 5000 characters").trim(),
  videoId: z.string().min(1, "Video ID is required"),
  timestamp: z.number().min(0).optional(),
  parentId: z.string().optional(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const updateCommentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty").max(5000, "Comment must be less than 5000 characters").trim(),
});

export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;

// =============================================================================
// Profile Schemas
// =============================================================================

export const updateProfileSchema = z.object({
  name: nameSchema.optional(),
  avatarUrl: urlSchema,
  bio: z.string().max(500, "Bio must be less than 500 characters").optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// =============================================================================
// Invite Schemas
// =============================================================================

export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: z.enum(["admin", "member", "viewer"]),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

// =============================================================================
// Search Schemas
// =============================================================================

export const searchSchema = z.object({
  query: z.string().min(1, "Search query is required").max(200, "Search query is too long"),
  type: z.enum(["all", "videos", "series", "channels"]).optional().default("all"),
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(100).optional().default(20),
});

export type SearchInput = z.infer<typeof searchSchema>;

// =============================================================================
// Contact/Support Schemas
// =============================================================================

export const contactSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  subject: z.string().min(1, "Subject is required").max(200, "Subject must be less than 200 characters").trim(),
  message: z
    .string()
    .min(10, "Message must be at least 10 characters")
    .max(5000, "Message must be less than 5000 characters")
    .trim(),
});

export type ContactInput = z.infer<typeof contactSchema>;
