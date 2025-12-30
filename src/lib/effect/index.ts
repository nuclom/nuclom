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
  getSeries as getCachedSeries,
  getSeriesProgress as getCachedSeriesProgress,
  getSeriesWithProgress as getCachedSeriesWithProgress,
  getSeriesWithVideos as getCachedSeriesWithVideos,
  getUserVideoProgress as getCachedUserVideoProgress,
  getVideo as getCachedVideo,
  getVideoProgress as getCachedVideoProgress,
  getVideos as getCachedVideos,
  revalidateOrganization,
  revalidateOrganizations,
  revalidateSeries,
  revalidateSeriesById,
  revalidateSeriesProgress,
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
  // SeriesRepository
  CreateSeriesInput,
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
  ReplicateTranscriptionResult as TranscriptionResult,
  ReplicateVideoMetadata,
  SaveProgressInput,
  SeriesRepositoryService,
  StorageConfig,
  // Storage
  StorageService,
  ThumbnailResult,
  UpdateCommentInput,
  UpdateSeriesInput,
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
  // Translation
  TranslationServiceInterface,
  TranslationOptions,
  TranslationResult as TranslationResultType,
  TranslatedTranscript,
  LanguageInfo,
  SupportedLanguage,
} from "./services";

// Services - explicitly export to avoid conflicts
export {
  // AI
  AI,
  AILive,
  // Auth
  Auth,
  addVideoToSeries,
  // CommentRepository
  CommentRepository,
  CommentRepositoryLive,
  createComment,
  createNotification,
  createOrganization,
  createSeries,
  createSummaryStream,
  createVideo,
  // Database
  Database,
  DatabaseLive,
  DrizzleLive,
  deleteComment,
  deleteFile,
  deleteNotification,
  deleteSeries,
  deleteVideoProgress,
  deleteVideoRecord,
  extractActionItems,
  extractMetadata,
  findOneOrFail,
  generateFileKey,
  generatePresignedUploadUrl,
  generateThumbnail,
  generateThumbnails,
  generateVideoSummary,
  generateVideoTags,
  getActiveOrganization,
  getAvailableVideosForSeries,
  getComment,
  getComments,
  getCommentsByTimestamp,
  getDb,
  getMaxFileSize,
  getNotifications,
  getOrganization,
  getOrganizationBySlug,
  getPublicUrl,
  getSeries,
  getSeriesProgress,
  getSeriesWithProgress,
  getSeriesWithVideos,
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
  markSeriesVideoCompleted,
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
  // Replicate API
  ReplicateAPI,
  ReplicateLive,
  removeVideoFromSeries,
  reorderSeriesVideos,
  requireAdmin,
  requireAuth,
  requireRole,
  // SeriesRepository
  SeriesRepository,
  SeriesRepositoryLive,
  // Storage
  Storage,
  StorageLive,
  saveVideoProgress,
  transaction,
  transcribe,
  updateComment,
  updateSeries,
  updateSeriesProgress,
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
  createIntegration as createIntegrationRecord,
  updateIntegration as updateIntegrationRecord,
  deleteIntegration,
  getImportedMeetings,
  createImportedMeeting,
  updateImportedMeeting,
  // Translation
  Translation,
  TranslationLive,
  TranslationNotConfiguredError,
  TranslationApiError,
  UnsupportedLanguageError,
  translateText,
  translateTranscript,
  isTranslationAvailable,
  getSupportedLanguages,
  SUPPORTED_LANGUAGES,
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
