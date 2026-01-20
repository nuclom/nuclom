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
  // Legacy aliases (deprecated)
  getChannels as getCachedChannels,
  getCollectionProgress as getCachedCollectionProgress,
  // Collection queries
  getCollections as getCachedCollections,
  getCollectionsWithProgress as getCachedCollectionsWithProgress,
  getCollectionWithVideos as getCachedCollectionWithVideos,
  // Organization queries
  getOrganizationBySlug as getCachedOrganizationBySlug,
  getOrganizations as getCachedOrganizations,
  getSeries as getCachedSeries,
  getSeriesProgress as getCachedSeriesProgress,
  getSeriesWithProgress as getCachedSeriesWithProgress,
  getSeriesWithVideos as getCachedSeriesWithVideos,
  // Video queries
  getUserVideoProgress as getCachedUserVideoProgress,
  getVideo as getCachedVideo,
  getVideoProgress as getCachedVideoProgress,
  getVideos as getCachedVideos,
  getVideosByAuthor as getCachedVideosByAuthor,
  getVideosSharedByOthers as getCachedVideosSharedByOthers,
  revalidateCollectionById,
  revalidateCollectionProgress,
  // Revalidation helpers
  revalidateCollections,
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
  ClusteringOptions,
  ClusteringResult,
  // CollectionRepository
  CollectionRepositoryService,
  CreateClipInput,
  // CollectionRepository
  CreateCollectionInput,
  CreateHighlightReelInput,
  CreateImportedMeetingInput,
  CreateIntegrationInput,
  CreateMomentInput,
  CreateNotificationInput,
  CreateOrganizationInput,
  CreateSavedSearchInput,
  CreateSearchHistoryInput,
  CreateTopicClusterInput,
  DatabaseService,
  DecisionFilters,
  // Knowledge Graph
  DecisionQueryOptions,
  DecisionTimelineItem,
  DecisionTrackerService,
  DecisionWithRelations,
  DetectionOptions,
  DetectionResult,
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
  KnowledgeCreateDecisionInput,
  KnowledgeDecisionWithRelations,
  KnowledgeGraphRepositoryInterface,
  KnowledgeNodeWithEdges,
  KnowledgeUpdateDecisionInput,
  // NotificationRepository
  NotificationRepositoryService,
  NotificationType,
  NotificationWithActor,
  // OrganizationRepository
  OrganizationRepositoryService,
  OrganizationWithRole,
  ProcessingProgress,
  ProcessingResult,
  RelationshipCandidate,
  RelationshipDetectorService,
  // Replicate API
  ReplicateService,
  ReplicateTranscriptionResult as TranscriptionResult,
  ReplicateVideoMetadata,
  SaveProgressInput,
  SearchParams,
  // Search Repository
  SearchRepositoryService,
  StorageConfig,
  // Storage
  StorageService,
  ThumbnailResult,
  TopicClusterService,
  TopicClusterWithMembers,
  TopicExpertiseEntry,
  UpdateClipInput,
  UpdateCollectionInput,
  UpdateHighlightReelInput,
  UpdateImportedMeetingInput,
  UpdateIntegrationInput,
  UpdateSavedSearchInput,
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
  addVideoToCollection,
  autoClusterContent,
  // BillingRepository
  BillingRepository,
  BillingRepositoryLive,
  // ClipRepository
  ClipRepository,
  ClipRepositoryLive,
  // CollectionRepository
  CollectionRepository,
  CollectionRepositoryLive,
  clearSearchHistory,
  createClip,
  createCollection,
  createHighlightReel,
  createImportedMeeting,
  createIntegration as createIntegrationRecord,
  createKnowledgeDecision,
  createMoment,
  createMomentsBatch,
  createNotification,
  createOrganization,
  createSavedSearch,
  createSummaryStream,
  createTopicCluster,
  createVideo,
  // Database
  Database,
  DatabaseLive,
  DecisionTracker,
  DecisionTrackerLive,
  DrizzleLive,
  deleteClip,
  deleteCollection,
  deleteFile,
  deleteHighlightReel,
  deleteIntegration,
  deleteMomentsByVideoId,
  deleteNotification,
  deleteSavedSearch,
  deleteVideoProgress,
  detectRelationships,
  detectRelationshipsForItem,
  downloadGoogleFile,
  exchangeGoogleCodeForToken,
  exchangeZoomCodeForToken,
  extractActionItems,
  extractDecisions,
  extractKeyFromUrl,
  extractMetadata,
  findOneOrFail,
  findSimilarContentItems,
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
  getAvailableVideosForCollection,
  getClip,
  getClips,
  getClipsByOrganization,
  getCollection,
  getCollectionProgress,
  getCollections,
  getCollectionsWithProgress,
  getCollectionWithVideos,
  getDb,
  getGoogleAuthorizationUrl,
  getGoogleUserInfo,
  getHighlightReel,
  getHighlightReels,
  getImportedMeetings,
  getIntegration,
  getIntegrationByProvider,
  getIntegrations,
  getKnowledgeDecision,
  getMaxFileSize,
  getMoments,
  getMomentsByType,
  getNotifications,
  getOrganization,
  getOrganizationBySlug,
  getRecentSearches,
  getSavedSearches,
  getSession,
  getSessionOption,
  getSuggestions,
  getTopicCluster,
  getTopicExperts,
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
  listDecisions,
  listGoogleMeetRecordings,
  listZoomRecordings,
  makeAuthLayer,
  makeAuthService,
  markAllAsRead,
  markAsRead,
  markCollectionVideoCompleted,
  markVideoCompleted,
  // NotificationRepository
  NotificationRepository,
  NotificationRepositoryLive,
  // OrganizationRepository
  OrganizationRepository,
  OrganizationRepositoryLive,
  processVideo,
  query,
  quickSearch,
  RelationshipDetector,
  RelationshipDetectorLive,
  // Replicate API
  ReplicateAPI,
  ReplicateLive,
  refreshGoogleAccessToken,
  refreshZoomAccessToken,
  removeVideoFromCollection,
  reorderCollectionVideos,
  requireAdmin,
  requireAuth,
  requireRole,
  // Search Repository
  SearchRepository,
  SearchRepositoryLive,
  // Storage
  Storage,
  StorageLive,
  saveSearchHistory,
  saveVideoProgress,
  search,
  TopicCluster,
  TopicClusterLive,
  transaction,
  transcribe,
  updateClip,
  updateCollection,
  updateCollectionProgress,
  updateDecisionStatus,
  updateHighlightReel,
  updateImportedMeeting,
  updateIntegration as updateIntegrationRecord,
  updateSavedSearch,
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
// Unified Search
export type {
  ContentItemType,
  ContentItemWithSource,
  ContentSourceType,
  SearchFacets,
  SearchSuggestion,
  UnifiedSearchParams,
  UnifiedSearchResult,
  UnifiedSearchResultItem,
  UnifiedSearchService,
} from './services/search';
export {
  getSearchFacets,
  searchContentItems,
  UnifiedSearch,
  UnifiedSearchLive,
  unifiedSearch,
} from './services/search';
export type { StreamChunk } from './streaming';
// Streaming utilities
export {
  createDeferredLoader,
  createParallelLoaders,
  runStream,
  streamToAsyncIterable,
  streamVideoSummary,
} from './streaming';
