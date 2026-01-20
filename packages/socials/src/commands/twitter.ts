import chalk from 'chalk';
import { Command } from 'commander';
import { format } from 'date-fns';
import { Effect } from 'effect';
import { createSocialsManager } from '../manager.ts';
import type { TwitterCredentials } from '../providers/twitter/index.ts';

const manager = createSocialsManager();

/**
 * Run an Effect and handle errors
 */
async function runEffect<A, E>(effect: Effect.Effect<A, E>): Promise<A | null> {
  const exit = await Effect.runPromiseExit(effect);

  if (exit._tag === 'Failure') {
    const error = exit.cause;
    if ('_tag' in error && error._tag === 'Fail') {
      const e = error.error as { message?: string; _tag?: string };
      console.error(chalk.red(`Error: ${e.message ?? 'Unknown error'}`));
      if (e._tag) {
        console.error(chalk.gray(`Type: ${e._tag}`));
      }
    } else {
      console.error(chalk.red('An unexpected error occurred'));
      console.error(error);
    }
    return null;
  }

  return exit.value;
}

/**
 * Create the Twitter subcommand
 */
export function createTwitterCommand(): Command {
  const twitter = new Command('twitter').description('Manage Twitter/X account');

  // Auth command - configure credentials
  twitter
    .command('auth')
    .description('Configure Twitter API credentials')
    .option('--api-key <key>', 'Twitter API key')
    .option('--api-secret <secret>', 'Twitter API secret')
    .option('--access-token <token>', 'Twitter access token')
    .option('--access-secret <secret>', 'Twitter access token secret')
    .option('--interactive', 'Interactive mode - prompt for credentials', false)
    .action(async (options) => {
      let credentials: TwitterCredentials;

      if (options.interactive) {
        // Interactive mode using Bun prompts
        console.log(chalk.blue('Configure Twitter API credentials'));
        console.log(chalk.gray('Get these from https://developer.twitter.com/en/portal/dashboard\n'));

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
          console.error(chalk.red('All credentials are required. Use --interactive or provide all options:'));
          console.error('  --api-key, --api-secret, --access-token, --access-secret');
          process.exit(1);
        }

        credentials = {
          provider: 'twitter',
          apiKey: options.apiKey,
          apiSecret: options.apiSecret,
          accessToken: options.accessToken,
          accessSecret: options.accessSecret,
        };
      }

      const effect = Effect.gen(function* () {
        // Test credentials by initializing
        yield* manager.initializeProvider('twitter', credentials);
        console.log(chalk.green('Twitter credentials configured and verified successfully!'));
      });

      await runEffect(effect);
    });

  // Logout command
  twitter
    .command('logout')
    .description('Remove stored Twitter credentials')
    .action(async () => {
      const effect = Effect.gen(function* () {
        yield* manager.clearCredentials('twitter');
        console.log(chalk.green('Twitter credentials removed.'));
      });

      await runEffect(effect);
    });

  // Profile command
  twitter
    .command('profile')
    .description('View or update profile')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const effect = Effect.gen(function* () {
        const { provider } = yield* manager.initializeProvider('twitter');
        const profile = yield* provider.getProfile();

        if (options.json) {
          console.log(JSON.stringify(profile, null, 2));
        } else {
          console.log(`${chalk.bold(`@${profile.username}`)} (${profile.displayName})`);
          console.log(chalk.gray(profile.bio ?? 'No bio'));
          console.log();
          console.log(`Followers: ${chalk.cyan(profile.followersCount.toLocaleString())}`);
          console.log(`Following: ${chalk.cyan(profile.followingCount.toLocaleString())}`);
          console.log(`Posts: ${chalk.cyan(profile.postsCount.toLocaleString())}`);
          console.log();
          console.log(chalk.gray(profile.url));
        }
      });

      await runEffect(effect);
    });

  // Update profile command
  twitter
    .command('update-profile')
    .description('Update profile information')
    .option('--name <name>', 'Display name')
    .option('--bio <bio>', 'Profile bio/description')
    .option('--avatar <path>', 'Path to avatar image')
    .option('--banner <path>', 'Path to banner image')
    .action(async (options) => {
      if (!options.name && !options.bio && !options.avatar && !options.banner) {
        console.error(chalk.red('At least one option is required: --name, --bio, --avatar, or --banner'));
        process.exit(1);
      }

      const effect = Effect.gen(function* () {
        const { provider } = yield* manager.initializeProvider('twitter');

        const profile = yield* provider.updateProfile({
          displayName: options.name,
          bio: options.bio,
          avatarPath: options.avatar,
          bannerPath: options.banner,
        });

        console.log(chalk.green('Profile updated successfully!'));
        console.log(`${chalk.bold(`@${profile.username}`)} (${profile.displayName})`);
        console.log(chalk.gray(profile.bio ?? 'No bio'));
      });

      await runEffect(effect);
    });

  // Tweet command
  twitter
    .command('tweet')
    .description('Post a new tweet')
    .argument('<text>', 'Tweet text')
    .option('--reply-to <id>', 'Reply to a tweet ID')
    .option('--quote <id>', 'Quote a tweet ID')
    .option('--media <paths...>', 'Attach media files')
    .option('--json', 'Output as JSON')
    .action(async (text, options) => {
      const effect = Effect.gen(function* () {
        const post = yield* manager.createPost('twitter', text, {
          replyToId: options.replyTo,
          quoteId: options.quote,
          mediaPaths: options.media,
        });

        if (options.json) {
          console.log(JSON.stringify(post, null, 2));
        } else {
          console.log(chalk.green('Tweet posted successfully!'));
          console.log(chalk.cyan(post.url));
        }
      });

      await runEffect(effect);
    });

  // Delete tweet command
  twitter
    .command('delete')
    .description('Delete a tweet')
    .argument('<id>', 'Tweet ID to delete')
    .action(async (id) => {
      const effect = Effect.gen(function* () {
        const { provider } = yield* manager.initializeProvider('twitter');
        yield* provider.deletePost(id);
        console.log(chalk.green('Tweet deleted successfully!'));
      });

      await runEffect(effect);
    });

  // Timeline command
  twitter
    .command('timeline')
    .description('View your recent tweets')
    .option('-n, --limit <count>', 'Number of tweets to fetch', '10')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const effect = Effect.gen(function* () {
        const { provider } = yield* manager.initializeProvider('twitter');
        const posts = yield* provider.getPosts({ limit: parseInt(options.limit, 10) });

        if (options.json) {
          console.log(JSON.stringify(posts, null, 2));
        } else {
          if (posts.length === 0) {
            console.log(chalk.gray('No tweets found.'));
            return;
          }

          for (const post of posts) {
            console.log(chalk.bold(`@${post.authorUsername}`) + chalk.gray(` · ${format(post.createdAt, 'PPp')}`));
            console.log(post.text);
            console.log(
              chalk.gray(
                `  ♥ ${post.likesCount}  ⟲ ${post.repostsCount}  💬 ${post.repliesCount}  ${chalk.cyan(post.url)}`,
              ),
            );
            console.log();
          }
        }
      });

      await runEffect(effect);
    });

  // Mentions command
  twitter
    .command('mentions')
    .description('View mentions and replies')
    .option('-n, --limit <count>', 'Number of mentions to fetch', '10')
    .option('--since-last', 'Only fetch mentions since last check', false)
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const effect = Effect.gen(function* () {
        const mentions = yield* manager.getMentions('twitter', {
          limit: parseInt(options.limit, 10),
          sinceLastCheck: options.sinceLast,
        });

        if (options.json) {
          console.log(JSON.stringify(mentions, null, 2));
        } else {
          if (mentions.length === 0) {
            console.log(chalk.gray('No mentions found.'));
            return;
          }

          for (const mention of mentions) {
            const typeLabel = {
              mention: '📢',
              reply: '💬',
              quote: '🔁',
              repost: '⟲',
              like: '♥',
              follow: '👤',
            }[mention.type];

            console.log(
              `${typeLabel} ` +
                chalk.bold(`@${mention.fromUser.username}`) +
                chalk.gray(` · ${format(mention.createdAt, 'PPp')}`),
            );

            if (mention.post) {
              console.log(mention.post.text);
              console.log(chalk.cyan(`  ${mention.post.url}`));
            }
            console.log();
          }
        }
      });

      await runEffect(effect);
    });

  // Reply command
  twitter
    .command('reply')
    .description('Reply to a tweet')
    .argument('<id>', 'Tweet ID to reply to')
    .argument('<text>', 'Reply text')
    .option('--json', 'Output as JSON')
    .action(async (id, text, options) => {
      const effect = Effect.gen(function* () {
        const { provider } = yield* manager.initializeProvider('twitter');
        const post = yield* provider.reply(id, text);

        if (options.json) {
          console.log(JSON.stringify(post, null, 2));
        } else {
          console.log(chalk.green('Reply posted successfully!'));
          console.log(chalk.cyan(post.url));
        }
      });

      await runEffect(effect);
    });

  // Like command
  twitter
    .command('like')
    .description('Like a tweet')
    .argument('<id>', 'Tweet ID to like')
    .action(async (id) => {
      const effect = Effect.gen(function* () {
        const { provider } = yield* manager.initializeProvider('twitter');
        yield* provider.like(id);
        console.log(chalk.green('Tweet liked!'));
      });

      await runEffect(effect);
    });

  // Unlike command
  twitter
    .command('unlike')
    .description('Unlike a tweet')
    .argument('<id>', 'Tweet ID to unlike')
    .action(async (id) => {
      const effect = Effect.gen(function* () {
        const { provider } = yield* manager.initializeProvider('twitter');
        yield* provider.unlike(id);
        console.log(chalk.green('Tweet unliked.'));
      });

      await runEffect(effect);
    });

  // Retweet command
  twitter
    .command('retweet')
    .description('Retweet a tweet')
    .argument('<id>', 'Tweet ID to retweet')
    .action(async (id) => {
      const effect = Effect.gen(function* () {
        const { provider } = yield* manager.initializeProvider('twitter');
        yield* provider.repost(id);
        console.log(chalk.green('Retweeted!'));
      });

      await runEffect(effect);
    });

  // Unretweet command
  twitter
    .command('unretweet')
    .description('Undo a retweet')
    .argument('<id>', 'Tweet ID to unretweet')
    .action(async (id) => {
      const effect = Effect.gen(function* () {
        const { provider } = yield* manager.initializeProvider('twitter');
        yield* provider.unrepost(id);
        console.log(chalk.green('Retweet undone.'));
      });

      await runEffect(effect);
    });

  // History command - view local post history
  twitter
    .command('history')
    .description('View local post history')
    .option('-n, --limit <count>', 'Number of posts to show', '20')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const effect = Effect.gen(function* () {
        const history = yield* manager.getPostHistory('twitter', parseInt(options.limit, 10));

        if (options.json) {
          console.log(JSON.stringify(history, null, 2));
        } else {
          if (history.length === 0) {
            console.log(chalk.gray('No posts in local history.'));
            return;
          }

          console.log(chalk.bold(`Post History (${history.length} posts)\n`));

          for (const post of history) {
            console.log(chalk.gray(format(new Date(post.createdAt), 'PPp')));
            console.log(post.text.substring(0, 100) + (post.text.length > 100 ? '...' : ''));
            console.log(chalk.cyan(post.url));
            console.log();
          }
        }
      });

      await runEffect(effect);
    });

  // Status command
  twitter
    .command('status')
    .description('Check authentication status')
    .action(async () => {
      const effect = Effect.gen(function* () {
        const hasCredentials = yield* manager.hasCredentials('twitter');

        if (!hasCredentials) {
          console.log(chalk.yellow('Not configured. Run `nuclom-socials twitter auth` to set up.'));
          return;
        }

        console.log(chalk.gray('Testing credentials...'));

        const { provider } = yield* manager.initializeProvider('twitter');
        const profile = yield* provider.getProfile();

        console.log(chalk.green('Authenticated as:'));
        console.log(`${chalk.bold(`@${profile.username}`)} (${profile.displayName})`);
      });

      await runEffect(effect);
    });

  return twitter;
}
