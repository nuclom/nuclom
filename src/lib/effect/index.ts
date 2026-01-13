/**
 * Effect-TS Module - Central Export
 *
 * This file serves as the main entry point for the Effect-TS module.
 * Import from "@/lib/effect" to access all Effect functionality.
 */

// Common Effect exports
export * from './common';
export type { DatabaseConfig as DatabaseConfigType } from './config';

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
} from './config';

// Custom error types
export * from './errors';
export type { AppServices } from './runtime';

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
} from './runtime';

// Server utilities (for RSC)
export {
  createCachedQuery,
  createVideo as serverCreateVideo,
  deleteVideo as serverDeleteVideo,
  getChannel as getCachedChannel,
  getChannels as getCachedChannels,
  getChannelVideosWithAuthor as getCachedChannelVideos,
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
  getVideosByAuthor as getCachedVideosByAuthor,
  getVideosSharedByOthers as getCachedVideosSharedByOthers,
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
} from './server';

export type {
  // AI
  AIServiceInterface,
  // Auth
  AuthServiceInterface,
  // ClipRepository
  ClipRepositoryService,
  CommentEvent,
  // CommentRepository
  CommentRepositoryService,
  CommentWithAuthor,
  CommentWithReplies,
  CreateClipInput,
  CreateCommentInput,
  CreateHighlightReelInput,
  CreateImportedMeetingInput,
  CreateIntegrationInput,
  CreateMomentInput,
  CreateNotificationInput,
  CreateOrganizationInput,
  CreateQuoteCardInput,
  CreateSavedSearchInput,
  CreateSearchHistoryInput,
  // SeriesRepository
  CreateSeriesInput,
  DatabaseService,
  // Knowledge Graph
  DecisionQueryOptions,
  DecisionTimelineItem,
  DecisionWithRelations,
  // Database
  DrizzleDB,
  GoogleDriveFilesResponse,
  GoogleMeetRecording,
  // Google Meet
  GoogleMeetServiceInterface,
  GraphQueryOptions,
  HighlightReelWithCreator,
  ImportedMeetingWithVideo,
  // Integration Repository
  IntegrationRepositoryService,
  IntegrationWithUser,
  KnowledgeGraphRepositoryInterface,
  KnowledgeNodeWithEdges,
  // NotificationRepository
  NotificationRepositoryService,
  NotificationType,
  NotificationWithActor,
  // OrganizationRepository
  OrganizationRepositoryService,
  OrganizationWithRole,
  ProcessingProgress,
  ProcessingResult,
  QuoteCardWithCreator,
  // Replicate API
  ReplicateService,
  ReplicateTranscriptionResult as TranscriptionResult,
  ReplicateVideoMetadata,
  SaveProgressInput,
  SearchParams,
  // Search Repository
  SearchRepositoryService,
  SeriesRepositoryService,
  StorageConfig,
  // Storage
  StorageService,
  ThumbnailResult,
  UpdateClipInput,
  UpdateCommentInput,
  UpdateHighlightReelInput,
  UpdateImportedMeetingInput,
  UpdateIntegrationInput,
  UpdateQuoteCardInput,
  UpdateSavedSearchInput,
  UpdateSeriesInput,
  UploadOptions,
  UploadProgress,
  UploadResult,
  UserSession,
  VideoClipWithCreator,
  VideoInfo,
  VideoMomentWithVideo,
  // VideoProcessor
  VideoProcessorService,
  VideoProgressData,
  // VideoProgressRepository
  VideoProgressRepositoryService,
  // VideoRepository
  VideoRepositoryService,
  VideoSummary,
  ZoomRecording,
  ZoomRecordingsResponse,
  // Zoom
  ZoomServiceInterface,
} from './services';

// Services - explicitly export to avoid conflicts
export {
  // AI
  AI,
  AILive,
  // Auth
  Auth,
  addVideoToSeries,
  // ClipRepository
  ClipRepository,
  ClipRepositoryLive,
  // CommentRepository
  CommentRepository,
  CommentRepositoryLive,
  clearSearchHistory,
  createClip,
  createComment,
  createHighlightReel,
  createImportedMeeting,
  createIntegration as createIntegrationRecord,
  createMoment,
  createMomentsBatch,
  createNotification,
  createOrganization,
  createQuoteCard,
  createSavedSearch,
  createSeries,
  createSummaryStream,
  createVideo,
  // Database
  Database,
  DatabaseLive,
  DrizzleLive,
  deleteClip,
  deleteComment,
  deleteFile,
  deleteHighlightReel,
  deleteIntegration,
  deleteMomentsByVideoId,
  deleteNotification,
  deleteQuoteCard,
  deleteSavedSearch,
  deleteSeries,
  deleteVideoProgress,
  downloadGoogleFile,
  exchangeGoogleCodeForToken,
  exchangeZoomCodeForToken,
  extractActionItems,
  extractKeyFromUrl,
  extractMetadata,
  findOneOrFail,
  // Google Meet
  GoogleMeet,
  GoogleMeetLive,
  generateFileKey,
  generatePresignedDownloadUrl,
  generatePresignedUploadUrl,
  generateThumbnail,
  generateThumbnails,
  generateVideoSummary,
  generateVideoTags,
  getActiveOrganization,
  getAvailableVideosForSeries,
  getClip,
  getClips,
  getClipsByOrganization,
  getComment,
  getComments,
  getCommentsByTimestamp,
  getDb,
  getGoogleAuthorizationUrl,
  getGoogleUserInfo,
  getHighlightReel,
  getHighlightReels,
  getImportedMeetings,
  getIntegration,
  getIntegrationByProvider,
  getIntegrations,
  getMaxFileSize,
  getMoments,
  getMomentsByType,
  getNotifications,
  getOrganization,
  getOrganizationBySlug,
  getQuoteCard,
  getQuoteCards,
  getRecentSearches,
  getSavedSearches,
  getSeries,
  getSeriesProgress,
  getSeriesWithProgress,
  getSeriesWithVideos,
  getSession,
  getSessionOption,
  getSuggestions,
  getUnreadCount,
  getUserIntegrations,
  getUserOrganizations,
  getUserRole,
  getUserVideoProgress,
  getVideo,
  getVideoInfo,
  getVideoProgress,
  getVideos,
  getZoomAuthorizationUrl,
  getZoomMeetingRecordings,
  getZoomUserInfo,
  hasWatchedVideo,
  // Integration Repository
  IntegrationRepository,
  IntegrationRepositoryLive,
  insertUnique,
  isMember,
  isSupportedVideoFormat,
  // Knowledge Graph Repository
  KnowledgeGraphRepository,
  KnowledgeGraphRepositoryLive,
  listGoogleMeetRecordings,
  listZoomRecordings,
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
  quickSearch,
  // Replicate API
  ReplicateAPI,
  ReplicateLive,
  refreshGoogleAccessToken,
  refreshZoomAccessToken,
  removeVideoFromSeries,
  reorderSeriesVideos,
  requireAdmin,
  requireAuth,
  requireRole,
  // Search Repository
  SearchRepository,
  SearchRepositoryLive,
  // SeriesRepository
  SeriesRepository,
  SeriesRepositoryLive,
  // Storage
  Storage,
  StorageLive,
  saveSearchHistory,
  saveVideoProgress,
  search,
  transaction,
  transcribe,
  updateClip,
  updateComment,
  updateHighlightReel,
  updateImportedMeeting,
  updateIntegration as updateIntegrationRecord,
  updateQuoteCard,
  updateSavedSearch,
  updateSeries,
  updateSeriesProgress,
  updateVideo,
  uploadFile,
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
} from './services';

export type { StreamChunk } from './streaming';
// Streaming utilities
export {
  createDeferredLoader,
  createParallelLoaders,
  runStream,
  streamToAsyncIterable,
  streamVideoSummary,
} from './streaming';
