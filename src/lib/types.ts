import type {
  Channel,
  Collection,
  Comment,
  Decision,
  DecisionEdit,
  DecisionLink,
  DecisionParticipant,
  DecisionSubscription,
  DecisionTag,
  DecisionTagAssignment,
  Member,
  Organization,
  SavedSearch,
  SearchFilters,
  SearchHistory,
  SeriesProgress,
  SeriesVideo,
  User,
  Video,
} from "./db/schema";

// Omit internal fields from video types (searchVector, soft-delete fields)
type VideoBase = Omit<Video, "searchVector" | "deletedAt" | "retentionUntil">;

export type VideoWithAuthor = VideoBase & {
  author: User;
};

export type VideoWithDetails = VideoBase & {
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
  type: "recent" | "popular" | "video";
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
  | { type: "offset"; page: number; limit: number }
  | { type: "cursor"; cursor?: string; limit: number; direction?: "forward" | "backward" };

// =============================================================================
// Decision Registry Types
// =============================================================================

// Omit internal fields from decision types
type DecisionBase = Omit<Decision, "searchVector">;

/**
 * Decision with participant users
 */
export type DecisionWithParticipants = DecisionBase & {
  participants: (DecisionParticipant & { user: User })[];
};

/**
 * Decision tag with assignment details
 */
export type DecisionTagWithAssignment = DecisionTag & {
  assignment?: DecisionTagAssignment;
};

/**
 * Decision with full details including participants, tags, links, and related data
 */
export type DecisionWithDetails = DecisionBase & {
  participants: (DecisionParticipant & { user: User })[];
  tagAssignments: (DecisionTagAssignment & { tag: DecisionTag })[];
  links: DecisionLink[];
  video?: Video | null;
  createdBy?: User | null;
  supersededBy?: Decision | null;
  edits?: DecisionEdit[];
};

/**
 * Decision with summary info for list views
 */
export type DecisionWithSummary = DecisionBase & {
  participants: (DecisionParticipant & { user: User })[];
  tagAssignments: (DecisionTagAssignment & { tag: DecisionTag })[];
  video?: Video | null;
  createdBy?: User | null;
  participantCount: number;
  tagCount: number;
};

/**
 * Decision filters for querying
 */
export type DecisionFilters = {
  readonly topics?: string[];
  readonly participants?: string[];
  readonly status?: "decided" | "proposed" | "superseded";
  readonly source?: "meeting" | "adhoc" | "manual";
  readonly from?: Date;
  readonly to?: Date;
  readonly search?: string;
  readonly videoId?: string;
};

/**
 * Decision search result with relevance info
 */
export type DecisionSearchResult = {
  decision: DecisionWithSummary;
  rank?: number;
  highlights?: {
    summary?: string;
    context?: string;
  };
};

/**
 * Decision subscription with user details
 */
export type DecisionSubscriptionWithUser = DecisionSubscription & {
  user: User;
};

/**
 * Decision edit with user details
 */
export type DecisionEditWithUser = DecisionEdit & {
  user: User;
};

/**
 * Decision export format options
 */
export type DecisionExportFormat = "markdown" | "json" | "csv";

/**
 * Decision export options
 */
export type DecisionExportOptions = {
  readonly format: DecisionExportFormat;
  readonly includeContext?: boolean;
  readonly includeParticipants?: boolean;
  readonly includeTags?: boolean;
  readonly includeLinks?: boolean;
  readonly filters?: DecisionFilters;
};
