import { DeleteObjectCommand, PutObjectCommand, type PutObjectCommandInput, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import {
  fileRegionLocations,
  organizationStorageConfigs,
  type NewFileRegionLocation,
  type NewOrganizationStorageConfig,
  type OrganizationStorageConfig,
  type StorageRegion,
} from "./db/schema";
import { env } from "./env/server";
import { AuditLogger } from "./audit-log";

export interface RegionConfig {
  region: StorageRegion;
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface UploadResult {
  key: string;
  url: string;
  etag?: string;
  region: StorageRegion;
}

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  replicate?: boolean; // Whether to replicate to secondary regions
}

// Region endpoint configurations
const REGION_ENDPOINTS: Record<StorageRegion, string> = {
  "us-east-1": "https://s3.us-east-1.amazonaws.com",
  "us-west-2": "https://s3.us-west-2.amazonaws.com",
  "eu-west-1": "https://s3.eu-west-1.amazonaws.com",
  "eu-central-1": "https://s3.eu-central-1.amazonaws.com",
  "ap-southeast-1": "https://s3.ap-southeast-1.amazonaws.com",
  "ap-northeast-1": "https://s3.ap-northeast-1.amazonaws.com",
  auto: "", // Will use R2's auto region selection
};

// Data residency region mappings
const DATA_RESIDENCY_REGIONS: Record<string, StorageRegion[]> = {
  US: ["us-east-1", "us-west-2"],
  EU: ["eu-west-1", "eu-central-1"],
  APAC: ["ap-southeast-1", "ap-northeast-1"],
};

/**
 * MultiRegionStorageService - Handles multi-region storage with replication
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Utility class pattern
export class MultiRegionStorageService {
  private static r2Client: S3Client | null = null;
  private static regionClients: Map<StorageRegion, S3Client> = new Map();

  /**
   * Initialize the R2 client
   */
  private static getR2Client(): S3Client {
    if (!this.r2Client) {
      const R2_ACCOUNT_ID = env.R2_ACCOUNT_ID;
      const R2_ACCESS_KEY_ID = env.R2_ACCESS_KEY_ID;
      const R2_SECRET_ACCESS_KEY = env.R2_SECRET_ACCESS_KEY;

      if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
        throw new Error("R2 storage not configured");
      }

      this.r2Client = new S3Client({
        region: "auto",
        endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: R2_ACCESS_KEY_ID,
          secretAccessKey: R2_SECRET_ACCESS_KEY,
        },
      });
    }

    return this.r2Client;
  }

  /**
   * Get storage configuration for an organization
   */
  static async getConfig(organizationId: string): Promise<OrganizationStorageConfig | null> {
    const config = await db.query.organizationStorageConfigs.findFirst({
      where: eq(organizationStorageConfigs.organizationId, organizationId),
    });

    return config || null;
  }

  /**
   * Configure storage settings for an organization
   */
  static async configure(
    organizationId: string,
    config: {
      primaryRegion?: StorageRegion;
      replicationRegions?: StorageRegion[];
      dataResidency?: string;
      encryptionKeyId?: string;
      retentionDays?: number;
    },
    configuredBy?: string,
  ): Promise<OrganizationStorageConfig> {
    const existingConfig = await this.getConfig(organizationId);

    // Validate data residency and regions match
    if (config.dataResidency && config.primaryRegion && config.primaryRegion !== "auto") {
      const allowedRegions = DATA_RESIDENCY_REGIONS[config.dataResidency];
      if (allowedRegions && !allowedRegions.includes(config.primaryRegion)) {
        throw new Error(
          `Primary region ${config.primaryRegion} is not allowed for data residency ${config.dataResidency}`,
        );
      }
    }

    const storageConfig: NewOrganizationStorageConfig = {
      id: existingConfig?.id || crypto.randomUUID(),
      organizationId,
      primaryRegion: config.primaryRegion || "auto",
      replicationRegions: config.replicationRegions || null,
      dataResidency: config.dataResidency || null,
      encryptionKeyId: config.encryptionKeyId || null,
      retentionDays: config.retentionDays ?? 30,
    };

    let result: OrganizationStorageConfig;

    if (existingConfig) {
      const [updated] = await db
        .update(organizationStorageConfigs)
        .set({
          ...storageConfig,
          updatedAt: new Date(),
        })
        .where(eq(organizationStorageConfigs.id, existingConfig.id))
        .returning();
      result = updated;
    } else {
      const [created] = await db.insert(organizationStorageConfigs).values(storageConfig).returning();
      result = created;
    }

    // Audit log
    if (configuredBy) {
      await AuditLogger.logOrgManagement(
        "storage_configured",
        { actorId: configuredBy, organizationId },
        {
          previousValue: existingConfig
            ? {
                primaryRegion: existingConfig.primaryRegion,
                replicationRegions: existingConfig.replicationRegions,
              }
            : undefined,
          newValue: {
            primaryRegion: result.primaryRegion,
            replicationRegions: result.replicationRegions,
          },
        },
      );
    }

    return result;
  }

  /**
   * Get the primary region for an organization
   */
  static async getPrimaryRegion(organizationId: string): Promise<StorageRegion> {
    const config = await this.getConfig(organizationId);
    return config?.primaryRegion || "auto";
  }

  /**
   * Upload a file to the organization's primary storage region
   */
  static async uploadFile(
    organizationId: string,
    buffer: Buffer,
    key: string,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    const client = this.getR2Client();
    const config = await this.getConfig(organizationId);
    const primaryRegion = config?.primaryRegion || "auto";

    const uploadParams: PutObjectCommandInput = {
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: options.contentType || "application/octet-stream",
      Metadata: options.metadata,
    };

    try {
      const upload = new Upload({
        client,
        params: uploadParams,
      });

      const result = await upload.done();

      // Record file location
      await this.recordFileLocation(organizationId, key, primaryRegion, env.R2_BUCKET_NAME, true);

      const url = `https://${env.R2_BUCKET_NAME}.${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;

      // Trigger replication if enabled
      if (options.replicate !== false && config?.replicationRegions) {
        void this.replicateToRegions(organizationId, key, buffer, config.replicationRegions as StorageRegion[], options);
      }

      return {
        key,
        url,
        etag: result.ETag,
        region: primaryRegion,
      };
    } catch (error) {
      console.error("Error uploading file:", error);
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Upload a large file with progress tracking
   */
  static async uploadLargeFile(
    organizationId: string,
    buffer: Buffer,
    key: string,
    options: UploadOptions = {},
    onProgress?: (progress: { loaded: number; total: number }) => void,
  ): Promise<UploadResult> {
    const client = this.getR2Client();
    const config = await this.getConfig(organizationId);
    const primaryRegion = config?.primaryRegion || "auto";

    const uploadParams: PutObjectCommandInput = {
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: options.contentType || "application/octet-stream",
      Metadata: options.metadata,
    };

    try {
      const upload = new Upload({
        client,
        params: uploadParams,
        queueSize: 4,
        leavePartsOnError: false,
      });

      if (onProgress) {
        upload.on("httpUploadProgress", (progress) => {
          onProgress({
            loaded: progress.loaded || 0,
            total: progress.total || 0,
          });
        });
      }

      const result = await upload.done();

      // Record file location
      await this.recordFileLocation(organizationId, key, primaryRegion, env.R2_BUCKET_NAME, true);

      const url = `https://${env.R2_BUCKET_NAME}.${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;

      return {
        key,
        url,
        etag: result.ETag,
        region: primaryRegion,
      };
    } catch (error) {
      console.error("Error uploading large file:", error);
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Delete a file from all regions
   */
  static async deleteFile(organizationId: string, key: string): Promise<void> {
    const client = this.getR2Client();

    // Get all locations of this file
    const locations = await db.query.fileRegionLocations.findMany({
      where: and(eq(fileRegionLocations.organizationId, organizationId), eq(fileRegionLocations.fileKey, key)),
    });

    // Delete from primary storage
    try {
      const command = new DeleteObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: key,
      });
      await client.send(command);
    } catch (error) {
      console.error("Error deleting file from primary storage:", error);
    }

    // Delete location records
    await db
      .delete(fileRegionLocations)
      .where(and(eq(fileRegionLocations.organizationId, organizationId), eq(fileRegionLocations.fileKey, key)));

    // In a full implementation, would also delete from replicated regions
    for (const location of locations) {
      if (!location.isPrimary) {
        console.log(`[Storage] Would delete from replicated region: ${location.region}`);
      }
    }
  }

  /**
   * Generate a presigned URL for direct upload
   */
  static async generatePresignedUploadUrl(
    organizationId: string,
    key: string,
    contentType: string,
    expiresIn = 3600,
  ): Promise<{ url: string; region: StorageRegion }> {
    const client = this.getR2Client();
    const config = await this.getConfig(organizationId);
    const primaryRegion = config?.primaryRegion || "auto";

    const command = new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(client, command, { expiresIn });

    return { url, region: primaryRegion };
  }

  /**
   * Get the public URL for a file
   */
  static getPublicUrl(key: string): string {
    return `https://${env.R2_BUCKET_NAME}.${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
  }

  /**
   * Generate a unique file key with organization prefix
   */
  static generateFileKey(
    organizationId: string,
    filename: string,
    type: "video" | "thumbnail" | "processed" | "export" = "video",
  ): string {
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    return `${organizationId}/${type}s/${timestamp}-${sanitizedFilename}`;
  }

  /**
   * Record file location in database
   */
  private static async recordFileLocation(
    organizationId: string,
    fileKey: string,
    region: StorageRegion,
    bucketName: string,
    isPrimary: boolean,
  ): Promise<void> {
    const location: NewFileRegionLocation = {
      id: crypto.randomUUID(),
      organizationId,
      fileKey,
      region,
      bucketName,
      isPrimary,
      replicationStatus: isPrimary ? "synced" : "pending",
      lastSyncedAt: isPrimary ? new Date() : null,
    };

    await db
      .insert(fileRegionLocations)
      .values(location)
      .onConflictDoUpdate({
        target: [fileRegionLocations.fileKey, fileRegionLocations.region],
        set: {
          replicationStatus: location.replicationStatus,
          lastSyncedAt: location.lastSyncedAt,
        },
      });
  }

  /**
   * Replicate file to secondary regions (async background task)
   */
  private static async replicateToRegions(
    organizationId: string,
    key: string,
    buffer: Buffer,
    regions: StorageRegion[],
    options: UploadOptions,
  ): Promise<void> {
    // In a production implementation, this would:
    // 1. Queue replication jobs
    // 2. Upload to each region's bucket
    // 3. Update replication status in database

    for (const region of regions) {
      console.log(`[Storage] Would replicate ${key} to region: ${region}`);

      // Record pending replication
      await this.recordFileLocation(organizationId, key, region, `${env.R2_BUCKET_NAME}-${region}`, false);
    }
  }

  /**
   * Get file locations for a given key
   */
  static async getFileLocations(
    organizationId: string,
    fileKey: string,
  ): Promise<Array<{ region: StorageRegion; isPrimary: boolean; status: string }>> {
    const locations = await db.query.fileRegionLocations.findMany({
      where: and(eq(fileRegionLocations.organizationId, organizationId), eq(fileRegionLocations.fileKey, fileKey)),
    });

    return locations.map((loc) => ({
      region: loc.region,
      isPrimary: loc.isPrimary,
      status: loc.replicationStatus || "unknown",
    }));
  }

  /**
   * Get storage statistics for an organization
   */
  static async getStorageStats(organizationId: string): Promise<{
    primaryRegion: StorageRegion;
    replicationRegions: StorageRegion[];
    dataResidency: string | null;
    fileCount: number;
    replicationPending: number;
    replicationFailed: number;
  }> {
    const config = await this.getConfig(organizationId);

    // Count files by replication status
    const locations = await db.query.fileRegionLocations.findMany({
      where: eq(fileRegionLocations.organizationId, organizationId),
    });

    const primaryFiles = new Set(locations.filter((l) => l.isPrimary).map((l) => l.fileKey));
    const pendingReplication = locations.filter(
      (l) => !l.isPrimary && l.replicationStatus === "pending",
    ).length;
    const failedReplication = locations.filter(
      (l) => !l.isPrimary && l.replicationStatus === "failed",
    ).length;

    return {
      primaryRegion: config?.primaryRegion || "auto",
      replicationRegions: (config?.replicationRegions as StorageRegion[]) || [],
      dataResidency: config?.dataResidency || null,
      fileCount: primaryFiles.size,
      replicationPending: pendingReplication,
      replicationFailed: failedReplication,
    };
  }

  /**
   * Get allowed regions for a data residency requirement
   */
  static getAllowedRegions(dataResidency: string): StorageRegion[] {
    return DATA_RESIDENCY_REGIONS[dataResidency] || [];
  }

  /**
   * Validate data residency compliance
   */
  static validateDataResidency(
    dataResidency: string,
    regions: StorageRegion[],
  ): { valid: boolean; violations: string[] } {
    const allowedRegions = DATA_RESIDENCY_REGIONS[dataResidency];
    const violations: string[] = [];

    if (!allowedRegions) {
      return { valid: true, violations: [] }; // No restrictions if unknown residency
    }

    for (const region of regions) {
      if (region !== "auto" && !allowedRegions.includes(region)) {
        violations.push(`Region ${region} is not allowed for ${dataResidency} data residency`);
      }
    }

    return { valid: violations.length === 0, violations };
  }
}

export default MultiRegionStorageService;
