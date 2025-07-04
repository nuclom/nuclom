import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";

// Cloudflare R2 configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "nuclom-videos";

// For development, allow missing R2 configuration
const isR2Configured = R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY;

if (!isR2Configured) {
  console.warn("R2 configuration not found. Video upload will use mock storage.");
}

// Create S3 client configured for Cloudflare R2 (only if configured)
let r2Client: S3Client | null = null;
if (isR2Configured) {
  r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!,
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

export class StorageService {
  /**
   * Upload a file to R2 storage
   */
  static async uploadFile(
    buffer: Buffer,
    key: string,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    // If R2 is not configured, return mock data for development
    if (!isR2Configured || !r2Client) {
      console.warn("R2 not configured, using mock storage for development");
      return {
        key,
        url: `https://mock-storage.example.com/${key}`,
        etag: `mock-etag-${Date.now()}`,
      };
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
      console.error("Error uploading file to R2:", error);
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}`);
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
    // If R2 is not configured, return mock data for development
    if (!isR2Configured || !r2Client) {
      console.warn("R2 not configured, using mock storage for development");
      
      // Simulate progress for development
      if (onProgress) {
        const total = buffer.length;
        let loaded = 0;
        const interval = setInterval(() => {
          loaded += total / 10;
          if (loaded >= total) {
            onProgress({ loaded: total, total });
            clearInterval(interval);
          } else {
            onProgress({ loaded, total });
          }
        }, 100);
      }
      
      return {
        key,
        url: `https://mock-storage.example.com/${key}`,
        etag: `mock-etag-${Date.now()}`,
      };
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
      console.error("Error uploading large file to R2:", error);
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Delete a file from R2 storage
   */
  static async deleteFile(key: string): Promise<void> {
    // If R2 is not configured, just log for development
    if (!isR2Configured || !r2Client) {
      console.warn("R2 not configured, skipping delete for development");
      return;
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      });

      await r2Client.send(command);
    } catch (error) {
      console.error("Error deleting file from R2:", error);
      throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : "Unknown error"}`);
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
    // If R2 is not configured, return mock URL for development
    if (!isR2Configured || !r2Client) {
      console.warn("R2 not configured, returning mock presigned URL for development");
      return `https://mock-storage.example.com/upload/${key}?expires=${Date.now() + expiresIn * 1000}`;
    }

    try {
      const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        ContentType: contentType,
      });

      return await getSignedUrl(r2Client, command, { expiresIn });
    } catch (error) {
      console.error("Error generating presigned URL:", error);
      throw new Error(`Failed to generate presigned URL: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Generate a public URL for accessing a file
   */
  static getPublicUrl(key: string): string {
    if (!isR2Configured) {
      return `https://mock-storage.example.com/${key}`;
    }
    return `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
  }

  /**
   * Generate a unique file key with workspace and timestamp
   */
  static generateFileKey(
    workspaceId: string,
    filename: string,
    type: "video" | "thumbnail" | "processed" = "video",
  ): string {
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    return `${workspaceId}/${type}s/${timestamp}-${sanitizedFilename}`;
  }
}

export default StorageService;