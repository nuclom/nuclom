import type {
  Channel,
  Collection,
  Comment,
  Member,
  Organization,
  SeriesProgress,
  SeriesVideo,
  User,
  Video,
} from "./db/schema";

export type VideoWithAuthor = Video & {
  author: User;
};

export type VideoWithDetails = Video & {
  author: User;
  organization: Organization;
  channel?: Channel | null;
  collection?: Collection | null;
  comments: (Comment & { author: User })[];
};

export type OrganizationWithMembers = Organization & {
  members: (Member & { user: User })[];
};

export type ChannelWithVideos = Channel & {
  videos: VideoWithAuthor[];
};

// Series types
export type SeriesWithVideoCount = Collection & {
  videoCount: number;
  createdBy?: User | null;
};

export type SeriesVideoWithDetails = SeriesVideo & {
  video: VideoWithAuthor;
};

export type SeriesWithVideos = Collection & {
  createdBy?: User | null;
  videos: SeriesVideoWithDetails[];
  videoCount: number;
};

export type SeriesProgressWithDetails = SeriesProgress & {
  series: Collection;
  lastVideo?: Video | null;
  completedCount: number;
  totalCount: number;
  progressPercentage: number;
};

// API Response types
export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

/**
 * Cursor-based pagination response for large datasets
 * More efficient than offset-based pagination for large tables
 */
export type CursorPaginatedResponse<T> = {
  data: T[];
  pagination: {
    limit: number;
    /** Cursor for next page (null if no more pages) */
    nextCursor: string | null;
    /** Cursor for previous page (null if on first page) */
    prevCursor: string | null;
    /** Whether there are more results */
    hasMore: boolean;
  };
};

/**
 * Unified pagination parameters
 */
export type PaginationParams =
  | { type: "offset"; page: number; limit: number }
  | { type: "cursor"; cursor?: string; limit: number; direction?: "forward" | "backward" };
