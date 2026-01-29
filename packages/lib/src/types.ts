import type {
  Collection,
  CollectionProgress,
  CollectionVideo,
  Member,
  Organization,
  SavedSearch,
  SearchFilters,
  SearchHistory,
  User,
  Video,
} from './db/schema';

// Omit internal fields from video types
type VideoBase = Omit<Video, 'searchVector' | 'deletedAt' | 'retentionUntil'>;

export type VideoWithAuthor = VideoBase & {
  author: User;
};

export type VideoWithDetails = VideoBase & {
  author: User;
  organization: Organization;
  collections?: CollectionWithVideoCount[];
};

export type OrganizationWithMembers = Organization & {
  members: (Member & { user: User })[];
};

// =============================================================================
// Collection Types
// =============================================================================

export type CollectionWithVideoCount = Collection & {
  videoCount: number;
  createdBy?: User | null;
};

export type CollectionVideoWithDetails = CollectionVideo & {
  video: VideoWithAuthor;
};

export type CollectionWithVideos = Collection & {
  createdBy?: User | null;
  videos: CollectionVideoWithDetails[];
  videoCount: number;
};

export type CollectionProgressWithDetails = CollectionProgress & {
  collection: Collection;
  lastVideo?: Video | null;
  completedCount: number;
  totalCount: number;
  progressPercentage: number;
};

export type CollectionWithProgress = CollectionWithVideoCount & {
  progress?: CollectionProgressWithDetails;
};

// =============================================================================
// Search Types
// =============================================================================

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

// =============================================================================
// API Response Types
// =============================================================================

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
