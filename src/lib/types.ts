import type {
  Channel,
  Collection,
  Comment,
  User,
  Video,
  Workspace,
  WorkspaceUser,
} from "./db/schema";

export type VideoWithAuthor = Video & {
  author: User;
};

export type VideoWithDetails = Video & {
  author: User;
  workspace: Workspace;
  channel?: Channel | null;
  collection?: Collection | null;
  comments: (Comment & { author: User })[];
};

export type WorkspaceWithUsers = Workspace & {
  users: (WorkspaceUser & { user: User })[];
};

export type ChannelWithVideos = Channel & {
  videos: VideoWithAuthor[];
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

// Form types for creating/updating entities
export type CreateVideoData = {
  title: string;
  description?: string;
  duration: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  channelId?: string;
  collectionId?: string;
};

export type UpdateVideoData = Partial<CreateVideoData>;

export type CreateWorkspaceData = {
  name: string;
  slug: string;
  description?: string;
};

export type CreateChannelData = {
  name: string;
  description?: string;
};

export type CreateCollectionData = {
  name: string;
  description?: string;
};

export type CreateCommentData = {
  content: string;
  timestamp?: string;
  parentId?: string;
};
