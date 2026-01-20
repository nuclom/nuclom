import type { Effect } from 'effect';
import type { AnySocialError } from './errors.ts';

/**
 * Base profile information that all social providers should support
 */
export interface Profile {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  url: string;
  createdAt: Date;
  metadata: Record<string, unknown>;
}

/**
 * Profile update payload
 */
export interface ProfileUpdate {
  displayName?: string;
  bio?: string;
  avatarPath?: string;
  bannerPath?: string;
  metadata?: Record<string, unknown>;
}

/**
 * A post on a social platform (tweet, toot, etc.)
 */
export interface Post {
  id: string;
  text: string;
  authorId: string;
  authorUsername: string;
  createdAt: Date;
  likesCount: number;
  repostsCount: number;
  repliesCount: number;
  url: string;
  inReplyToId: string | null;
  quotedPostId: string | null;
  mediaUrls: string[];
  metadata: Record<string, unknown>;
}

/**
 * Options for creating a new post
 */
export interface CreatePostOptions {
  text: string;
  replyToId?: string;
  quoteId?: string;
  mediaPaths?: string[];
}

/**
 * A mention or notification from the platform
 */
export interface Mention {
  id: string;
  type: 'mention' | 'reply' | 'quote' | 'repost' | 'like' | 'follow';
  post: Post | null;
  fromUser: {
    id: string;
    username: string;
    displayName: string;
  };
  createdAt: Date;
  metadata: Record<string, unknown>;
}

/**
 * Options for fetching posts
 */
export interface FetchPostsOptions {
  limit?: number;
  sinceId?: string;
  maxId?: string;
}

/**
 * Options for fetching mentions
 */
export interface FetchMentionsOptions {
  limit?: number;
  sinceId?: string;
}

/**
 * Provider credentials configuration
 */
export interface ProviderCredentials {
  provider: string;
  [key: string]: unknown;
}

/**
 * Social media provider interface
 * All providers must implement this interface
 */
export interface SocialProvider {
  readonly name: string;
  readonly displayName: string;

  /**
   * Initialize the provider with credentials
   */
  initialize(credentials: ProviderCredentials): Effect.Effect<void, AnySocialError>;

  /**
   * Check if the provider is authenticated and ready
   */
  isAuthenticated(): Effect.Effect<boolean, AnySocialError>;

  /**
   * Get the authenticated user's profile
   */
  getProfile(): Effect.Effect<Profile, AnySocialError>;

  /**
   * Update the authenticated user's profile
   */
  updateProfile(update: ProfileUpdate): Effect.Effect<Profile, AnySocialError>;

  /**
   * Create a new post
   */
  createPost(options: CreatePostOptions): Effect.Effect<Post, AnySocialError>;

  /**
   * Delete a post by ID
   */
  deletePost(postId: string): Effect.Effect<void, AnySocialError>;

  /**
   * Get a post by ID
   */
  getPost(postId: string): Effect.Effect<Post, AnySocialError>;

  /**
   * Get the authenticated user's posts
   */
  getPosts(options?: FetchPostsOptions): Effect.Effect<Post[], AnySocialError>;

  /**
   * Get mentions/notifications for the authenticated user
   */
  getMentions(options?: FetchMentionsOptions): Effect.Effect<Mention[], AnySocialError>;

  /**
   * Reply to a post
   */
  reply(postId: string, text: string): Effect.Effect<Post, AnySocialError>;

  /**
   * Like a post
   */
  like(postId: string): Effect.Effect<void, AnySocialError>;

  /**
   * Unlike a post
   */
  unlike(postId: string): Effect.Effect<void, AnySocialError>;

  /**
   * Repost/retweet a post
   */
  repost(postId: string): Effect.Effect<void, AnySocialError>;

  /**
   * Undo a repost
   */
  unrepost(postId: string): Effect.Effect<void, AnySocialError>;
}
