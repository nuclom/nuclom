/**
 * Effect Services - Central Export
 *
 * All Effect-TS services are exported from this file.
 */

// Database Service
export {
  Database,
  DatabaseLive,
  DrizzleLive,
  query,
  transaction,
  findOneOrFail,
  insertUnique,
  getDb,
} from "./database";
export type { DrizzleDB, DatabaseService } from "./database";

// Storage Service
export {
  Storage,
  StorageLive,
  uploadFile,
  uploadLargeFile,
  deleteFile,
  generatePresignedUploadUrl,
  getPublicUrl,
  generateFileKey,
} from "./storage";
export type { StorageService, StorageConfig, UploadResult, UploadOptions, UploadProgress } from "./storage";

// Auth Service
export {
  Auth,
  makeAuthLayer,
  makeAuthService,
  getSession,
  getSessionOption,
  requireAuth,
  requireRole,
  requireAdmin,
} from "./auth";
export type { AuthServiceInterface, UserSession } from "./auth";

// AI Service
export {
  AI,
  AILive,
  generateVideoSummary,
  generateVideoTags,
  extractActionItems,
  createSummaryStream,
} from "./ai";
export type { AIServiceInterface, VideoSummary } from "./ai";

// Video Processor Service
export {
  VideoProcessor,
  VideoProcessorLive,
  processVideo,
  validateVideo,
  getVideoInfo,
  isSupportedVideoFormat,
  getMaxFileSize,
} from "./video-processor";
export type {
  VideoProcessorService,
  VideoInfo,
  ProcessingResult,
  ProcessingProgress,
} from "./video-processor";

// Video Repository
export {
  VideoRepository,
  VideoRepositoryLive,
  getVideos,
  getVideo,
  createVideo,
  updateVideo,
  deleteVideo as deleteVideoRecord,
} from "./video-repository";
export type { VideoRepositoryService } from "./video-repository";

// Organization Repository
export {
  OrganizationRepository,
  OrganizationRepositoryLive,
  createOrganization,
  getUserOrganizations,
  getActiveOrganization,
  getOrganization,
  getOrganizationBySlug,
  isMember,
  getUserRole,
} from "./organization-repository";
export type {
  OrganizationRepositoryService,
  OrganizationWithRole,
  CreateOrganizationInput,
} from "./organization-repository";
