/**
 * Effect Services - Central Export
 *
 * All Effect-TS services are exported from this file.
 */

export type { AIServiceInterface, VideoSummary } from "./ai";
// AI Service
export {
  AI,
  AILive,
  createSummaryStream,
  extractActionItems,
  generateVideoSummary,
  generateVideoTags,
} from "./ai";
export type { AuthServiceInterface, UserSession } from "./auth";
// Auth Service
export {
  Auth,
  getSession,
  getSessionOption,
  makeAuthLayer,
  makeAuthService,
  requireAdmin,
  requireAuth,
  requireRole,
} from "./auth";
export type { DatabaseService, DrizzleDB } from "./database";
// Database Service
export {
  Database,
  DatabaseLive,
  DrizzleLive,
  findOneOrFail,
  getDb,
  insertUnique,
  query,
  transaction,
} from "./database";
export type {
  CreateOrganizationInput,
  OrganizationRepositoryService,
  OrganizationWithRole,
} from "./organization-repository";
// Organization Repository
export {
  createOrganization,
  getActiveOrganization,
  getOrganization,
  getOrganizationBySlug,
  getUserOrganizations,
  getUserRole,
  isMember,
  OrganizationRepository,
  OrganizationRepositoryLive,
} from "./organization-repository";
export type { StorageConfig, StorageService, UploadOptions, UploadProgress, UploadResult } from "./storage";
// Storage Service
export {
  deleteFile,
  generateFileKey,
  generatePresignedUploadUrl,
  getPublicUrl,
  Storage,
  StorageLive,
  uploadFile,
  uploadLargeFile,
} from "./storage";
export type {
  ProcessingProgress,
  ProcessingResult,
  VideoInfo,
  VideoProcessorService,
} from "./video-processor";
// Video Processor Service
export {
  getMaxFileSize,
  getVideoInfo,
  isSupportedVideoFormat,
  processVideo,
  VideoProcessor,
  VideoProcessorLive,
  validateVideo,
} from "./video-processor";
export type { VideoRepositoryService } from "./video-repository";
// Video Repository
export {
  createVideo,
  deleteVideo as deleteVideoRecord,
  getVideo,
  getVideos,
  updateVideo,
  VideoRepository,
  VideoRepositoryLive,
} from "./video-repository";
