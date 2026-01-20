import { format } from 'date-fns';
import { Console, Effect } from 'effect';
import type { TwitterCredentials } from '../../providers/twitter/index.ts';
import { SocialsManagerTag, SyncServiceTag } from '../../services/index.ts';

/**
 * Format helpers for terminal output
 */
const bold = (text: string) => `\x1b[1m${text}\x1b[0m`;
const cyan = (text: string) => `\x1b[36m${text}\x1b[0m`;
const green = (text: string) => `\x1b[32m${text}\x1b[0m`;
const yellow = (text: string) => `\x1b[33m${text}\x1b[0m`;
const red = (text: string) => `\x1b[31m${text}\x1b[0m`;
const gray = (text: string) => `\x1b[90m${text}\x1b[0m`;

/**
 * Handle auth command
 */
export const handleAuth = (options: {
  apiKey: string | undefined;
  apiSecret: string | undefined;
  accessToken: string | undefined;
  accessSecret: string | undefined;
  interactive: boolean;
}) =>
  Effect.gen(function* () {
    const manager = yield* SocialsManagerTag;
    let credentials: TwitterCredentials;

    if (options.interactive) {
      yield* Console.log(cyan('Configure Twitter API credentials'));
      yield* Console.log(gray('Get these from https://developer.twitter.com/en/portal/dashboard\n'));

      const apiKey = prompt('API Key: ') ?? '';
      const apiSecret = prompt('API Secret: ') ?? '';
      const accessToken = prompt('Access Token: ') ?? '';
      const accessSecret = prompt('Access Token Secret: ') ?? '';

      credentials = {
        provider: 'twitter',
        apiKey,
        apiSecret,
        accessToken,
        accessSecret,
      };
    } else {
      if (!options.apiKey || !options.apiSecret || !options.accessToken || !options.accessSecret) {
        yield* Console.error(red('All credentials are required. Use --interactive or provide all options:'));
        yield* Console.error('  --api-key, --api-secret, --access-token, --access-secret');
        return yield* Effect.fail({ _tag: 'ValidationError' as const, message: 'Missing credentials' });
      }

      credentials = {
        provider: 'twitter',
        apiKey: options.apiKey,
        apiSecret: options.apiSecret,
        accessToken: options.accessToken,
        accessSecret: options.accessSecret,
      };
    }

    yield* manager.initializeProvider('twitter', credentials);
    yield* Console.log(green('Twitter credentials configured and verified successfully!'));
  });

/**
 * Handle logout command
 */
export const handleLogout = Effect.gen(function* () {
  const manager = yield* SocialsManagerTag;
  yield* manager.clearCredentials('twitter');
  yield* Console.log(green('Twitter credentials removed.'));
});

/**
 * Handle profile command
 */
export const handleProfile = (options: { json: boolean }) =>
  Effect.gen(function* () {
    const manager = yield* SocialsManagerTag;
    const { provider } = yield* manager.initializeProvider('twitter');
    const profile = yield* provider.getProfile();

    if (options.json) {
      yield* Console.log(JSON.stringify(profile, null, 2));
    } else {
      yield* Console.log(`${bold(`@${profile.username}`)} (${profile.displayName})`);
      yield* Console.log(gray(profile.bio ?? 'No bio'));
      yield* Console.log('');
      yield* Console.log(`Followers: ${cyan(profile.followersCount.toLocaleString())}`);
      yield* Console.log(`Following: ${cyan(profile.followingCount.toLocaleString())}`);
      yield* Console.log(`Posts: ${cyan(profile.postsCount.toLocaleString())}`);
      yield* Console.log('');
      yield* Console.log(gray(profile.url));
    }
  });

/**
 * Handle update-profile command
 */
export const handleUpdateProfile = (options: {
  name: string | undefined;
  bio: string | undefined;
  avatar: string | undefined;
  banner: string | undefined;
}) =>
  Effect.gen(function* () {
    if (!options.name && !options.bio && !options.avatar && !options.banner) {
      yield* Console.error(red('At least one option is required: --name, --bio, --avatar, or --banner'));
      return yield* Effect.fail({ _tag: 'ValidationError' as const, message: 'No options provided' });
    }

    const manager = yield* SocialsManagerTag;
    const { provider } = yield* manager.initializeProvider('twitter');

    const profile = yield* provider.updateProfile({
      displayName: options.name,
      bio: options.bio,
      avatarPath: options.avatar,
      bannerPath: options.banner,
    });

    yield* Console.log(green('Profile updated successfully!'));
    yield* Console.log(`${bold(`@${profile.username}`)} (${profile.displayName})`);
    yield* Console.log(gray(profile.bio ?? 'No bio'));
  });

/**
 * Handle tweet command
 */
export const handleTweet = (
  text: string,
  options: {
    replyTo: string | undefined;
    quote: string | undefined;
    media: string | undefined;
    json: boolean;
  },
) =>
  Effect.gen(function* () {
    const manager = yield* SocialsManagerTag;

    const mediaPaths = options.media
      ?.split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    const post = yield* manager.createPost('twitter', text, {
      replyToId: options.replyTo,
      quoteId: options.quote,
      mediaPaths,
    });

    if (options.json) {
      yield* Console.log(JSON.stringify(post, null, 2));
    } else {
      yield* Console.log(green('Tweet posted successfully!'));
      yield* Console.log(cyan(post.url));
    }
  });

/**
 * Handle delete command
 */
export const handleDelete = (id: string) =>
  Effect.gen(function* () {
    const manager = yield* SocialsManagerTag;
    const { provider } = yield* manager.initializeProvider('twitter');
    yield* provider.deletePost(id);
    yield* Console.log(green('Tweet deleted successfully!'));
  });

/**
 * Handle timeline command
 */
export const handleTimeline = (options: { limit: number; json: boolean }) =>
  Effect.gen(function* () {
    const manager = yield* SocialsManagerTag;
    const { provider } = yield* manager.initializeProvider('twitter');
    const posts = yield* provider.getPosts({ limit: options.limit });

    if (options.json) {
      yield* Console.log(JSON.stringify(posts, null, 2));
    } else {
      if (posts.length === 0) {
        yield* Console.log(gray('No tweets found.'));
        return;
      }

      for (const post of posts) {
        yield* Console.log(bold(`@${post.authorUsername}`) + gray(` · ${format(post.createdAt, 'PPp')}`));
        yield* Console.log(post.text);
        yield* Console.log(
          gray(`  ♥ ${post.likesCount}  ⟲ ${post.repostsCount}  💬 ${post.repliesCount}  ${cyan(post.url)}`),
        );
        yield* Console.log('');
      }
    }
  });

/**
 * Handle mentions command
 */
export const handleMentions = (options: { limit: number; sinceLast: boolean; json: boolean }) =>
  Effect.gen(function* () {
    const manager = yield* SocialsManagerTag;
    const mentions = yield* manager.getMentions('twitter', {
      limit: options.limit,
      sinceLastCheck: options.sinceLast,
    });

    if (options.json) {
      yield* Console.log(JSON.stringify(mentions, null, 2));
    } else {
      if (mentions.length === 0) {
        yield* Console.log(gray('No mentions found.'));
        return;
      }

      for (const mention of mentions) {
        const typeLabel: Record<string, string> = {
          mention: '📢',
          reply: '💬',
          quote: '🔁',
          repost: '⟲',
          like: '♥',
          follow: '👤',
        };

        yield* Console.log(
          `${typeLabel[mention.type] ?? '📢'} ` +
            bold(`@${mention.fromUser.username}`) +
            gray(` · ${format(mention.createdAt, 'PPp')}`),
        );

        if (mention.post) {
          yield* Console.log(mention.post.text);
          yield* Console.log(cyan(`  ${mention.post.url}`));
        }
        yield* Console.log('');
      }
    }
  });

/**
 * Handle reply command
 */
export const handleReply = (id: string, text: string, options: { json: boolean }) =>
  Effect.gen(function* () {
    const manager = yield* SocialsManagerTag;
    const { provider } = yield* manager.initializeProvider('twitter');
    const post = yield* provider.reply(id, text);

    if (options.json) {
      yield* Console.log(JSON.stringify(post, null, 2));
    } else {
      yield* Console.log(green('Reply posted successfully!'));
      yield* Console.log(cyan(post.url));
    }
  });

/**
 * Handle like command
 */
export const handleLike = (id: string) =>
  Effect.gen(function* () {
    const manager = yield* SocialsManagerTag;
    const { provider } = yield* manager.initializeProvider('twitter');
    yield* provider.like(id);
    yield* Console.log(green('Tweet liked!'));
  });

/**
 * Handle unlike command
 */
export const handleUnlike = (id: string) =>
  Effect.gen(function* () {
    const manager = yield* SocialsManagerTag;
    const { provider } = yield* manager.initializeProvider('twitter');
    yield* provider.unlike(id);
    yield* Console.log(green('Tweet unliked.'));
  });

/**
 * Handle retweet command
 */
export const handleRetweet = (id: string) =>
  Effect.gen(function* () {
    const manager = yield* SocialsManagerTag;
    const { provider } = yield* manager.initializeProvider('twitter');
    yield* provider.repost(id);
    yield* Console.log(green('Retweeted!'));
  });

/**
 * Handle unretweet command
 */
export const handleUnretweet = (id: string) =>
  Effect.gen(function* () {
    const manager = yield* SocialsManagerTag;
    const { provider } = yield* manager.initializeProvider('twitter');
    yield* provider.unrepost(id);
    yield* Console.log(green('Retweet undone.'));
  });

/**
 * Handle history command
 */
export const handleHistory = (options: { limit: number; json: boolean }) =>
  Effect.gen(function* () {
    const manager = yield* SocialsManagerTag;
    const history = yield* manager.getPostHistory('twitter', options.limit);

    if (options.json) {
      yield* Console.log(JSON.stringify(history, null, 2));
    } else {
      if (history.length === 0) {
        yield* Console.log(gray('No posts in local history.'));
        return;
      }

      yield* Console.log(bold(`Post History (${history.length} posts)\n`));

      for (const post of history) {
        yield* Console.log(gray(format(new Date(post.createdAt), 'PPp')));
        yield* Console.log(post.text.substring(0, 100) + (post.text.length > 100 ? '...' : ''));
        yield* Console.log(cyan(post.url));
        yield* Console.log('');
      }
    }
  });

/**
 * Handle status command
 */
export const handleStatus = Effect.gen(function* () {
  const manager = yield* SocialsManagerTag;
  const hasCredentials = yield* manager.hasCredentials('twitter');

  if (!hasCredentials) {
    yield* Console.log(yellow('Not configured. Run `nuclom-socials twitter auth` to set up.'));
    return;
  }

  yield* Console.log(gray('Testing credentials...'));

  const { provider } = yield* manager.initializeProvider('twitter');
  const profile = yield* provider.getProfile();

  yield* Console.log(green('Authenticated as:'));
  yield* Console.log(`${bold(`@${profile.username}`)} (${profile.displayName})`);
});

/**
 * Handle sync command
 */
export const handleSync = (options: { limit: number; outputDir: string; markdown: boolean; json: boolean }) =>
  Effect.gen(function* () {
    const syncService = yield* SyncServiceTag;

    const result = yield* syncService.syncTweets('twitter', {
      limit: options.limit,
    });

    if (options.markdown) {
      const mdPath = yield* syncService.exportToMarkdown('twitter', {
        limit: options.limit,
      });

      if (options.json) {
        yield* Console.log(JSON.stringify({ ...result, markdownPath: mdPath }, null, 2));
      } else {
        yield* Console.log(green('Tweets synced successfully!'));
        yield* Console.log(`JSON: ${cyan(result.path)}`);
        yield* Console.log(`Markdown: ${cyan(mdPath)}`);
        yield* Console.log(`Tweets: ${result.tweetsCount}`);
      }
    } else {
      if (options.json) {
        yield* Console.log(JSON.stringify(result, null, 2));
      } else {
        yield* Console.log(green('Tweets synced successfully!'));
        yield* Console.log(`Path: ${cyan(result.path)}`);
        yield* Console.log(`Tweets: ${result.tweetsCount}`);
        if (result.isNew) {
          yield* Console.log(gray('First sync - created new state file'));
        }
      }
    }
  });
