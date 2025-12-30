/**
 * Effect Services - Central Export
 *
 * All Effect-TS services are exported from this file.
 */

export type { AIServiceInterface, VideoSummary, ChapterResult, CodeSnippetResult, ActionItemResult } from "./ai";
// AI Service
export {
  AI,
  AILive,
  createSummaryStream,
  extractActionItems,
  extractActionItemsWithTimestamps,
  detectCodeSnippets,
  generateChapters,
  generateVideoSummary,
  generateVideoTags,
} from "./ai";

// Transcription Service
export {
  Transcription,
  TranscriptionLive,
  transcribeFromUrl,
  transcribeAudio,
  isTranscriptionAvailable,
  TranscriptionError,
  AudioExtractionError,
} from "./transcription";
export type { TranscriptionResult, TranscriptionServiceInterface } from "./transcription";

// Video AI Processor Service
export {
  VideoAIProcessor,
  VideoAIProcessorLive,
  processVideoAI,
  processFromTranscript,
  updateVideoProcessingStatus,
  getVideoProcessingStatus,
  VideoAIProcessingError,
} from "./video-ai-processor";
export type { AIProcessingResult, VideoAIProcessorServiceInterface } from "./video-ai-processor";

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
export type { VideoRepositoryService, CreateVideoInput, UpdateVideoInput } from "./video-repository";
// Video Repository
export {
  createVideo,
  deleteVideo,
  deleteVideoRecord,
  getVideo,
  getVideos,
  getVideoChapters,
  getVideoCodeSnippets,
  updateVideo,
  VideoRepository,
  VideoRepositoryLive,
} from "./video-repository";
