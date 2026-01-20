import { Command } from '@effect/cli';
import { Console } from 'effect';
import {
  handleAuth,
  handleDelete,
  handleHistory,
  handleLike,
  handleLogout,
  handleMentions,
  handleProfile,
  handleReply,
  handleRetweet,
  handleStatus,
  handleSync,
  handleTimeline,
  handleTweet,
  handleUnlike,
  handleUnretweet,
  handleUpdateProfile,
} from './handlers.ts';
import {
  accessSecretOption,
  accessTokenOption,
  apiKeyOption,
  apiSecretOption,
  avatarOption,
  bannerOption,
  bioOption,
  interactiveOption,
  jsonOption,
  limitOption,
  markdownOption,
  mediaOption,
  nameOption,
  outputDirOption,
  quoteOption,
  replyTextArg,
  replyToOption,
  sinceLastOption,
  syncLimitOption,
  tweetIdArg,
  tweetTextArg,
} from './options.ts';

/**
 * Auth command - configure credentials
 */
export const authCommand = Command.make(
  'auth',
  {
    apiKey: apiKeyOption,
    apiSecret: apiSecretOption,
    accessToken: accessTokenOption,
    accessSecret: accessSecretOption,
    interactive: interactiveOption,
  },
  (options) =>
    handleAuth({
      apiKey: options.apiKey._tag === 'Some' ? options.apiKey.value : undefined,
      apiSecret: options.apiSecret._tag === 'Some' ? options.apiSecret.value : undefined,
      accessToken: options.accessToken._tag === 'Some' ? options.accessToken.value : undefined,
      accessSecret: options.accessSecret._tag === 'Some' ? options.accessSecret.value : undefined,
      interactive: options.interactive,
    }),
).pipe(Command.withDescription('Configure Twitter API credentials'));

/**
 * Logout command
 */
export const logoutCommand = Command.make('logout', {}, () => handleLogout).pipe(
  Command.withDescription('Remove stored Twitter credentials'),
);

/**
 * Profile command
 */
export const profileCommand = Command.make('profile', { json: jsonOption }, (options) =>
  handleProfile({ json: options.json }),
).pipe(Command.withDescription('View your Twitter profile'));

/**
 * Update profile command
 */
export const updateProfileCommand = Command.make(
  'update-profile',
  {
    name: nameOption,
    bio: bioOption,
    avatar: avatarOption,
    banner: bannerOption,
  },
  (options) =>
    handleUpdateProfile({
      name: options.name._tag === 'Some' ? options.name.value : undefined,
      bio: options.bio._tag === 'Some' ? options.bio.value : undefined,
      avatar: options.avatar._tag === 'Some' ? options.avatar.value : undefined,
      banner: options.banner._tag === 'Some' ? options.banner.value : undefined,
    }),
).pipe(Command.withDescription('Update profile information'));

/**
 * Tweet command
 */
export const tweetCommand = Command.make(
  'tweet',
  {
    text: tweetTextArg,
    replyTo: replyToOption,
    quote: quoteOption,
    media: mediaOption,
    json: jsonOption,
  },
  (options) =>
    handleTweet(options.text, {
      replyTo: options.replyTo._tag === 'Some' ? options.replyTo.value : undefined,
      quote: options.quote._tag === 'Some' ? options.quote.value : undefined,
      media: options.media._tag === 'Some' ? options.media.value : undefined,
      json: options.json,
    }),
).pipe(Command.withDescription('Post a new tweet'));

/**
 * Delete command
 */
export const deleteCommand = Command.make('delete', { id: tweetIdArg }, (options) => handleDelete(options.id)).pipe(
  Command.withDescription('Delete a tweet'),
);

/**
 * Timeline command
 */
export const timelineCommand = Command.make('timeline', { limit: limitOption, json: jsonOption }, (options) =>
  handleTimeline({ limit: options.limit, json: options.json }),
).pipe(Command.withDescription('View your recent tweets'));

/**
 * Mentions command
 */
export const mentionsCommand = Command.make(
  'mentions',
  { limit: limitOption, sinceLast: sinceLastOption, json: jsonOption },
  (options) =>
    handleMentions({
      limit: options.limit,
      sinceLast: options.sinceLast,
      json: options.json,
    }),
).pipe(Command.withDescription('View mentions and replies'));

/**
 * Reply command
 */
export const replyCommand = Command.make('reply', { id: tweetIdArg, text: replyTextArg, json: jsonOption }, (options) =>
  handleReply(options.id, options.text, { json: options.json }),
).pipe(Command.withDescription('Reply to a tweet'));

/**
 * Like command
 */
export const likeCommand = Command.make('like', { id: tweetIdArg }, (options) => handleLike(options.id)).pipe(
  Command.withDescription('Like a tweet'),
);

/**
 * Unlike command
 */
export const unlikeCommand = Command.make('unlike', { id: tweetIdArg }, (options) => handleUnlike(options.id)).pipe(
  Command.withDescription('Unlike a tweet'),
);

/**
 * Retweet command
 */
export const retweetCommand = Command.make('retweet', { id: tweetIdArg }, (options) => handleRetweet(options.id)).pipe(
  Command.withDescription('Retweet a tweet'),
);

/**
 * Unretweet command
 */
export const unretweetCommand = Command.make('unretweet', { id: tweetIdArg }, (options) =>
  handleUnretweet(options.id),
).pipe(Command.withDescription('Undo a retweet'));

/**
 * History command
 */
export const historyCommand = Command.make('history', { limit: limitOption, json: jsonOption }, (options) =>
  handleHistory({ limit: options.limit, json: options.json }),
).pipe(Command.withDescription('View local post history'));

/**
 * Status command
 */
export const statusCommand = Command.make('status', {}, () => handleStatus).pipe(
  Command.withDescription('Check authentication status'),
);

/**
 * Sync command
 */
export const syncCommand = Command.make(
  'sync',
  {
    limit: syncLimitOption,
    outputDir: outputDirOption,
    markdown: markdownOption,
    json: jsonOption,
  },
  (options) =>
    handleSync({
      limit: options.limit,
      outputDir: options.outputDir,
      markdown: options.markdown,
      json: options.json,
    }),
).pipe(Command.withDescription('Sync tweets to git repository for version control'));

/**
 * Main Twitter command with all subcommands
 */
export const twitterCommand = Command.make('twitter', {}, () =>
  Console.log('Use --help to see available subcommands'),
).pipe(
  Command.withDescription('Manage Twitter/X account'),
  Command.withSubcommands([
    authCommand,
    logoutCommand,
    profileCommand,
    updateProfileCommand,
    tweetCommand,
    deleteCommand,
    timelineCommand,
    mentionsCommand,
    replyCommand,
    likeCommand,
    unlikeCommand,
    retweetCommand,
    unretweetCommand,
    historyCommand,
    statusCommand,
    syncCommand,
  ]),
);
