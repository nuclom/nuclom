/**
 * Effect-TS Module - Central Export
 *
 * This file serves as the main entry point for the Effect-TS module.
 * Import from "@/lib/effect" to access all Effect functionality.
 */

// Common Effect exports
export * from "./common";
export type { DatabaseConfig as DatabaseConfigType } from "./config";

// Configuration - explicitly export to avoid conflicts
export {
  AppConfig,
  ConfigService,
  ConfigServiceLive,
  DatabaseConfig,
  EmailConfig,
  GitHubOAuthConfig,
  GoogleOAuthConfig,
  getStorageConfig,
  isStorageConfigured,
  OptionalStorageConfig,
  ServerConfig,
} from "./config";
// Custom error types
export * from "./errors";
export type { AppServices } from "./runtime";
// Runtime and layers
export {
  AppLive,
  AppRuntime,
  createAuthenticatedHandler,
  createHandler,
  DevLoggerLive,
  effectToResponse,
  effectWithLayersToResponse,
  LoggingLive,
  LogLevelLive,
  mapErrorToResponse,
  runEffect,
  runEffectExit,
  runEffectSync,
} from "./runtime";
// Server utilities (for RSC)
export {
  createCachedQuery,
  createVideo as serverCreateVideo,
  deleteVideo as serverDeleteVideo,
  getOrganizationBySlug as getCachedOrganizationBySlug,
  getOrganizations as getCachedOrganizations,
  getVideo as getCachedVideo,
  getVideos as getCachedVideos,
  revalidateOrganization,
  revalidateOrganizations,
  revalidateVideo,
  revalidateVideos,
  runServerEffect,
  runServerEffectSafe,
  updateVideo as serverUpdateVideo,
} from "./server";
export type {
  // AI
  AIServiceInterface,
  // Auth
  AuthServiceInterface,
  CreateOrganizationInput,
  DatabaseService,
  // Database
  DrizzleDB,
  // OrganizationRepository
  OrganizationRepositoryService,
  OrganizationWithRole,
  ProcessingProgress,
  ProcessingResult,
  StorageConfig,
  // Storage
  StorageService,
  UploadOptions,
  UploadProgress,
  UploadResult,
  UserSession,
  VideoInfo,
  // VideoProcessor
  VideoProcessorService,
  // VideoRepository
  VideoRepositoryService,
  VideoSummary,
} from "./services";
// Services - explicitly export to avoid conflicts
export {
  // AI
  AI,
  AILive,
  // Auth
  Auth,
  createOrganization,
  createSummaryStream,
  createVideo,
  // Database
  Database,
  DatabaseLive,
  DrizzleLive,
  deleteFile,
  deleteVideoRecord,
  extractActionItems,
  findOneOrFail,
  generateFileKey,
  generatePresignedUploadUrl,
  generateVideoSummary,
  generateVideoTags,
  getActiveOrganization,
  getDb,
  getMaxFileSize,
  getOrganization,
  getOrganizationBySlug,
  getPublicUrl,
  getSession,
  getSessionOption,
  getUserOrganizations,
  getUserRole,
  getVideo,
  getVideoInfo,
  getVideos,
  insertUnique,
  isMember,
  isSupportedVideoFormat,
  makeAuthLayer,
  makeAuthService,
  // OrganizationRepository
  OrganizationRepository,
  OrganizationRepositoryLive,
  processVideo,
  query,
  requireAdmin,
  requireAuth,
  requireRole,
  // Storage
  Storage,
  StorageLive,
  transaction,
  updateVideo,
  uploadFile,
  uploadLargeFile,
  // VideoProcessor
  VideoProcessor,
  VideoProcessorLive,
  // VideoRepository
  VideoRepository,
  VideoRepositoryLive,
  validateVideo,
} from "./services";
export type { StreamChunk } from "./streaming";
// Streaming utilities
export {
  createDeferredLoader,
  createParallelLoaders,
  runStream,
  streamToAsyncIterable,
  streamVideoSummary,
} from "./streaming";
