/**
 * Effect Services - Central Export
 *
 * All Effect-TS services are exported from this file.
 */

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

// Zoom Service
export type {
  ZoomConfig,
  ZoomTokenResponse,
  ZoomUserInfo,
  ZoomRecording,
  ZoomRecordingsResponse,
  ZoomMeeting,
  ZoomServiceInterface,
} from "./zoom";
export {
  Zoom,
  ZoomLive,
  getZoomAuthorizationUrl,
  exchangeZoomCodeForToken,
  refreshZoomAccessToken,
  getZoomUserInfo,
  listZoomRecordings,
  getZoomMeetingRecordings,
} from "./zoom";

// Google Meet Service
export type {
  GoogleConfig,
  GoogleTokenResponse,
  GoogleUserInfo,
  GoogleMeetRecording,
  GoogleDriveFilesResponse,
  GoogleMeetServiceInterface,
} from "./google-meet";
export {
  GoogleMeet,
  GoogleMeetLive,
  getGoogleAuthorizationUrl,
  exchangeGoogleCodeForToken,
  refreshGoogleAccessToken,
  getGoogleUserInfo,
  listGoogleMeetRecordings,
  downloadGoogleFile,
} from "./google-meet";

// Integration Repository
export type {
  CreateIntegrationInput,
  UpdateIntegrationInput,
  CreateImportedMeetingInput,
  UpdateImportedMeetingInput,
  IntegrationWithUser,
  ImportedMeetingWithVideo,
  IntegrationRepositoryService,
} from "./integration-repository";
export {
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
} from "./integration-repository";

// Search Repository
export type {
  SearchParams,
  CreateSearchHistoryInput,
  CreateSavedSearchInput,
  UpdateSavedSearchInput,
  SearchRepositoryService,
} from "./search-repository";
export {
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
} from "./search-repository";
