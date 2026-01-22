/**
 * Video Repository Types
 *
 * Type definitions for the video repository service.
 */

import type { Effect } from 'effect';
import type {
  ActionItem,
  ProcessingStatus,
  TranscriptSegment,
  VideoVisibility,
  videoChapters,
  videos,
} from '../../db/schema';
import type { PaginatedResponse, VideoWithAuthor, VideoWithDetails } from '../../types';
import type { DatabaseError, DeleteError, NotFoundError } from '../errors';

// =============================================================================
// Input Types
// =============================================================================

export interface CreateVideoInput {
  readonly title: string;
  readonly description?: string;
  readonly duration: string;
  readonly thumbnailUrl?: string;
  readonly videoUrl?: string;
  readonly authorId: string;
  readonly organizationId: string;
  readonly visibility?: VideoVisibility;
  readonly transcript?: string;
  readonly transcriptSegments?: TranscriptSegment[];
  readonly processingStatus?: ProcessingStatus;
  readonly aiSummary?: string;
  readonly aiTags?: string[];
  readonly aiActionItems?: ActionItem[];
}

export interface UpdateVideoInput {
  readonly title?: string;
  readonly description?: string | null;
  readonly duration?: string;
  readonly thumbnailUrl?: string | null;
  readonly videoUrl?: string | null;
  readonly visibility?: VideoVisibility;
  readonly transcript?: string | null;
  readonly transcriptSegments?: TranscriptSegment[] | null;
  readonly processingStatus?: ProcessingStatus;
  readonly processingError?: string | null;
  readonly aiSummary?: string | null;
  readonly aiTags?: string[] | null;
  readonly aiActionItems?: ActionItem[] | null;
  readonly deletedAt?: Date | null;
  readonly retentionUntil?: Date | null;
}

export interface SoftDeleteOptions {
  /** Number of days to retain the video before permanent deletion. Default is 30 days. */
  readonly retentionDays?: number;
}

export interface VideoSearchInput {
  readonly query: string;
  readonly organizationId: string;
  readonly authorId?: string;
  readonly dateFrom?: Date;
  readonly dateTo?: Date;
  readonly page?: number;
  readonly limit?: number;
}

// =============================================================================
// Service Interface
// =============================================================================

export interface VideoRepositoryService {
  /**
   * Get paginated videos for an organization (excludes soft-deleted videos)
   */
  readonly getVideos: (
    organizationId: string,
    page?: number,
    limit?: number,
  ) => Effect.Effect<PaginatedResponse<VideoWithAuthor>, DatabaseError>;

  /**
   * Get paginated deleted videos for an organization (only soft-deleted videos)
   */
  readonly getDeletedVideos: (
    organizationId: string,
    page?: number,
    limit?: number,
  ) => Effect.Effect<PaginatedResponse<VideoWithAuthor>, DatabaseError>;

  /**
   * Get a single video with full details
   */
  readonly getVideo: (id: string) => Effect.Effect<VideoWithDetails, DatabaseError | NotFoundError>;

  /**
   * Create a new video
   */
  readonly createVideo: (data: CreateVideoInput) => Effect.Effect<typeof videos.$inferSelect, DatabaseError>;

  /**
   * Update a video
   */
  readonly updateVideo: (
    id: string,
    data: UpdateVideoInput,
  ) => Effect.Effect<typeof videos.$inferSelect, DatabaseError | NotFoundError>;

  /**
   * Soft delete a video (marks as deleted with retention period)
   */
  readonly softDeleteVideo: (
    id: string,
    options?: SoftDeleteOptions,
  ) => Effect.Effect<typeof videos.$inferSelect, DatabaseError | NotFoundError>;

  /**
   * Restore a soft-deleted video
   */
  readonly restoreVideo: (id: string) => Effect.Effect<typeof videos.$inferSelect, DatabaseError | NotFoundError>;

  /**
   * Permanently delete a video and clean up R2 storage
   */
  readonly deleteVideo: (id: string) => Effect.Effect<void, DatabaseError | NotFoundError | DeleteError>;

  /**
   * Permanently delete all videos past their retention period
   */
  readonly cleanupExpiredVideos: () => Effect.Effect<number, DatabaseError | DeleteError>;

  /**
   * Get video chapters
   */
  readonly getVideoChapters: (videoId: string) => Effect.Effect<(typeof videoChapters.$inferSelect)[], DatabaseError>;

  /**
   * Search videos with full-text search and filters
   */
  readonly searchVideos: (input: VideoSearchInput) => Effect.Effect<PaginatedResponse<VideoWithAuthor>, DatabaseError>;

  /**
   * Get paginated videos by author (user's own videos)
   */
  readonly getVideosByAuthor: (
    authorId: string,
    organizationId: string,
    page?: number,
    limit?: number,
  ) => Effect.Effect<PaginatedResponse<VideoWithAuthor>, DatabaseError>;

  /**
   * Get paginated videos shared by others in the organization (not authored by the current user)
   */
  readonly getVideosSharedByOthers: (
    userId: string,
    organizationId: string,
    page?: number,
    limit?: number,
  ) => Effect.Effect<PaginatedResponse<VideoWithAuthor>, DatabaseError>;

  /**
   * Check if a user can access a specific video based on visibility and sharing rules.
   * Returns the access level if allowed, or null if not allowed.
   *
   * Access rules:
   * - 'public' videos: Anyone can view
   * - 'organization' videos: Any organization member can view
   * - 'private' videos: Only author or explicitly shared users/team members
   */
  readonly canAccessVideo: (
    videoId: string,
    userId: string | null,
  ) => Effect.Effect<{ canAccess: boolean; accessLevel: 'view' | 'comment' | 'download' | null }, DatabaseError>;

  /**
   * Get accessible videos for a user considering visibility rules.
   * Includes:
   * - Videos authored by the user (any visibility)
   * - Organization videos (if user is a member)
   * - Private videos explicitly shared with the user or their teams
   * - Public videos (optional, controlled by includePublic parameter)
   */
  readonly getAccessibleVideos: (
    userId: string,
    organizationId: string,
    options?: {
      includeOwn?: boolean;
      includeOrganization?: boolean;
      includeSharedWithMe?: boolean;
      includePublic?: boolean;
      page?: number;
      limit?: number;
    },
  ) => Effect.Effect<PaginatedResponse<VideoWithAuthor>, DatabaseError>;
}
