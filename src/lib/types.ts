import type {
  Channel,
  Collection,
  Decision,
  DecisionLink,
  DecisionParticipant,
  Member,
  Organization,
  SavedSearch,
  SearchFilters,
  SearchHistory,
  SeriesProgress,
  SeriesVideo,
  User,
  Video,
} from './db/schema';

// Omit internal fields from video types (searchVector, soft-delete fields)
type VideoBase = Omit<Video, 'searchVector' | 'deletedAt' | 'retentionUntil'>;

export type VideoWithAuthor = VideoBase & {
  author: User;
};

export type VideoWithDetails = VideoBase & {
  author: User;
  organization: Organization;
  channel?: Channel | null;
  collection?: Collection | null;
};

export type OrganizationWithMembers = Organization & {
  members: (Member & { user: User })[];
};

export type ChannelWithVideos = Channel & {
  videos: VideoWithAuthor[];
};

// Search types
export type SearchResult = {
  video: VideoWithAuthor;
  rank: number;
  highlights?: {
    title?: string;
    description?: string;
    transcript?: string;
  };
};

export type SearchResponse = {
  results: SearchResult[];
  total: number;
  query: string;
  filters?: SearchFilters;
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type SearchSuggestion = {
  type: 'recent' | 'popular' | 'video';
  text: string;
  videoId?: string;
  count?: number;
};

export type SearchHistoryWithUser = SearchHistory & {
  user: User;
};

export type SavedSearchWithUser = SavedSearch & {
  user: User;
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
  | { type: 'offset'; page: number; limit: number }
  | { type: 'cursor'; cursor?: string; limit: number; direction?: 'forward' | 'backward' };

// =============================================================================
// Knowledge Graph Decision Types
// =============================================================================

/**
 * Decision with participant users (for knowledge graph)
 */
export type DecisionWithParticipants = Decision & {
  participants: (DecisionParticipant & { user?: User | null })[];
};

/**
 * Decision with full details including participants, links, and related data
 */
export type DecisionWithDetails = Decision & {
  participants: (DecisionParticipant & { user?: User | null })[];
  links: DecisionLink[];
  video?: Video | null;
};

/**
 * Decision with summary info for list views
 */
export type DecisionWithSummary = Decision & {
  participants: (DecisionParticipant & { user?: User | null })[];
  video?: Video | null;
  participantCount: number;
};
