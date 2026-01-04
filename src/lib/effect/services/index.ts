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
} from "./activity-feed-repository";
export {
  ActivityFeedRepository,
  ActivityFeedRepositoryLive,
  createActivity,
  getActivityFeed,
  getActivityStats,
  logCommentAdded,
  logIntegrationConnected,
  logMemberJoined,
  logVideoProcessed,
  logVideoShared,
  logVideoUploaded,
} from "./activity-feed-repository";

export type { ActionItemResult, AIServiceInterface, ChapterResult, CodeSnippetResult, VideoSummary } from "./ai";
// AI Service
export {
  AI,
  AILive,
  createSummaryStream,
  detectCodeSnippets,
  extractActionItems,
  extractActionItemsWithTimestamps,
  generateChapters,
  generateVideoSummary,
  generateVideoTags,
} from "./ai";
// AI Structured Service (with Zod schemas)
export type {
  ActionItemsResult,
  AIStructuredServiceInterface,
  ChaptersResult,
  CodeSnippetsResult,
  VideoSummary as StructuredVideoSummary,
  VideoTagsResult,
} from "./ai-structured";
export {
  ActionItemsSchema,
  AIStructured,
  AIStructuredLive,
  ChaptersSchema,
  CodeSnippetsSchema,
  detectStructuredCodeSnippets,
  extractStructuredActionItems,
  generateStructuredChapters,
  generateStructuredVideoSummary,
  generateStructuredVideoTags,
  VideoSummarySchema,
  VideoTagsSchema,
} from "./ai-structured";
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
export type { BillingServiceInterface, CreateCheckoutParams, LimitResource } from "./billing";
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
} from "./billing";
// Billing Middleware
export type { LimitCheckResult } from "./billing-middleware";
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
} from "./billing-middleware";
// Billing Services
export type {
  BillingRepositoryService,
  OrganizationBillingInfo,
  SubscriptionWithPlan,
  UsageSummary,
} from "./billing-repository";
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
} from "./billing-repository";
// Channel Repository
export type { ChannelRepositoryService, CreateChannelInput, UpdateChannelInput } from "./channel-repository";
export {
  ChannelRepository,
  ChannelRepositoryLive,
  createChannel,
  deleteChannel,
  getChannel,
  getChannels,
  updateChannel,
} from "./channel-repository";
// Clip Repository
export type {
  ClipRepositoryService,
  CreateClipInput,
  CreateHighlightReelInput,
  CreateMomentInput,
  CreateQuoteCardInput,
  HighlightReelWithCreator,
  QuoteCardWithCreator,
  UpdateClipInput,
  UpdateHighlightReelInput,
  UpdateQuoteCardInput,
  VideoClipWithCreator,
  VideoMomentWithVideo,
} from "./clip-repository";
export {
  ClipRepository,
  ClipRepositoryLive,
  createClip,
  createHighlightReel,
  createMoment,
  createMomentsBatch,
  createQuoteCard,
  deleteClip,
  deleteHighlightReel,
  deleteMomentsByVideoId,
  deleteQuoteCard,
  getClip,
  getClips,
  getClipsByOrganization,
  getHighlightReel,
  getHighlightReels,
  getMoments,
  getMomentsByType,
  getQuoteCard,
  getQuoteCards,
  updateClip,
  updateHighlightReel,
  updateQuoteCard,
} from "./clip-repository";
// Code Links Repository
export type {
  CodeLinksByArtifact,
  CodeLinksRepositoryService,
  CodeLinkWithVideo,
  CreateCodeLinkInput,
  UpdateCodeLinkInput,
} from "./code-links-repository";
export {
  CodeLinksRepository,
  CodeLinksRepositoryLive,
  createCodeLink,
  deleteCodeLink,
  getCodeLinksByArtifact,
  getCodeLinksForVideo,
} from "./code-links-repository";
// Code Reference Detector
export type {
  CodeReferenceDetectorConfig,
  CodeReferenceDetectorInterface,
  DetectionResult,
} from "./code-reference-detector";
export {
  CodeReferenceDetector,
  CodeReferenceDetectorLive,
  detectCodeRefsInText,
  detectCodeRefsInTranscript,
} from "./code-reference-detector";
// Comment Reactions Service
export type {
  CommentReactionsServiceInterface,
  CommentWithReactions,
  ReactionCount,
  ReactionUser,
} from "./comment-reactions";
export {
  CommentReactionsService,
  CommentReactionsServiceLive,
  getReactionCounts,
  getReactionsForComments,
  toggleReaction,
} from "./comment-reactions";
export type {
  CommentEvent,
  CommentRepositoryService,
  CommentWithAuthor,
  CommentWithReplies,
  CreateCommentInput,
  UpdateCommentInput,
} from "./comment-repository";
// Comment Repository
export {
  CommentRepository,
  CommentRepositoryLive,
  createComment,
  deleteComment,
  getComment,
  getComments,
  getCommentsByTimestamp,
  updateComment,
} from "./comment-repository";
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
// Decision Extraction Service
export type {
  DecisionExtractionResult,
  DecisionExtractionServiceInterface,
  DecisionStatus as ExtractedDecisionStatus,
  DecisionType as ExtractedDecisionType,
  ExternalReference,
  ExtractedDecision,
  Participant,
} from "./decision-extraction";
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
} from "./decision-extraction";
// Email Notifications Service
export type {
  CommentNotificationData,
  EmailError,
  EmailNotificationServiceInterface,
  InvitationNotificationData,
  SubscriptionNotificationData,
  TrialEndingNotificationData,
  VideoProcessingNotificationData,
} from "./email-notifications";
export {
  EmailNotifications,
  EmailNotificationsLive,
  sendCommentNotification,
  sendInvitationNotification,
  sendSubscriptionNotification,
  sendTrialEndingNotification,
  sendVideoProcessingNotification,
} from "./email-notifications";
// GitHub Service
export type {
  GitHubCommit,
  GitHubConfig,
  GitHubFile,
  GitHubIssue,
  GitHubPullRequest,
  GitHubRepositoriesResponse,
  GitHubRepository,
  GitHubServiceInterface,
  GitHubTokenResponse,
  GitHubUserInfo,
} from "./github";
export {
  exchangeGitHubCodeForToken,
  GitHub,
  GitHubLive,
  getGitHubAuthorizationUrl,
  getGitHubCommit,
  getGitHubIssue,
  getGitHubPullRequest,
  getGitHubRepository,
  getGitHubUserInfo,
  listGitHubRepositories,
  refreshGitHubAccessToken,
} from "./github";
// Google Meet Service
export type {
  GoogleConfig,
  GoogleDriveFilesResponse,
  GoogleMeetRecording,
  GoogleMeetServiceInterface,
  GoogleTokenResponse,
  GoogleUserInfo,
} from "./google-meet";
export {
  downloadGoogleFile,
  exchangeGoogleCodeForToken,
  GoogleMeet,
  GoogleMeetLive,
  getGoogleAuthorizationUrl,
  getGoogleUserInfo,
  listGoogleMeetRecordings,
  refreshGoogleAccessToken,
} from "./google-meet";
// Integration Repository
export type {
  CreateImportedMeetingInput,
  CreateIntegrationInput,
  ImportedMeetingWithVideo,
  IntegrationRepositoryService,
  IntegrationWithUser,
  UpdateImportedMeetingInput,
  UpdateIntegrationInput,
} from "./integration-repository";
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
} from "./integration-repository";
// Knowledge Graph Repository
export type {
  DecisionQueryOptions,
  DecisionTimelineItem,
  DecisionWithRelations,
  GraphQueryOptions,
  KnowledgeGraphRepositoryInterface,
  KnowledgeNodeWithEdges,
} from "./knowledge-graph-repository";
export {
  KnowledgeGraphRepository,
  KnowledgeGraphRepositoryLive,
} from "./knowledge-graph-repository";
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
} from "./microsoft-teams";
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
} from "./microsoft-teams";
export type {
  CreateNotificationInput,
  NotificationRepositoryService,
  NotificationType,
  NotificationWithActor,
} from "./notification-repository";
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
  notifyCommentReply,
  notifyNewCommentOnVideo,
} from "./notification-repository";
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
// Performance Monitoring Service
export type {
  MetricsSummary,
  MetricsTimeSeries,
  MetricType,
  PerformanceMonitoringServiceInterface,
  PerformanceReport,
  RecordMetricInput,
} from "./performance-monitoring";
export {
  getPerformanceReport,
  PerformanceMonitoring,
  PerformanceMonitoringLive,
  recordMetric,
} from "./performance-monitoring";
// Presence Service
export type {
  PresenceServiceInterface,
  PresenceUpdate,
  UserPresenceInfo,
} from "./presence";
export {
  getOrganizationPresence,
  getVideoPresence,
  Presence,
  PresenceLive,
  updatePresence,
} from "./presence";
// Recommendations Service
export type {
  ContinueWatchingItem,
  RecommendationOptions,
  RecommendationsServiceInterface,
  TrendingVideo,
} from "./recommendations";
export {
  getContinueWatching,
  getRecommendations,
  getSimilarVideos,
  getTrending,
  Recommendations,
  RecommendationsLive,
} from "./recommendations";
// Replicate API Service
export type {
  ReplicateService,
  ThumbnailResult,
  TranscriptionResult as ReplicateTranscriptionResult,
  VideoMetadata as ReplicateVideoMetadata,
} from "./replicate";
export {
  extractMetadata,
  generateThumbnail,
  generateThumbnails,
  ReplicateAPI,
  ReplicateLive,
  transcribe,
} from "./replicate";
// Search Repository
export type {
  CreateSavedSearchInput,
  CreateSearchHistoryInput,
  SearchParams,
  SearchRepositoryService,
  UpdateSavedSearchInput,
} from "./search-repository";
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
} from "./search-repository";
export type { CreateSeriesInput, SeriesRepositoryService, UpdateSeriesInput } from "./series-repository";
// Series Repository
export {
  addVideoToSeries,
  createSeries,
  deleteSeries,
  getAvailableVideosForSeries,
  getSeries,
  getSeriesProgress,
  getSeriesWithProgress,
  getSeriesWithVideos,
  markSeriesVideoCompleted,
  removeVideoFromSeries,
  reorderSeriesVideos,
  SeriesRepository,
  SeriesRepositoryLive,
  updateSeries,
  updateSeriesProgress,
} from "./series-repository";
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
} from "./slack";
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
} from "./slack";
// Slack Monitoring Service
export type {
  MonitoringEvent,
  MonitoringEventType,
  SlackMonitoringServiceInterface,
} from "./slack-monitoring";
export {
  notifySlackMonitoring,
  SlackMonitoring,
  SlackMonitoringLive,
  sendSlackAccountEvent,
  sendSlackBillingEvent,
  sendSlackErrorEvent,
  sendSlackMonitoringEvent,
  sendSlackVideoEvent,
} from "./slack-monitoring";
// Speaker Diarization Service
export type {
  DiarizationOptions,
  DiarizationResult,
  DiarizedSegment,
  SpeakerDiarizationServiceInterface,
  SpeakerSummary,
} from "./speaker-diarization";
export {
  calculateBalanceScore,
  DiarizationError,
  DiarizationNotConfiguredError,
  diarizeFromUrl,
  isDiarizationAvailable,
  SpeakerDiarization,
  SpeakerDiarizationLive,
} from "./speaker-diarization";
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
} from "./speaker-repository";
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
} from "./speaker-repository";
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
export type { StripeService } from "./stripe";
export { getStripe, StripeServiceLive, StripeServiceTag } from "./stripe";
export type { TranscriptionResult, TranscriptionServiceInterface } from "./transcription";
// Transcription Service
export {
  AudioExtractionError,
  isTranscriptionAvailable,
  Transcription,
  TranscriptionError,
  TranscriptionLive,
  transcribeAudio,
  transcribeFromUrl,
} from "./transcription";
// Translation Service
export type {
  LanguageInfo,
  SupportedLanguage,
  TranslatedTranscript,
  TranslationOptions,
  TranslationResult,
  TranslationServiceInterface,
} from "./translation";
export {
  getSupportedLanguages,
  isTranslationAvailable,
  SUPPORTED_LANGUAGES,
  Translation,
  TranslationApiError,
  TranslationLive,
  TranslationNotConfiguredError,
  translateText,
  translateTranscript,
  UnsupportedLanguageError,
} from "./translation";
export type { AIProcessingResult, VideoAIProcessorServiceInterface } from "./video-ai-processor";
// Video AI Processor Service
export {
  getVideoProcessingStatus,
  processFromTranscript,
  processVideoAI,
  updateVideoProcessingStatus,
  VideoAIProcessingError,
  VideoAIProcessor,
  VideoAIProcessorLive,
} from "./video-ai-processor";
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
export type {
  SaveProgressInput,
  VideoProgressData,
  VideoProgressRepositoryService,
} from "./video-progress-repository";
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
} from "./video-progress-repository";
export type { CreateVideoInput, UpdateVideoInput, VideoRepositoryService } from "./video-repository";
// Video Repository
export {
  createVideo,
  deleteVideo,
  deleteVideoRecord,
  getVideo,
  getVideoChapters,
  getVideoCodeSnippets,
  getVideos,
  updateVideo,
  VideoRepository,
  VideoRepositoryLive,
} from "./video-repository";
// Watch Later Service
export type {
  AddToWatchLaterInput,
  UpdateWatchLaterInput,
  WatchLaterItem,
  WatchLaterServiceInterface,
} from "./watch-later";
export {
  addToWatchLater,
  getWatchLaterList,
  isInWatchLater,
  removeFromWatchLater,
  WatchLaterService,
  WatchLaterServiceLive,
} from "./watch-later";
// Zapier Webhooks Service
export type {
  CreateWebhookInput,
  UpdateWebhookInput,
  WebhookDeliveryResult,
  WebhookPayload,
  WebhookWithStats,
  ZapierWebhooksServiceInterface,
} from "./zapier-webhooks";
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
} from "./zapier-webhooks";
// Zoom Service
export type {
  ZoomConfig,
  ZoomMeeting,
  ZoomRecording,
  ZoomRecordingsResponse,
  ZoomServiceInterface,
  ZoomTokenResponse,
  ZoomUserInfo,
} from "./zoom";
export {
  exchangeZoomCodeForToken,
  getZoomAuthorizationUrl,
  getZoomMeetingRecordings,
  getZoomUserInfo,
  listZoomRecordings,
  refreshZoomAccessToken,
  Zoom,
  ZoomLive,
} from "./zoom";
