/**
 * Storage Service using Effect-TS
 *
 * Provides type-safe file storage operations for Cloudflare R2 (S3-compatible).
 * All operations return Effect types with proper error handling.
 */

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  type PutObjectCommandInput,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Config, Context, Effect, Layer, Option, pipe } from 'effect';
import { DeleteError, PresignedUrlError, StorageNotConfiguredError, UploadError } from '../errors';

// =============================================================================
// Types
// =============================================================================

export interface StorageConfig {
  readonly accountId: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly bucketName: string;
}

export interface UploadResult {
  readonly key: string;
  readonly etag?: string;
}

export interface UploadOptions {
  readonly contentType?: string;
  readonly metadata?: Record<string, string>;
}

export interface UploadProgress {
  readonly loaded: number;
  readonly total: number;
}

// =============================================================================
// Storage Service Interface
// =============================================================================

export interface StorageService {
  /**
   * Upload a file to storage with optional progress tracking.
   * Works for both small and large files using multipart upload.
   */
  readonly uploadFile: (
    buffer: Buffer,
    key: string,
    options?: UploadOptions,
    onProgress?: (progress: UploadProgress) => void,
  ) => Effect.Effect<UploadResult, UploadError>;

  /**
   * Delete a file from storage
   */
  readonly deleteFile: (key: string) => Effect.Effect<void, DeleteError>;

  /**
   * Generate a presigned URL for direct upload
   */
  readonly generatePresignedUploadUrl: (
    key: string,
    contentType: string,
    expiresIn?: number,
  ) => Effect.Effect<string, PresignedUrlError>;

  /**
   * Generate a presigned URL for downloading/streaming a file
   */
  readonly generatePresignedDownloadUrl: (key: string, expiresIn?: number) => Effect.Effect<string, PresignedUrlError>;

  /**
   * Extract the R2 key from a stored URL
   * Returns null if the URL format is invalid
   */
  readonly extractKeyFromUrl: (url: string) => string | null;

  /**
   * Generate a unique file key
   */
  readonly generateFileKey: (
    organizationId: string,
    filename: string,
    type?: 'video' | 'thumbnail' | 'processed',
  ) => string;

  /**
   * Check if storage is configured
   */
  readonly isConfigured: boolean;
}

// =============================================================================
// Storage Service Tag
// =============================================================================

export class Storage extends Context.Tag('Storage')<Storage, StorageService>() {}

// =============================================================================
// Storage Configuration
// =============================================================================

const StorageConfigEffect = Config.all({
  accountId: Config.string('R2_ACCOUNT_ID').pipe(Config.option),
  accessKeyId: Config.string('R2_ACCESS_KEY_ID').pipe(Config.option),
  secretAccessKey: Config.string('R2_SECRET_ACCESS_KEY').pipe(Config.option),
  bucketName: Config.string('R2_BUCKET_NAME').pipe(Config.option),
});

// =============================================================================
// Storage Service Implementation
// =============================================================================

const makeStorageService = Effect.gen(function* () {
  const config = yield* StorageConfigEffect;

  // Check if all config values are present
  const isConfigured =
    Option.isSome(config.accountId) &&
    Option.isSome(config.accessKeyId) &&
    Option.isSome(config.secretAccessKey) &&
    Option.isSome(config.bucketName);

  // Create S3 client if configured
  const r2Client = isConfigured
    ? new S3Client({
        region: 'auto',
        endpoint: `https://${Option.getOrThrow(config.accountId)}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: Option.getOrThrow(config.accessKeyId),
          secretAccessKey: Option.getOrThrow(config.secretAccessKey),
        },
      })
    : null;

  const bucketName = Option.getOrNull(config.bucketName);
  const accountId = Option.getOrNull(config.accountId);

  const ensureConfigured = (): Effect.Effect<
    { client: S3Client; bucket: string; account: string },
    StorageNotConfiguredError
  > => {
    if (!isConfigured || !r2Client || !bucketName || !accountId) {
      return Effect.fail(StorageNotConfiguredError.default);
    }
    return Effect.succeed({ client: r2Client, bucket: bucketName, account: accountId });
  };

  /**
   * Extract the R2 key from a stored URL
   * URL format: https://{bucket}.{accountId}.r2.cloudflarestorage.com/{key}
   */
  const extractKeyFromUrl = (url: string): string | null => {
    const parts = url.split('.r2.cloudflarestorage.com/');
    if (parts.length !== 2) {
      return null;
    }
    return parts[1];
  };

  const generateFileKey = (
    organizationId: string,
    filename: string,
    type: 'video' | 'thumbnail' | 'processed' = 'video',
  ): string => {
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `${organizationId}/${type}s/${timestamp}-${sanitizedFilename}`;
  };

  const uploadFile = (
    buffer: Buffer,
    key: string,
    options: UploadOptions = {},
    onProgress?: (progress: UploadProgress) => void,
  ): Effect.Effect<UploadResult, UploadError> =>
    pipe(
      ensureConfigured(),
      Effect.mapError(
        (e) =>
          new UploadError({
            message: e.message,
            filename: key,
          }),
      ),
      Effect.flatMap(({ client, bucket }) =>
        Effect.tryPromise({
          try: async () => {
            const uploadParams: PutObjectCommandInput = {
              Bucket: bucket,
              Key: key,
              Body: buffer,
              ContentType: options.contentType || 'application/octet-stream',
              Metadata: options.metadata,
            };

            const upload = new Upload({
              client,
              params: uploadParams,
              queueSize: 4,
              leavePartsOnError: false,
            });

            if (onProgress) {
              upload.on('httpUploadProgress', (progress) => {
                onProgress({
                  loaded: progress.loaded || 0,
                  total: progress.total || 0,
                });
              });
            }

            const result = await upload.done();

            return {
              key,
              etag: result.ETag,
            };
          },
          catch: (error) =>
            new UploadError({
              message: `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`,
              filename: key,
              cause: error,
            }),
        }),
      ),
    );

  const deleteFile = (key: string): Effect.Effect<void, DeleteError> =>
    pipe(
      ensureConfigured(),
      Effect.mapError(
        (e) =>
          new DeleteError({
            message: e.message,
            key,
          }),
      ),
      Effect.flatMap(({ client, bucket }) =>
        Effect.tryPromise({
          try: async () => {
            const command = new DeleteObjectCommand({
              Bucket: bucket,
              Key: key,
            });
            await client.send(command);
          },
          catch: (error) =>
            new DeleteError({
              message: `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`,
              key,
              cause: error,
            }),
        }),
      ),
    );

  const generatePresignedUploadUrl = (
    key: string,
    contentType: string,
    expiresIn = 3600,
  ): Effect.Effect<string, PresignedUrlError> =>
    pipe(
      ensureConfigured(),
      Effect.mapError(
        (e) =>
          new PresignedUrlError({
            message: e.message,
          }),
      ),
      Effect.flatMap(({ client, bucket }) =>
        Effect.tryPromise({
          try: async () => {
            const command = new PutObjectCommand({
              Bucket: bucket,
              Key: key,
              ContentType: contentType,
            });
            return await getSignedUrl(client, command, { expiresIn });
          },
          catch: (error) =>
            new PresignedUrlError({
              message: `Failed to generate presigned URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
              cause: error,
            }),
        }),
      ),
    );

  const generatePresignedDownloadUrl = (
    key: string,
    expiresIn = 3600, // 1 hour default
  ): Effect.Effect<string, PresignedUrlError> =>
    pipe(
      ensureConfigured(),
      Effect.mapError(
        (e) =>
          new PresignedUrlError({
            message: e.message,
          }),
      ),
      Effect.flatMap(({ client, bucket }) =>
        Effect.tryPromise({
          try: async () => {
            const command = new GetObjectCommand({
              Bucket: bucket,
              Key: key,
            });
            return await getSignedUrl(client, command, { expiresIn });
          },
          catch: (error) =>
            new PresignedUrlError({
              message: `Failed to generate presigned download URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
              cause: error,
            }),
        }),
      ),
    );

  return {
    uploadFile,
    deleteFile,
    generatePresignedUploadUrl,
    generatePresignedDownloadUrl,
    extractKeyFromUrl,
    generateFileKey,
    isConfigured,
  } satisfies StorageService;
});

// =============================================================================
// Storage Layer
// =============================================================================

export const StorageLive = Layer.effect(Storage, makeStorageService);

// =============================================================================
// Storage Helper Functions
// =============================================================================

/**
 * Upload a file using the Storage service with optional progress tracking.
 * Works for both small and large files using multipart upload.
 */
export const uploadFile = (
  buffer: Buffer,
  key: string,
  options?: UploadOptions,
  onProgress?: (progress: UploadProgress) => void,
): Effect.Effect<UploadResult, UploadError, Storage> =>
  Effect.gen(function* () {
    const storage = yield* Storage;
    return yield* storage.uploadFile(buffer, key, options, onProgress);
  });

/**
 * Delete a file
 */
export const deleteFile = (key: string): Effect.Effect<void, DeleteError, Storage> =>
  Effect.gen(function* () {
    const storage = yield* Storage;
    return yield* storage.deleteFile(key);
  });

/**
 * Generate a presigned upload URL
 */
export const generatePresignedUploadUrl = (
  key: string,
  contentType: string,
  expiresIn?: number,
): Effect.Effect<string, PresignedUrlError, Storage> =>
  Effect.gen(function* () {
    const storage = yield* Storage;
    return yield* storage.generatePresignedUploadUrl(key, contentType, expiresIn);
  });

/**
 * Generate a presigned download URL for streaming/viewing files
 */
export const generatePresignedDownloadUrl = (
  key: string,
  expiresIn?: number,
): Effect.Effect<string, PresignedUrlError, Storage> =>
  Effect.gen(function* () {
    const storage = yield* Storage;
    return yield* storage.generatePresignedDownloadUrl(key, expiresIn);
  });

/**
 * Extract R2 key from a stored URL
 */
export const extractKeyFromUrl = (url: string): Effect.Effect<string | null, never, Storage> =>
  Effect.gen(function* () {
    const storage = yield* Storage;
    return storage.extractKeyFromUrl(url);
  });

/**
 * Generate a file key
 */
export const generateFileKey = (
  organizationId: string,
  filename: string,
  type?: 'video' | 'thumbnail' | 'processed',
): Effect.Effect<string, never, Storage> =>
  Effect.gen(function* () {
    const storage = yield* Storage;
    return storage.generateFileKey(organizationId, filename, type);
  });
