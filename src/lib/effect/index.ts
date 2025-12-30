/**
 * Effect-TS Module - Central Export
 *
 * This file serves as the main entry point for the Effect-TS module.
 * Import from "@/lib/effect" to access all Effect functionality.
 */

// Common Effect exports
export * from "./common";

// Custom error types
export * from "./errors";

// Configuration - explicitly export to avoid conflicts
export {
  DatabaseConfig,
  GitHubOAuthConfig,
  GoogleOAuthConfig,
  EmailConfig,
  AppConfig,
  ServerConfig,
  ConfigService,
  ConfigServiceLive,
  OptionalStorageConfig,
  isStorageConfigured,
  getStorageConfig,
} from "./config";
export type { DatabaseConfig as DatabaseConfigType } from "./config";

// Services - explicitly export to avoid conflicts
export {
  // Database
  Database,
  DatabaseLive,
  DrizzleLive,
  query,
  transaction,
  findOneOrFail,
  insertUnique,
  getDb,
  // Storage
  Storage,
  StorageLive,
  uploadFile,
  uploadLargeFile,
  deleteFile,
  generatePresignedUploadUrl,
  getPublicUrl,
  generateFileKey,
  // Auth
  Auth,
  makeAuthLayer,
  makeAuthService,
  getSession,
  getSessionOption,
  requireAuth,
  requireRole,
  requireAdmin,
  // AI
  AI,
  AILive,
  generateVideoSummary,
  generateVideoTags,
  extractActionItems,
  createSummaryStream,
  // VideoProcessor
  VideoProcessor,
  VideoProcessorLive,
  processVideo,
  validateVideo,
  getVideoInfo,
  isSupportedVideoFormat,
  getMaxFileSize,
  // VideoRepository
  VideoRepository,
  VideoRepositoryLive,
  getVideos,
  getVideo,
  createVideo,
  updateVideo,
  deleteVideoRecord,
  // OrganizationRepository
  OrganizationRepository,
  OrganizationRepositoryLive,
  createOrganization,
  getUserOrganizations,
  getActiveOrganization,
} from "./services";

export type {
  // Database
  DrizzleDB,
  DatabaseService,
  // Storage
  StorageService,
  StorageConfig,
  UploadResult,
  UploadOptions,
  UploadProgress,
  // Auth
  AuthServiceInterface,
  UserSession,
  // AI
  AIServiceInterface,
  VideoSummary,
  // VideoProcessor
  VideoProcessorService,
  VideoInfo,
  ProcessingResult,
  ProcessingProgress,
  // VideoRepository
  VideoRepositoryService,
  // OrganizationRepository
  OrganizationRepositoryService,
  OrganizationWithRole,
} from "./services";

// Runtime and layers
export {
  AppLive,
  AppRuntime,
  runEffect,
  runEffectExit,
  runEffectSync,
  createHandler,
  createAuthenticatedHandler,
  effectToResponse,
  effectWithLayersToResponse,
  mapErrorToResponse,
  DevLoggerLive,
  LogLevelLive,
  LoggingLive,
} from "./runtime";
export type { AppServices } from "./runtime";
