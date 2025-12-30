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
