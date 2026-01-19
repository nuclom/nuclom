/**
 * Effect Services - Central Export
 *
 * All Effect-TS services are exported from this file.
 */

// Activity Feed Repository
export type {
  ActivityFeedFilters,
  ActivityFeedRepositoryService,
  ActivityWithActor,
  CreateActivityInput,
} from './activity-feed-repository';
export {
  ActivityFeedRepository,
  ActivityFeedRepositoryLive,
  createActivity,
  getActivityFeed,
  getActivityStats,
  logIntegrationConnected,
  logMemberJoined,
  logVideoProcessed,
  logVideoShared,
  logVideoUploaded,
} from './activity-feed-repository';

export type { ActionItemResult, AIServiceInterface, ChapterResult, VideoSummary } from './ai';
// AI Service
export {
  AI,
  AILive,
  createSummaryStream,
  extractActionItems,
  extractActionItemsWithTimestamps,
  generateChapters,
  generateVideoSummary,
  generateVideoTags,
} from './ai';
// AI Structured Service (Effect Schema)
export type {
  ActionItemsResult,
  AIStructuredServiceInterface,
  ChaptersResult,
  VideoSummary as StructuredVideoSummary,
  VideoTagsResult,
} from './ai-structured';
export {
  ActionItemsSchema,
  AIStructured,
  AIStructuredLive,
  ChaptersSchema,
  extractStructuredActionItems,
  generateStructuredChapters,
  generateStructuredVideoSummary,
  generateStructuredVideoTags,
  VideoSummarySchema,
  VideoTagsSchema,
} from './ai-structured';
export type { AuthServiceInterface, UserSession } from './auth';
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
} from './auth';
export type { BillingServiceInterface, CreateCheckoutParams, LimitResource } from './billing';
export {
  Billing,
  BillingLive,
  cancelSubscription,
  changePlan,
  checkLimit,
  createCheckoutSession,
  createPortalSession,
  enforceLimit,
  getFeatureAccess,
  resumeSubscription,
} from './billing';
// Billing Middleware
export type { LimitCheckResult } from './billing-middleware';
export {
  checkFeatureAccess,
  checkResourceLimit,
  enforceResourceLimit,
  getPlanFeatures,
  getPlanLimits,
  releaseStorageUsage,
  releaseVideoCount,
  requireActiveSubscription,
  requireFeature,
  trackAIRequest,
  trackBandwidthUsage,
  trackStorageUsage,
  trackVideoUpload,
} from './billing-middleware';
// Billing Services
export type {
  BillingRepositoryService,
  OrganizationBillingInfo,
  SubscriptionWithPlan,
  UsageSummary,
} from './billing-repository';
export {
  BillingRepository,
  BillingRepositoryLive,
  decrementUsage,
  getBillingInfo,
  getCurrentUsage,
  getInvoices,
  getMemberCount,
  getPlan,
  getPlans,
  getSubscription,
  getSubscriptionOption,
  getUsageSummary,
  getVideoCount,
  incrementUsage,
} from './billing-repository';
// Clip Repository
export type {
  ClipRepositoryService,
  CreateClipInput,
  CreateHighlightReelInput,
  CreateMomentInput,
  HighlightReelWithCreator,
  UpdateClipInput,
  UpdateHighlightReelInput,
  VideoClipWithCreator,
  VideoMomentWithVideo,
} from './clip-repository';
export {
  ClipRepository,
  ClipRepositoryLive,
  createClip,
  createHighlightReel,
  createMoment,
  createMomentsBatch,
  deleteClip,
  deleteHighlightReel,
  deleteMomentsByVideoId,
  getClip,
  getClips,
  getClipsByOrganization,
  getHighlightReel,
  getHighlightReels,
  getMoments,
  getMomentsByType,
  updateClip,
  updateHighlightReel,
} from './clip-repository';
// Collection Repository (unified: folders and playlists)
export type {
  CollectionRepositoryService,
  CreateCollectionInput,
  UpdateCollectionInput,
} from './collection-repository';
export {
  addVideoToCollection,
  CollectionRepository,
  CollectionRepositoryLive,
  createCollection,
  deleteCollection,
  getAvailableVideosForCollection,
  getCollection,
  getCollectionProgress,
  getCollections,
  getCollectionsWithProgress,
  getCollectionWithVideos,
  markCollectionVideoCompleted,
  removeVideoFromCollection,
  reorderCollectionVideos,
  updateCollection,
  updateCollectionProgress,
} from './collection-repository';
// Content Services
export type {
  AdapterFetchOptions,
  AdapterFetchResult,
  ContentItem,
  ContentItemFilters,
  ContentItemMetadata,
  ContentItemSortOptions,
  ContentItemType,
  ContentItemWithRelations,
  ContentKeyPoint,
  ContentParticipant,
  ContentParticipantRole,
  ContentProcessingStatus,
  ContentProcessorError,
  ContentProcessorService,
  ContentRelationship,
  ContentRelationshipType,
  ContentRepositoryError,
  ContentRepositoryService,
  ContentSource,
  ContentSourceAdapter,
  ContentSourceConfig,
  ContentSourceFilters,
  ContentSourceSyncStatus,
  ContentSourceType,
  ContentSourceWithStats,
  CreateContentItemInput,
  CreateContentParticipantInput,
  CreateContentRelationshipInput,
  CreateContentSourceInput,
  PaginatedResult,
  PaginationOptions,
  RawContentItem,
  SyncProgress,
  UpdateContentItemInput,
  UpdateContentSourceInput,
} from './content';
export {
  ContentProcessor,
  ContentProcessorLive,
  ContentRepository,
  ContentRepositoryLive,
  createContentItem,
  createContentSource,
  createVideoContentAdapter,
  deleteContentItem,
  deleteContentSource,
  ensureVideoContentSource,
  getContentItem,
  getContentItemByExternalId,
  getContentItems,
  getContentItemWithRelations,
  getContentSource,
  getContentSources,
  getContentSourcesWithStats,
  getContentSyncProgress,
  processContentItem,
  processContentItemsBatch,
  registerContentAdapter,
  registerVideoAdapter,
  syncContentSource,
  syncNewVideoToContent,
  syncVideoToContent,
  updateContentItem,
  updateContentSource,
  updateVideoContentItem,
  upsertContentItem,
} from './content';
export type { DatabaseService, DrizzleDB } from './database';
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
} from './database';
// Decision Extraction Service
export type {
  DecisionExtractionResult,
  DecisionExtractionServiceInterface,
  DecisionStatus as ExtractedDecisionStatus,
  DecisionType as ExtractedDecisionType,
  ExternalReference,
  ExtractedDecision,
  Participant,
} from './decision-extraction';
export {
  DecisionExtraction,
  DecisionExtractionLive,
  DecisionExtractionResultSchema,
  DecisionStatusSchema,
  DecisionTypeSchema,
  ExternalReferenceSchema,
  ExtractedDecisionSchema,
  extractDecisionsFromSegments,
  extractDecisionsFromTranscript,
  ParticipantSchema,
} from './decision-extraction';
// Email Notifications Service
export type {
  EmailError,
  EmailNotificationServiceInterface,
  InvitationNotificationData,
  SubscriptionNotificationData,
  TrialEndingNotificationData,
  VideoProcessingNotificationData,
} from './email-notifications';
export {
  EmailNotifications,
  EmailNotificationsLive,
  sendInvitationNotification,
  sendSubscriptionNotification,
  sendTrialEndingNotification,
  sendVideoProcessingNotification,
} from './email-notifications';
// Embedding Service
export type {
  ChunkConfig,
  ChunkEmbedding,
  EmbeddingServiceInterface,
  TextChunk,
} from './embedding';
export {
  chunkTranscript,
  Embedding,
  EmbeddingLive,
  generateEmbedding,
  generateEmbeddings,
  processTranscript,
} from './embedding';
// Google Meet Service
export type {
  GoogleConfig,
  GoogleDriveFilesResponse,
  GoogleMeetRecording,
  GoogleMeetServiceInterface,
  GoogleTokenResponse,
  GoogleUserInfo,
} from './google-meet';
export {
  downloadGoogleFile,
  exchangeGoogleCodeForToken,
  GoogleMeet,
  GoogleMeetLive,
  getGoogleAuthorizationUrl,
  getGoogleUserInfo,
  listGoogleMeetRecordings,
  refreshGoogleAccessToken,
} from './google-meet';
// Integration Repository
export type {
  CreateImportedMeetingInput,
  CreateIntegrationInput,
  ImportedMeetingWithVideo,
  IntegrationRepositoryService,
  IntegrationWithUser,
  UpdateImportedMeetingInput,
  UpdateIntegrationInput,
} from './integration-repository';
export {
  createImportedMeeting,
  createIntegration,
  deleteIntegration,
  getImportedMeetings,
  getIntegration,
  getIntegrationByProvider,
  getIntegrations,
  getUserIntegrations,
  IntegrationRepository,
  IntegrationRepositoryLive,
  updateImportedMeeting,
  updateIntegration,
} from './integration-repository';
// Knowledge Graph Repository
export type {
  DecisionQueryOptions,
  DecisionTimelineItem,
  DecisionWithRelations,
  GraphQueryOptions,
  KnowledgeGraphRepositoryInterface,
  KnowledgeNodeWithEdges,
} from './knowledge-graph-repository';
export {
  KnowledgeGraphRepository,
  KnowledgeGraphRepositoryLive,
} from './knowledge-graph-repository';
// Microsoft Teams Service
export type {
  MicrosoftTeamsConfig,
  MicrosoftTeamsServiceInterface,
  MicrosoftTokenResponse,
  MicrosoftUserInfo,
  TeamsChannel,
  TeamsChannelsResponse,
  TeamsMessagePayload,
  TeamsMessageResponse,
  TeamsTeam,
  TeamsTeamsResponse,
} from './microsoft-teams';
export {
  exchangeMicrosoftTeamsCodeForToken,
  getMicrosoftTeamsAuthorizationUrl,
  getMicrosoftTeamsUserInfo,
  listMicrosoftTeams,
  listMicrosoftTeamsChannels,
  MicrosoftTeams,
  MicrosoftTeamsLive,
  refreshMicrosoftTeamsToken,
  sendMicrosoftTeamsMessage,
  sendMicrosoftTeamsVideoNotification,
} from './microsoft-teams';
export type {
  CreateNotificationInput,
  NotificationRepositoryService,
  NotificationType,
  NotificationWithActor,
} from './notification-repository';
// Notification Repository
export {
  createNotification,
  deleteNotification,
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
  NotificationRepository,
  NotificationRepositoryLive,
} from './notification-repository';
export type {
  CreateOrganizationInput,
  OrganizationRepositoryService,
  OrganizationWithRole,
} from './organization-repository';
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
} from './organization-repository';
// Performance Monitoring Service
export type {
  MetricsSummary,
  MetricsTimeSeries,
  MetricType,
  PerformanceMonitoringServiceInterface,
  PerformanceReport,
  RecordMetricInput,
} from './performance-monitoring';
export {
  getPerformanceReport,
  PerformanceMonitoring,
  PerformanceMonitoringLive,
  recordMetric,
} from './performance-monitoring';
// Presence Service
export type {
  PresenceServiceInterface,
  PresenceUpdate,
  UserPresenceInfo,
} from './presence';
export {
  getOrganizationPresence,
  getVideoPresence,
  Presence,
  PresenceLive,
  updatePresence,
} from './presence';
// Recommendations Service
export type {
  ContinueWatchingItem,
  RecommendationOptions,
  RecommendationsServiceInterface,
  TrendingVideo,
} from './recommendations';
export {
  getContinueWatching,
  getRecommendations,
  getSimilarVideos,
  getTrending,
  Recommendations,
  RecommendationsLive,
} from './recommendations';
// Replicate API Service
export type {
  ReplicateService,
  ThumbnailResult,
  TranscriptionResult as ReplicateTranscriptionResult,
  VideoMetadata as ReplicateVideoMetadata,
} from './replicate';
export {
  extractMetadata,
  generateThumbnail,
  generateThumbnails,
  ReplicateAPI,
  ReplicateLive,
  transcribe,
} from './replicate';
// Request Context Service
export type {
  CreateRequestContextInput,
  RequestContext,
  RequestContextService,
} from './request-context';
export {
  addCorrelationHeader,
  enrichContextWithUser,
  extractRequestContext,
  getCorrelationId,
  getRequestContext,
  makeRequestContextLayer,
  makeRequestContextService,
  RequestContextTag,
  toLogContext,
} from './request-context';
// Search Repository
export type {
  CreateSavedSearchInput,
  CreateSearchHistoryInput,
  SearchParams,
  SearchRepositoryService,
  UpdateSavedSearchInput,
} from './search-repository';
export {
  clearSearchHistory,
  createSavedSearch,
  deleteSavedSearch,
  getRecentSearches,
  getSavedSearches,
  getSuggestions,
  quickSearch,
  SearchRepository,
  SearchRepositoryLive,
  saveSearchHistory,
  search,
  updateSavedSearch,
} from './search-repository';
// Semantic Search Repository
export type {
  SemanticSearchParams,
  SemanticSearchRepositoryService,
  SemanticSearchResult,
  SemanticSearchResultWithVideo,
  SimilarVideoResult,
  SimilarVideosParams,
} from './semantic-search-repository';
export {
  findSimilarVideos,
  SemanticSearchRepository,
  SemanticSearchRepositoryLive,
  saveTranscriptChunks,
  semanticSearch,
  semanticSearchWithVideos,
} from './semantic-search-repository';
// Slack Service
export type {
  SlackChannel,
  SlackChannelsResponse,
  SlackConfig,
  SlackMessagePayload,
  SlackMessageResponse,
  SlackServiceInterface,
  SlackTokenResponse,
  SlackUserInfo,
} from './slack';
export {
  exchangeSlackCodeForToken,
  getSlackAuthorizationUrl,
  getSlackUserInfo,
  listSlackChannels,
  Slack,
  SlackLive,
  sendSlackMessage,
  sendSlackVideoNotification,
  verifySlackSignature,
} from './slack';
// Slack Monitoring Service
export type {
  MonitoringEvent,
  MonitoringEventType,
  SlackMonitoringServiceInterface,
} from './slack-monitoring';
export {
  notifySlackMonitoring,
  SlackMonitoring,
  SlackMonitoringLive,
  sendSlackAccountEvent,
  sendSlackBillingEvent,
  sendSlackErrorEvent,
  sendSlackMonitoringEvent,
  sendSlackVideoEvent,
} from './slack-monitoring';
// Speaker Diarization Service
export type {
  DiarizationOptions,
  DiarizationResult,
  DiarizedSegment,
  ExpectedSpeaker,
  SpeakerDiarizationServiceInterface,
  SpeakerSummary,
} from './speaker-diarization';
export {
  calculateBalanceScore,
  DiarizationError,
  DiarizationNotConfiguredError,
  diarizeFromUrl,
  isDiarizationAvailable,
  SpeakerDiarization,
  SpeakerDiarizationLive,
} from './speaker-diarization';
// Speaker Repository Service
export type {
  CreateSpeakerProfileInput,
  CreateSpeakerSegmentInput,
  CreateVideoSpeakerInput,
  SpeakerProfileWithUser,
  SpeakerRepositoryService,
  SpeakerTrend,
  TalkTimeDistribution,
  UpdateSpeakerProfileInput,
  VideoSpeakerWithProfile,
} from './speaker-repository';
export {
  createSpeakerProfile,
  getSpeakerProfile,
  getSpeakerProfiles,
  getTalkTimeDistribution,
  getVideoSpeakers,
  linkVideoSpeakerToProfile,
  SpeakerRepository,
  SpeakerRepositoryError,
  SpeakerRepositoryLive,
} from './speaker-repository';
export type { StorageConfig, StorageService, UploadOptions, UploadProgress, UploadResult } from './storage';
// Storage Service
export {
  deleteFile,
  extractKeyFromUrl,
  generateFileKey,
  generatePresignedDownloadUrl,
  generatePresignedUploadUrl,
  Storage,
  StorageLive,
  uploadFile,
} from './storage';
export type { StripeService } from './stripe';
export { getStripe, StripeServiceLive, StripeServiceTag } from './stripe';
export type { TranscriptionOptions, TranscriptionResult, TranscriptionServiceInterface } from './transcription';
// Transcription Service
export {
  AudioExtractionError,
  isTranscriptionAvailable,
  Transcription,
  TranscriptionError,
  TranscriptionLive,
  transcribeAudio,
  transcribeFromUrl,
} from './transcription';
export type { AIProcessingResult, VideoAIProcessorServiceInterface } from './video-ai-processor';
// Video AI Processor Service
export {
  getVideoProcessingStatus,
  processFromTranscript,
  processVideoAI,
  updateVideoProcessingStatus,
  VideoAIProcessingError,
  VideoAIProcessor,
  VideoAIProcessorLive,
} from './video-ai-processor';
export type {
  ProcessingProgress,
  ProcessingResult,
  VideoInfo,
  VideoProcessorService,
} from './video-processor';
// Video Processor Service
export {
  getMaxFileSize,
  getVideoInfo,
  isSupportedVideoFormat,
  processVideo,
  VideoProcessor,
  VideoProcessorLive,
  validateVideo,
} from './video-processor';
export type {
  SaveProgressInput,
  VideoProgressData,
  VideoProgressRepositoryService,
} from './video-progress-repository';
// Video Progress Repository
export {
  deleteVideoProgress,
  getUserVideoProgress,
  getVideoProgress,
  hasWatchedVideo,
  markVideoCompleted,
  saveVideoProgress,
  VideoProgressRepository,
  VideoProgressRepositoryLive,
} from './video-progress-repository';
export type { CreateVideoInput, UpdateVideoInput, VideoRepositoryService } from './video-repository';
// Video Repository
export {
  createVideo,
  deleteVideo,
  getVideo,
  getVideoChapters,
  getVideos,
  updateVideo,
  VideoRepository,
  VideoRepositoryLive,
} from './video-repository';
// Vocabulary Repository
export type {
  CreateCorrectionSuggestionInput,
  CreateVocabularyInput,
  UpdateVocabularyInput,
  VocabularyCategory,
  VocabularyRepositoryService,
  VocabularySearchResult,
  VocabularyWithCreator,
} from './vocabulary-repository';
export {
  applyVocabularyCorrections,
  createVocabulary,
  findMatchingVocabulary,
  getOrganizationVocabulary,
  getVocabularyTermsForPrompt,
  VocabularyRepository,
  VocabularyRepositoryError,
  VocabularyRepositoryLive,
} from './vocabulary-repository';
// Watch Later Service
export type {
  AddToWatchLaterInput,
  UpdateWatchLaterInput,
  WatchLaterItem,
  WatchLaterServiceInterface,
} from './watch-later';
export {
  addToWatchLater,
  getWatchLaterList,
  isInWatchLater,
  removeFromWatchLater,
  WatchLaterService,
  WatchLaterServiceLive,
} from './watch-later';
// Zapier Webhooks Service
export type {
  CreateWebhookInput,
  UpdateWebhookInput,
  WebhookDeliveryResult,
  WebhookPayload,
  WebhookWithStats,
  ZapierWebhooksServiceInterface,
} from './zapier-webhooks';
export {
  createZapierWebhook,
  deleteZapierWebhook,
  getZapierWebhookDeliveries,
  getZapierWebhooks,
  retryZapierWebhookDelivery,
  triggerZapierWebhooks,
  updateZapierWebhook,
  ZapierWebhooksService,
  ZapierWebhooksServiceLive,
} from './zapier-webhooks';
// Zoom Service
export type {
  ZoomConfig,
  ZoomMeeting,
  ZoomRecording,
  ZoomRecordingsResponse,
  ZoomServiceInterface,
  ZoomTokenResponse,
  ZoomUserInfo,
} from './zoom';
export {
  exchangeZoomCodeForToken,
  getZoomAuthorizationUrl,
  getZoomMeetingRecordings,
  getZoomUserInfo,
  listZoomRecordings,
  refreshZoomAccessToken,
  Zoom,
  ZoomLive,
} from './zoom';

// =============================================================================
// Slack, Notion, GitHub Content Adapters
// =============================================================================

export type { SlackContentAdapterService } from './content';
export {
  SlackContentAdapter,
  SlackContentAdapterLive,
  createSlackContentAdapter,
  getSlackContentAuthUrl,
  SLACK_CONTENT_SCOPES,
  resolveUserMentions,
  resolveChannelMentions,
  formatSlackMrkdwn,
} from './content';

export type { NotionContentAdapterService } from './content';
export {
  NotionContentAdapter,
  NotionContentAdapterLive,
  createNotionContentAdapter,
  getNotionAuthUrl,
  exchangeNotionCode,
} from './content';

export type { GitHubContentAdapterService } from './content';
export {
  GitHubContentAdapter,
  GitHubContentAdapterLive,
  createGitHubContentAdapter,
  getGitHubAuthUrl,
  exchangeGitHubCode,
  verifyGitHubWebhookSignature,
  cleanupExpiredFileCache,
} from './content';

// =============================================================================
// Knowledge Graph Services
// =============================================================================

export type {
  RelationshipDetectorService,
  RelationshipCandidate,
  DetectionOptions,
  DetectionResult,
  DecisionTrackerService,
  CreateDecisionInput as KnowledgeCreateDecisionInput,
  UpdateDecisionInput as KnowledgeUpdateDecisionInput,
  DecisionFilters,
  DecisionWithRelations as KnowledgeDecisionWithRelations,
  DecisionTimelineEntry,
  ExtractedDecision as KnowledgeExtractedDecision,
  DecisionStatus as KnowledgeDecisionStatus,
  DecisionType as KnowledgeDecisionType,
  TopicClusterService,
  CreateTopicClusterInput,
  TopicClusterWithMembers,
  TopicExpertiseEntry,
  ClusteringOptions,
  ClusteringResult,
} from './knowledge';

export {
  RelationshipDetector,
  RelationshipDetectorLive,
  detectRelationshipsForItem,
  detectRelationships,
  findSimilarContentItems,
  DecisionTracker,
  DecisionTrackerLive,
  createDecision as createKnowledgeDecision,
  getDecision as getKnowledgeDecision,
  listDecisions,
  updateDecisionStatus,
  extractDecisions,
  TopicCluster,
  TopicClusterLive,
  createTopicCluster,
  getTopicCluster,
  autoClusterContent,
  getTopicExperts,
} from './knowledge';
