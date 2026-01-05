import { DeleteObjectCommand, PutObjectCommand, type PutObjectCommandInput, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env/server";

// Cloudflare R2 configuration
const R2_ACCOUNT_ID = env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = env.R2_BUCKET_NAME;

// Check if R2 is fully configured
const isR2Configured = R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY;

// Create S3 client configured for Cloudflare R2 (only if configured)
let r2Client: S3Client | null = null;
if (isR2Configured && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
  r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

export interface UploadResult {
  key: string;
  url: string;
  etag?: string;
}

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
}

// biome-ignore lint/complexity/noStaticOnlyClass: Utility class pattern for storage operations
export class StorageService {
  /**
   * Upload a file to R2 storage
   */
  static async uploadFile(buffer: Buffer, key: string, options: UploadOptions = {}): Promise<UploadResult> {
    // If R2 is not configured, throw error instead of using mock
    if (!isR2Configured || !r2Client) {
      throw new Error("R2 storage not configured. Please set up R2 credentials.");
    }

    const uploadParams: PutObjectCommandInput = {
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: options.contentType || "application/octet-stream",
      Metadata: options.metadata,
    };

    try {
      const upload = new Upload({
        client: r2Client,
        params: uploadParams,
      });

      const result = await upload.done();
      const url = `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;

      return {
        key,
        url,
        etag: result.ETag,
      };
    } catch (error) {
      throw new Error(`Failed to upload file to R2: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Upload a large file with progress tracking
   */
  static async uploadLargeFile(
    buffer: Buffer,
    key: string,
    options: UploadOptions = {},
    onProgress?: (progress: { loaded: number; total: number }) => void,
  ): Promise<UploadResult> {
    if (!isR2Configured || !r2Client) {
      throw new Error("R2 storage not configured. Please set up R2 credentials.");
    }

    const uploadParams: PutObjectCommandInput = {
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: options.contentType || "application/octet-stream",
      Metadata: options.metadata,
    };

    try {
      const upload = new Upload({
        client: r2Client,
        params: uploadParams,
        queueSize: 4, // Optional concurrency configuration
        leavePartsOnError: false, // Optional cleanup configuration
      });

      // Progress tracking
      if (onProgress) {
        upload.on("httpUploadProgress", (progress) => {
          onProgress({
            loaded: progress.loaded || 0,
            total: progress.total || 0,
          });
        });
      }

      const result = await upload.done();
      const url = `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;

      return {
        key,
        url,
        etag: result.ETag,
      };
    } catch (error) {
      throw new Error(`Failed to upload large file to R2: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Delete a file from R2 storage
   */
  static async deleteFile(key: string): Promise<void> {
    // If R2 is not configured, skip silently (no-op in development)
    if (!isR2Configured || !r2Client) {
      return;
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      });

      await r2Client.send(command);
    } catch (error) {
      throw new Error(`Failed to delete file from R2: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Generate a presigned URL for direct upload from client
   */
  static async generatePresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn = 3600, // 1 hour
  ): Promise<string> {
    // If R2 is not configured, throw error instead of using mock
    if (!isR2Configured || !r2Client) {
      throw new Error("R2 storage not configured. Please set up R2 credentials.");
    }

    try {
      const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        ContentType: contentType,
      });

      return await getSignedUrl(r2Client, command, { expiresIn });
    } catch (error) {
      throw new Error(`Failed to generate presigned URL: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Generate a public URL for accessing a file
   */
  static getPublicUrl(key: string): string {
    if (!isR2Configured) {
      throw new Error("R2 storage not configured. Please set up R2 credentials.");
    }
    return `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
  }

  /**
   * Generate a unique file key with organization and timestamp
   */
  static generateFileKey(
    organizationId: string,
    filename: string,
    type: "video" | "thumbnail" | "processed" = "video",
  ): string {
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    return `${organizationId}/${type}s/${timestamp}-${sanitizedFilename}`;
  }
}

export default StorageService;
