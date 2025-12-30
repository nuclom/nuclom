import type { Channel, Collection, Comment, User, Video, Organization, Member } from "./db/schema";

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
