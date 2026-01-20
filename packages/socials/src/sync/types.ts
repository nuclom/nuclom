/**
 * Sync configuration for storing social media data in git
 */
export interface SyncConfig {
  /** Directory to store synced data (relative to git root) */
  outputDir: string;
  /** Whether to include full metadata or just essential fields */
  includeMetadata: boolean;
}

/**
 * Synced tweet data stored in the repository
 */
export interface SyncedTweet {
  id: string;
  text: string;
  createdAt: string;
  url: string;
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
  };
  inReplyToId: string | null;
  quotedId: string | null;
}

/**
 * Synced profile data stored in the repository
 */
export interface SyncedProfile {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  metrics: {
    followers: number;
    following: number;
    tweets: number;
  };
  url: string;
  lastSynced: string;
}

/**
 * Complete sync state for a provider
 */
export interface SyncState {
  provider: string;
  lastSyncedAt: string;
  profile: SyncedProfile;
  tweets: SyncedTweet[];
}

/**
 * Default sync configuration
 */
export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  outputDir: '.nuclom/socials',
  includeMetadata: false,
};
