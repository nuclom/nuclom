import type {
  Channel,
  Collection,
  Comment,
  Member,
  Organization,
  SavedSearch,
  SearchFilters,
  SearchHistory,
  User,
  Video,
} from "./db/schema";

// Omit searchVector from video types as it's only used for internal database queries
type VideoBase = Omit<Video, "searchVector">;

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
