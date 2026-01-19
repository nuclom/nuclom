/**
 * Presigned URL Upload API
 *
 * Generates presigned URLs for direct-to-R2 uploads, bypassing Vercel API route size limits.
 * This enables uploading videos of any size directly from the browser to cloud storage.
 */

import { auth } from '@nuclom/lib/auth';
import { Effect, Option, Schema } from 'effect';
import { type NextRequest, NextResponse } from 'next/server';
import { createPublicLayer, mapErrorToApiResponse } from '@/lib/api-handler';
import { Storage, ValidationError } from '@/lib/effect';
import { checkResourceLimit, requireWriteAccess } from '@/lib/effect/services/billing-middleware';
import { BillingRepository } from '@/lib/effect/services/billing-repository';
import type { ApiResponse } from '@/lib/types';
import { validate } from '@/lib/validation';

// =============================================================================
// Types
// =============================================================================

const PresignedUploadRequestSchema = Schema.Struct({
  filename: Schema.String,
  contentType: Schema.String,
  fileSize: Schema.Number,
  organizationId: Schema.String,
});

interface PresignedUploadResponse {
  uploadId: string;
  uploadUrl: string;
  fileKey: string;
  expiresIn: number;
}

const BulkPresignedUploadRequestSchema = Schema.Struct({
  files: Schema.Array(
    Schema.Struct({
      filename: Schema.String,
      contentType: Schema.String,
      fileSize: Schema.Number,
    }),
  ),
  organizationId: Schema.String,
});

interface BulkPresignedUploadResponse {
  uploads: Array<{
    uploadId: string;
    uploadUrl: string;
    fileKey: string;
    filename: string;
    expiresIn: number;
  }>;
}

// Supported video MIME types
const SUPPORTED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm',
  'video/x-flv',
  'video/x-ms-wmv',
  'video/3gpp',
  'video/mpeg',
  'video/ogg',
];

// Maximum file size: 5GB (Cloudflare R2 supports up to 5TB, but we limit for practical reasons)
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024;

// Presigned URL expiration: 1 hour
const PRESIGNED_URL_EXPIRATION = 3600;

const PresignedUploadBodySchema = Schema.Union(PresignedUploadRequestSchema, BulkPresignedUploadRequestSchema);
type PresignedUploadRequest = Schema.Schema.Type<typeof PresignedUploadRequestSchema>;
type BulkPresignedUploadRequest = Schema.Schema.Type<typeof BulkPresignedUploadRequestSchema>;

const isBulkPresignedUploadRequest = (
  value: PresignedUploadRequest | BulkPresignedUploadRequest,
): value is BulkPresignedUploadRequest => 'files' in value;

// =============================================================================
// POST /api/videos/upload/presigned - Generate presigned upload URL(s)
// =============================================================================

export async function POST(request: NextRequest) {
  // Verify authentication
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Parse request body
  let body: PresignedUploadRequest | BulkPresignedUploadRequest;
  try {
    const rawBody = await request.json();
    body = await Effect.runPromise(validate(PresignedUploadBodySchema, rawBody));
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  // Determine if this is a bulk or single upload request
  if (isBulkPresignedUploadRequest(body)) {
    return handleBulkPresignedUpload(body, session.user.id);
  }

  return handleSinglePresignedUpload(body, session.user.id);
}

async function handleSinglePresignedUpload(body: PresignedUploadRequest, _userId: string) {
  const { filename, contentType, fileSize, organizationId } = body;

  // Validate request
  if (!filename || !contentType || !fileSize || !organizationId) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields: filename, contentType, fileSize, organizationId' },
      { status: 400 },
    );
  }

  // Validate content type
  if (!SUPPORTED_VIDEO_TYPES.includes(contentType)) {
    return NextResponse.json(
      {
        success: false,
        error: `Unsupported content type: ${contentType}. Supported types: ${SUPPORTED_VIDEO_TYPES.join(', ')}`,
      },
      { status: 400 },
    );
  }

  // Validate file size
  if (fileSize > MAX_FILE_SIZE) {
    return NextResponse.json(
      { success: false, error: `File size exceeds maximum allowed: ${MAX_FILE_SIZE / (1024 * 1024 * 1024)}GB` },
      { status: 400 },
    );
  }

  const effect = Effect.gen(function* () {
    const storage = yield* Storage;

    // Check if storage is configured
    if (!storage.isConfigured) {
      return yield* Effect.fail(
        new ValidationError({
          message: 'Storage is not configured',
        }),
      );
    }

    // Check plan limits before generating presigned URL (but don't track yet)
    // Actual usage tracking happens in /api/videos/upload/confirm after successful upload
    const billingRepo = yield* BillingRepository;
    const subscriptionOption = yield* billingRepo.getSubscriptionOption(organizationId);

    if (Option.isSome(subscriptionOption)) {
      // Verify write access (subscription is active/trialing)
      yield* requireWriteAccess(organizationId);

      // Check storage limit (without incrementing)
      const storageCheck = yield* checkResourceLimit(organizationId, 'storage', fileSize);
      if (!storageCheck.allowed) {
        return yield* Effect.fail(
          new ValidationError({
            message: `Storage limit exceeded. Used: ${Math.round(storageCheck.currentUsage / 1024 / 1024)}MB, Limit: ${Math.round(storageCheck.limit / 1024 / 1024)}MB`,
          }),
        );
      }

      // Check video count limit (without incrementing)
      const videoCheck = yield* checkResourceLimit(organizationId, 'videos', 1);
      if (!videoCheck.allowed) {
        return yield* Effect.fail(
          new ValidationError({
            message: `Video upload limit exceeded. You have uploaded ${videoCheck.currentUsage} videos this month (limit: ${videoCheck.limit}).`,
          }),
        );
      }
    }

    // Generate unique file key
    const fileKey = storage.generateFileKey(organizationId, filename, 'video');

    // Generate presigned upload URL
    const uploadUrl = yield* storage.generatePresignedUploadUrl(fileKey, contentType, PRESIGNED_URL_EXPIRATION);

    // Generate a unique upload ID for tracking
    const uploadId = crypto.randomUUID();

    return {
      uploadId,
      uploadUrl,
      fileKey,
      expiresIn: PRESIGNED_URL_EXPIRATION,
    };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);

  if (exit._tag === 'Failure') {
    return mapErrorToApiResponse(exit.cause);
  }

  const response: ApiResponse<PresignedUploadResponse> = {
    success: true,
    data: exit.value,
  };

  return NextResponse.json(response, { status: 200 });
}

async function handleBulkPresignedUpload(body: BulkPresignedUploadRequest, _userId: string) {
  const { files, organizationId } = body;

  // Validate request
  if (!files || files.length === 0 || !organizationId) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields: files, organizationId' },
      { status: 400 },
    );
  }

  // Validate each file
  for (const file of files) {
    if (!file.filename || !file.contentType || !file.fileSize) {
      return NextResponse.json(
        { success: false, error: 'Each file must have filename, contentType, and fileSize' },
        { status: 400 },
      );
    }

    if (!SUPPORTED_VIDEO_TYPES.includes(file.contentType)) {
      return NextResponse.json(
        { success: false, error: `Unsupported content type for ${file.filename}: ${file.contentType}` },
        { status: 400 },
      );
    }

    if (file.fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `File ${file.filename} exceeds maximum size of ${MAX_FILE_SIZE / (1024 * 1024 * 1024)}GB`,
        },
        { status: 400 },
      );
    }
  }

  // Limit bulk uploads to 20 files at a time
  if (files.length > 20) {
    return NextResponse.json({ success: false, error: 'Maximum 20 files can be uploaded at once' }, { status: 400 });
  }

  const effect = Effect.gen(function* () {
    const storage = yield* Storage;

    // Check if storage is configured
    if (!storage.isConfigured) {
      return yield* Effect.fail(
        new ValidationError({
          message: 'Storage is not configured',
        }),
      );
    }

    // Check plan limits for total upload size (but don't track yet)
    // Actual usage tracking happens in /api/videos/upload/confirm after successful upload
    const totalSize = files.reduce((sum, f) => sum + f.fileSize, 0);
    const fileCount = files.length;
    const billingRepo = yield* BillingRepository;
    const subscriptionOption = yield* billingRepo.getSubscriptionOption(organizationId);

    if (Option.isSome(subscriptionOption)) {
      // Verify write access (subscription is active/trialing)
      yield* requireWriteAccess(organizationId);

      // Check storage limit for total size (without incrementing)
      const storageCheck = yield* checkResourceLimit(organizationId, 'storage', totalSize);
      if (!storageCheck.allowed) {
        return yield* Effect.fail(
          new ValidationError({
            message: `Storage limit exceeded. Would use: ${Math.round((storageCheck.currentUsage + totalSize) / 1024 / 1024)}MB, Limit: ${Math.round(storageCheck.limit / 1024 / 1024)}MB`,
          }),
        );
      }

      // Check video count limit for all files (without incrementing)
      const videoCheck = yield* checkResourceLimit(organizationId, 'videos', fileCount);
      if (!videoCheck.allowed) {
        return yield* Effect.fail(
          new ValidationError({
            message: `Video upload limit exceeded. Would upload ${fileCount} videos, but only ${videoCheck.remaining} remaining this month (limit: ${videoCheck.limit}).`,
          }),
        );
      }
    }

    // Generate presigned URLs for each file
    const uploads: BulkPresignedUploadResponse['uploads'] = [];

    for (const file of files) {
      const fileKey = storage.generateFileKey(organizationId, file.filename, 'video');
      const uploadUrl = yield* storage.generatePresignedUploadUrl(fileKey, file.contentType, PRESIGNED_URL_EXPIRATION);
      const uploadId = crypto.randomUUID();

      uploads.push({
        uploadId,
        uploadUrl,
        fileKey,
        filename: file.filename,
        expiresIn: PRESIGNED_URL_EXPIRATION,
      });
    }

    return { uploads };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);

  if (exit._tag === 'Failure') {
    return mapErrorToApiResponse(exit.cause);
  }

  const response: ApiResponse<BulkPresignedUploadResponse> = {
    success: true,
    data: exit.value,
  };

  return NextResponse.json(response, { status: 200 });
}
