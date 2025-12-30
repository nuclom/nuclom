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
  getUserVideoProgress as getCachedUserVideoProgress,
  getVideo as getCachedVideo,
  getVideoProgress as getCachedVideoProgress,
  getVideos as getCachedVideos,
  revalidateOrganization,
  revalidateOrganizations,
  revalidateVideo,
  revalidateVideoProgress,
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
  CommentEvent,
  // CommentRepository
  CommentRepositoryService,
  CommentWithAuthor,
  CommentWithReplies,
  CreateCommentInput,
  CreateNotificationInput,
  CreateOrganizationInput,
  DatabaseService,
  // Database
  DrizzleDB,
  // NotificationRepository
  NotificationRepositoryService,
  NotificationType,
  NotificationWithActor,
  // OrganizationRepository
  OrganizationRepositoryService,
  OrganizationWithRole,
  ProcessingProgress,
  ProcessingResult,
  // Replicate API
  ReplicateService,
  ReplicateVideoMetadata,
  SaveProgressInput,
  StorageConfig,
  // Storage
  StorageService,
  ThumbnailResult,
  ReplicateTranscriptionResult as TranscriptionResult,
  UpdateCommentInput,
  UploadOptions,
  UploadProgress,
  UploadResult,
  UserSession,
  VideoInfo,
  // VideoProcessor
  VideoProcessorService,
  VideoProgressData,
  // VideoProgressRepository
  VideoProgressRepositoryService,
  // VideoRepository
  VideoRepositoryService,
  VideoSummary,
  // Zoom
  ZoomServiceInterface,
  ZoomRecording,
  ZoomRecordingsResponse,
  // Google Meet
  GoogleMeetServiceInterface,
  GoogleMeetRecording,
  GoogleDriveFilesResponse,
  // Integration Repository
  IntegrationRepositoryService,
  IntegrationWithUser,
  ImportedMeetingWithVideo,
  CreateIntegrationInput,
  UpdateIntegrationInput,
  CreateImportedMeetingInput,
  UpdateImportedMeetingInput,
  // Search Repository
  SearchRepositoryService,
  SearchParams,
  CreateSearchHistoryInput,
  CreateSavedSearchInput,
  UpdateSavedSearchInput,
} from "./services";

// Services - explicitly export to avoid conflicts
export {
  // AI
  AI,
  AILive,
  // Auth
  Auth,
  // CommentRepository
  CommentRepository,
  CommentRepositoryLive,
  createComment,
  createNotification,
  createOrganization,
  createSummaryStream,
  createVideo,
  // Database
  Database,
  DatabaseLive,
  DrizzleLive,
  deleteComment,
  deleteFile,
  deleteNotification,
  deleteVideoProgress,
  deleteVideoRecord,
  extractActionItems,
  findOneOrFail,
  generateFileKey,
  generatePresignedUploadUrl,
  generateVideoSummary,
  generateVideoTags,
  getActiveOrganization,
  getComment,
  getComments,
  getCommentsByTimestamp,
  getDb,
  getMaxFileSize,
  getNotifications,
  getOrganization,
  getOrganizationBySlug,
  getPublicUrl,
  getSession,
  getSessionOption,
  getUnreadCount,
  getUserOrganizations,
  getUserRole,
  getUserVideoProgress,
  getVideo,
  getVideoInfo,
  getVideoProgress,
  getVideos,
  hasWatchedVideo,
  insertUnique,
  isMember,
  isSupportedVideoFormat,
  makeAuthLayer,
  makeAuthService,
  markAllAsRead,
  markAsRead,
  markVideoCompleted,
  // NotificationRepository
  NotificationRepository,
  NotificationRepositoryLive,
  notifyCommentReply,
  notifyNewCommentOnVideo,
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
  saveVideoProgress,
  transaction,
  updateComment,
  updateVideo,
  uploadFile,
  uploadLargeFile,
  // VideoProcessor
  VideoProcessor,
  VideoProcessorLive,
  // VideoProgressRepository
  VideoProgressRepository,
  VideoProgressRepositoryLive,
  // VideoRepository
  VideoRepository,
  VideoRepositoryLive,
  validateVideo,
  // Replicate API
  ReplicateAPI,
  ReplicateLive,
  transcribe,
  generateThumbnail,
  generateThumbnails,
  extractMetadata,
  // Zoom
  Zoom,
  ZoomLive,
  getZoomAuthorizationUrl,
  exchangeZoomCodeForToken,
  refreshZoomAccessToken,
  getZoomUserInfo,
  listZoomRecordings,
  getZoomMeetingRecordings,
  // Google Meet
  GoogleMeet,
  GoogleMeetLive,
  getGoogleAuthorizationUrl,
  exchangeGoogleCodeForToken,
  refreshGoogleAccessToken,
  getGoogleUserInfo,
  listGoogleMeetRecordings,
  downloadGoogleFile,
  // Integration Repository
  IntegrationRepository,
  IntegrationRepositoryLive,
  getIntegrations,
  getUserIntegrations,
  getIntegration,
  getIntegrationByProvider,
  createIntegration,
  updateIntegration,
  deleteIntegration,
  getImportedMeetings,
  createImportedMeeting,
  updateImportedMeeting,
  // Search Repository
  SearchRepository,
  SearchRepositoryLive,
  search,
  getSuggestions,
  getRecentSearches,
  saveSearchHistory,
  clearSearchHistory,
  getSavedSearches,
  createSavedSearch,
  updateSavedSearch,
  deleteSavedSearch,
  quickSearch,
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
