import { Effect } from 'effect';
import { TwitterApi, type TwitterApiReadWrite } from 'twitter-api-v2';
import {
  type AnySocialError,
  AuthenticationError,
  ConfigurationError,
  NetworkError,
  NotFoundError,
  NotInitializedError,
  RateLimitError,
  ValidationError,
} from '../../types/errors.ts';
import type {
  CreatePostOptions,
  FetchMentionsOptions,
  FetchPostsOptions,
  Mention,
  Post,
  Profile,
  ProfileUpdate,
  ProviderCredentials,
  SocialProvider,
} from '../../types/provider.ts';

const PROVIDER_NAME = 'twitter';

/**
 * Twitter-specific credentials
 */
export interface TwitterCredentials extends ProviderCredentials {
  provider: 'twitter';
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
}

/**
 * Validate Twitter credentials
 */
function validateCredentials(credentials: ProviderCredentials): credentials is TwitterCredentials {
  return (
    credentials.provider === 'twitter' &&
    typeof credentials['apiKey'] === 'string' &&
    typeof credentials['apiSecret'] === 'string' &&
    typeof credentials['accessToken'] === 'string' &&
    typeof credentials['accessSecret'] === 'string'
  );
}

/**
 * Map Twitter API errors to our error types
 */
function mapTwitterError(error: unknown): AnySocialError {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('rate limit') || message.includes('429')) {
      return new RateLimitError({
        message: 'Twitter API rate limit exceeded',
        provider: PROVIDER_NAME,
        cause: error,
      });
    }

    if (message.includes('unauthorized') || message.includes('401') || message.includes('forbidden')) {
      return new AuthenticationError({
        message: 'Twitter authentication failed',
        provider: PROVIDER_NAME,
        cause: error,
      });
    }

    if (message.includes('not found') || message.includes('404')) {
      return new NotFoundError({
        message: 'Resource not found on Twitter',
        provider: PROVIDER_NAME,
        resourceType: 'unknown',
        resourceId: 'unknown',
        cause: error,
      });
    }

    return new NetworkError({
      message: error.message,
      provider: PROVIDER_NAME,
      cause: error,
    });
  }

  return new NetworkError({
    message: 'Unknown Twitter API error',
    provider: PROVIDER_NAME,
    cause: error,
  });
}

/**
 * Twitter provider implementation
 */
export class TwitterProvider implements SocialProvider {
  readonly name = PROVIDER_NAME;
  readonly displayName = 'Twitter/X';

  private client: TwitterApiReadWrite | null = null;
  private userId: string | null = null;

  initialize(credentials: ProviderCredentials): Effect.Effect<void, AnySocialError> {
    return Effect.gen(this, function* () {
      if (!validateCredentials(credentials)) {
        return yield* Effect.fail(
          new ConfigurationError({
            message: 'Invalid Twitter credentials',
            provider: PROVIDER_NAME,
            missingFields: ['apiKey', 'apiSecret', 'accessToken', 'accessSecret'].filter(
              (f) => !(f in credentials) || typeof credentials[f] !== 'string',
            ),
          }),
        );
      }

      const twitterClient = new TwitterApi({
        appKey: credentials.apiKey,
        appSecret: credentials.apiSecret,
        accessToken: credentials.accessToken,
        accessSecret: credentials.accessSecret,
      });

      this.client = twitterClient.readWrite;

      // Verify credentials by fetching the authenticated user
      const me = yield* Effect.tryPromise({
        try: () => this.client!.v2.me(),
        catch: mapTwitterError,
      });

      this.userId = me.data.id;
    });
  }

  isAuthenticated(): Effect.Effect<boolean, AnySocialError> {
    return Effect.succeed(this.client !== null && this.userId !== null);
  }

  private ensureInitialized(): Effect.Effect<TwitterApiReadWrite, AnySocialError> {
    return Effect.gen(this, function* () {
      if (!this.client) {
        return yield* Effect.fail(
          new NotInitializedError({
            message: 'Twitter provider not initialized. Call initialize() first.',
            provider: PROVIDER_NAME,
          }),
        );
      }
      return this.client;
    });
  }

  getProfile(): Effect.Effect<Profile, AnySocialError> {
    return Effect.gen(this, function* () {
      const client = yield* this.ensureInitialized();

      const me = yield* Effect.tryPromise({
        try: () =>
          client.v2.me({
            'user.fields': [
              'id',
              'name',
              'username',
              'description',
              'profile_image_url',
              'public_metrics',
              'created_at',
              'url',
            ],
          }),
        catch: mapTwitterError,
      });

      const user = me.data;

      return {
        id: user.id,
        username: user.username,
        displayName: user.name,
        bio: user.description ?? null,
        avatarUrl: user.profile_image_url ?? null,
        bannerUrl: null, // Twitter v2 API doesn't return banner in this endpoint
        followersCount: user.public_metrics?.followers_count ?? 0,
        followingCount: user.public_metrics?.following_count ?? 0,
        postsCount: user.public_metrics?.tweet_count ?? 0,
        url: `https://twitter.com/${user.username}`,
        createdAt: user.created_at ? new Date(user.created_at) : new Date(),
        metadata: { raw: user },
      };
    });
  }

  updateProfile(update: ProfileUpdate): Effect.Effect<Profile, AnySocialError> {
    return Effect.gen(this, function* () {
      const client = yield* this.ensureInitialized();

      // Twitter API v1.1 is needed for profile updates
      const v1Client = client.v1;

      const updateParams: Record<string, string> = {};

      if (update.displayName) {
        updateParams['name'] = update.displayName;
      }

      if (update.bio) {
        updateParams['description'] = update.bio;
      }

      if (Object.keys(updateParams).length > 0) {
        yield* Effect.tryPromise({
          try: () => v1Client.updateAccountProfile(updateParams),
          catch: mapTwitterError,
        });
      }

      // Handle avatar upload
      if (update.avatarPath) {
        const avatarBuffer = yield* Effect.tryPromise({
          try: async () => {
            const file = Bun.file(update.avatarPath!);
            return Buffer.from(await file.arrayBuffer());
          },
          catch: (e) =>
            new ValidationError({
              message: `Failed to read avatar file: ${update.avatarPath}`,
              provider: PROVIDER_NAME,
              field: 'avatarPath',
              cause: e,
            }),
        });

        yield* Effect.tryPromise({
          try: () => v1Client.updateAccountProfileImage(avatarBuffer.toString('base64')),
          catch: mapTwitterError,
        });
      }

      // Handle banner upload
      if (update.bannerPath) {
        const bannerBuffer = yield* Effect.tryPromise({
          try: async () => {
            const file = Bun.file(update.bannerPath!);
            return Buffer.from(await file.arrayBuffer());
          },
          catch: (e) =>
            new ValidationError({
              message: `Failed to read banner file: ${update.bannerPath}`,
              provider: PROVIDER_NAME,
              field: 'bannerPath',
              cause: e,
            }),
        });

        yield* Effect.tryPromise({
          try: () => v1Client.updateAccountProfileBanner(bannerBuffer.toString('base64')),
          catch: mapTwitterError,
        });
      }

      // Return updated profile
      return yield* this.getProfile();
    });
  }

  createPost(options: CreatePostOptions): Effect.Effect<Post, AnySocialError> {
    return Effect.gen(this, function* () {
      const client = yield* this.ensureInitialized();

      if (!options.text || options.text.trim().length === 0) {
        return yield* Effect.fail(
          new ValidationError({
            message: 'Post text cannot be empty',
            provider: PROVIDER_NAME,
            field: 'text',
          }),
        );
      }

      if (options.text.length > 280) {
        return yield* Effect.fail(
          new ValidationError({
            message: 'Post text exceeds 280 character limit',
            provider: PROVIDER_NAME,
            field: 'text',
          }),
        );
      }

      // Upload media if provided
      let mediaIds: string[] | undefined;
      if (options.mediaPaths && options.mediaPaths.length > 0) {
        mediaIds = [];
        for (const mediaPath of options.mediaPaths) {
          const mediaId = yield* Effect.tryPromise({
            try: () => client.v1.uploadMedia(mediaPath),
            catch: mapTwitterError,
          });
          mediaIds.push(mediaId);
        }
      }

      const tweetParams: Parameters<typeof client.v2.tweet>[0] = {
        text: options.text,
      };

      if (options.replyToId) {
        tweetParams.reply = { in_reply_to_tweet_id: options.replyToId };
      }

      if (options.quoteId) {
        tweetParams.quote_tweet_id = options.quoteId;
      }

      if (mediaIds && mediaIds.length > 0) {
        // Twitter API supports 1-4 media items, cast to the expected tuple type
        const ids = mediaIds.slice(0, 4) as unknown as
          | [string]
          | [string, string]
          | [string, string, string]
          | [string, string, string, string];
        tweetParams.media = { media_ids: ids };
      }

      const result = yield* Effect.tryPromise({
        try: () => client.v2.tweet(tweetParams),
        catch: mapTwitterError,
      });

      // Fetch the full tweet details
      return yield* this.getPost(result.data.id);
    });
  }

  deletePost(postId: string): Effect.Effect<void, AnySocialError> {
    return Effect.gen(this, function* () {
      const client = yield* this.ensureInitialized();

      yield* Effect.tryPromise({
        try: () => client.v2.deleteTweet(postId),
        catch: mapTwitterError,
      });
    });
  }

  getPost(postId: string): Effect.Effect<Post, AnySocialError> {
    return Effect.gen(this, function* () {
      const client = yield* this.ensureInitialized();

      const result = yield* Effect.tryPromise({
        try: () =>
          client.v2.singleTweet(postId, {
            'tweet.fields': [
              'id',
              'text',
              'author_id',
              'created_at',
              'public_metrics',
              'in_reply_to_user_id',
              'referenced_tweets',
              'attachments',
            ],
            expansions: ['author_id', 'attachments.media_keys'],
            'user.fields': ['username'],
            'media.fields': ['url', 'preview_image_url'],
          }),
        catch: mapTwitterError,
      });

      const tweet = result.data;
      const author = result.includes?.users?.find((u) => u.id === tweet.author_id);
      const media = result.includes?.media ?? [];

      const replyToId = tweet.referenced_tweets?.find((r) => r.type === 'replied_to')?.id ?? null;
      const quotedId = tweet.referenced_tweets?.find((r) => r.type === 'quoted')?.id ?? null;

      return {
        id: tweet.id,
        text: tweet.text,
        authorId: tweet.author_id ?? '',
        authorUsername: author?.username ?? '',
        createdAt: tweet.created_at ? new Date(tweet.created_at) : new Date(),
        likesCount: tweet.public_metrics?.like_count ?? 0,
        repostsCount: tweet.public_metrics?.retweet_count ?? 0,
        repliesCount: tweet.public_metrics?.reply_count ?? 0,
        url: `https://twitter.com/${author?.username ?? 'i'}/status/${tweet.id}`,
        inReplyToId: replyToId,
        quotedPostId: quotedId,
        mediaUrls: media.map((m) => m.url ?? m.preview_image_url ?? '').filter(Boolean),
        metadata: { raw: tweet },
      };
    });
  }

  getPosts(options?: FetchPostsOptions): Effect.Effect<Post[], AnySocialError> {
    return Effect.gen(this, function* () {
      const client = yield* this.ensureInitialized();

      if (!this.userId) {
        return yield* Effect.fail(
          new NotInitializedError({
            message: 'User ID not available',
            provider: PROVIDER_NAME,
          }),
        );
      }

      const params: Parameters<typeof client.v2.userTimeline>[1] = {
        max_results: options?.limit ?? 10,
        'tweet.fields': ['id', 'text', 'author_id', 'created_at', 'public_metrics', 'referenced_tweets', 'attachments'],
        expansions: ['author_id', 'attachments.media_keys'],
        'user.fields': ['username'],
        'media.fields': ['url', 'preview_image_url'],
      };

      if (options?.sinceId) {
        params.since_id = options.sinceId;
      }

      if (options?.maxId) {
        params.until_id = options.maxId;
      }

      const result = yield* Effect.tryPromise({
        try: () => client.v2.userTimeline(this.userId!, params),
        catch: mapTwitterError,
      });

      const posts: Post[] = [];
      const users = result.includes?.users ?? [];
      const media = result.includes?.media ?? [];

      for (const tweet of result.data.data ?? []) {
        const author = users.find((u) => u.id === tweet.author_id);
        const tweetMedia = media.filter((m) => tweet.attachments?.media_keys?.includes(m.media_key));

        const replyToId = tweet.referenced_tweets?.find((r) => r.type === 'replied_to')?.id ?? null;
        const quotedId = tweet.referenced_tweets?.find((r) => r.type === 'quoted')?.id ?? null;

        posts.push({
          id: tweet.id,
          text: tweet.text,
          authorId: tweet.author_id ?? '',
          authorUsername: author?.username ?? '',
          createdAt: tweet.created_at ? new Date(tweet.created_at) : new Date(),
          likesCount: tweet.public_metrics?.like_count ?? 0,
          repostsCount: tweet.public_metrics?.retweet_count ?? 0,
          repliesCount: tweet.public_metrics?.reply_count ?? 0,
          url: `https://twitter.com/${author?.username ?? 'i'}/status/${tweet.id}`,
          inReplyToId: replyToId,
          quotedPostId: quotedId,
          mediaUrls: tweetMedia.map((m) => m.url ?? m.preview_image_url ?? '').filter(Boolean),
          metadata: { raw: tweet },
        });
      }

      return posts;
    });
  }

  getMentions(options?: FetchMentionsOptions): Effect.Effect<Mention[], AnySocialError> {
    return Effect.gen(this, function* () {
      const client = yield* this.ensureInitialized();

      if (!this.userId) {
        return yield* Effect.fail(
          new NotInitializedError({
            message: 'User ID not available',
            provider: PROVIDER_NAME,
          }),
        );
      }

      const params: Parameters<typeof client.v2.userMentionTimeline>[1] = {
        max_results: options?.limit ?? 10,
        'tweet.fields': ['id', 'text', 'author_id', 'created_at', 'public_metrics', 'referenced_tweets'],
        expansions: ['author_id'],
        'user.fields': ['id', 'username', 'name'],
      };

      if (options?.sinceId) {
        params.since_id = options.sinceId;
      }

      const result = yield* Effect.tryPromise({
        try: () => client.v2.userMentionTimeline(this.userId!, params),
        catch: mapTwitterError,
      });

      const mentions: Mention[] = [];
      const users = result.includes?.users ?? [];

      for (const tweet of result.data.data ?? []) {
        const author = users.find((u) => u.id === tweet.author_id);

        // Determine mention type
        let type: Mention['type'] = 'mention';
        if (tweet.referenced_tweets?.some((r) => r.type === 'replied_to')) {
          type = 'reply';
        } else if (tweet.referenced_tweets?.some((r) => r.type === 'quoted')) {
          type = 'quote';
        }

        mentions.push({
          id: tweet.id,
          type,
          post: {
            id: tweet.id,
            text: tweet.text,
            authorId: tweet.author_id ?? '',
            authorUsername: author?.username ?? '',
            createdAt: tweet.created_at ? new Date(tweet.created_at) : new Date(),
            likesCount: tweet.public_metrics?.like_count ?? 0,
            repostsCount: tweet.public_metrics?.retweet_count ?? 0,
            repliesCount: tweet.public_metrics?.reply_count ?? 0,
            url: `https://twitter.com/${author?.username ?? 'i'}/status/${tweet.id}`,
            inReplyToId: tweet.referenced_tweets?.find((r) => r.type === 'replied_to')?.id ?? null,
            quotedPostId: tweet.referenced_tweets?.find((r) => r.type === 'quoted')?.id ?? null,
            mediaUrls: [],
            metadata: { raw: tweet },
          },
          fromUser: {
            id: author?.id ?? '',
            username: author?.username ?? '',
            displayName: author?.name ?? '',
          },
          createdAt: tweet.created_at ? new Date(tweet.created_at) : new Date(),
          metadata: { raw: tweet },
        });
      }

      return mentions;
    });
  }

  reply(postId: string, text: string): Effect.Effect<Post, AnySocialError> {
    return this.createPost({ text, replyToId: postId });
  }

  like(postId: string): Effect.Effect<void, AnySocialError> {
    return Effect.gen(this, function* () {
      const client = yield* this.ensureInitialized();

      if (!this.userId) {
        return yield* Effect.fail(
          new NotInitializedError({
            message: 'User ID not available',
            provider: PROVIDER_NAME,
          }),
        );
      }

      yield* Effect.tryPromise({
        try: () => client.v2.like(this.userId!, postId),
        catch: mapTwitterError,
      });
    });
  }

  unlike(postId: string): Effect.Effect<void, AnySocialError> {
    return Effect.gen(this, function* () {
      const client = yield* this.ensureInitialized();

      if (!this.userId) {
        return yield* Effect.fail(
          new NotInitializedError({
            message: 'User ID not available',
            provider: PROVIDER_NAME,
          }),
        );
      }

      yield* Effect.tryPromise({
        try: () => client.v2.unlike(this.userId!, postId),
        catch: mapTwitterError,
      });
    });
  }

  repost(postId: string): Effect.Effect<void, AnySocialError> {
    return Effect.gen(this, function* () {
      const client = yield* this.ensureInitialized();

      if (!this.userId) {
        return yield* Effect.fail(
          new NotInitializedError({
            message: 'User ID not available',
            provider: PROVIDER_NAME,
          }),
        );
      }

      yield* Effect.tryPromise({
        try: () => client.v2.retweet(this.userId!, postId),
        catch: mapTwitterError,
      });
    });
  }

  unrepost(postId: string): Effect.Effect<void, AnySocialError> {
    return Effect.gen(this, function* () {
      const client = yield* this.ensureInitialized();

      if (!this.userId) {
        return yield* Effect.fail(
          new NotInitializedError({
            message: 'User ID not available',
            provider: PROVIDER_NAME,
          }),
        );
      }

      yield* Effect.tryPromise({
        try: () => client.v2.unretweet(this.userId!, postId),
        catch: mapTwitterError,
      });
    });
  }
}

/**
 * Create a new Twitter provider instance
 */
export function createTwitterProvider(): TwitterProvider {
  return new TwitterProvider();
}
