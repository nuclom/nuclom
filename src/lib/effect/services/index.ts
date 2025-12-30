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
