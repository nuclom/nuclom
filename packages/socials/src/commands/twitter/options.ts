import { Args, Options } from '@effect/cli';

// Common options used across multiple commands
export const jsonOption = Options.boolean('json').pipe(
  Options.withDescription('Output as JSON'),
  Options.withDefault(false),
);

export const limitOption = Options.integer('limit').pipe(
  Options.withAlias('n'),
  Options.withDescription('Number of items to fetch'),
  Options.withDefault(10),
);

// Auth command options
export const apiKeyOption = Options.text('api-key').pipe(Options.withDescription('Twitter API key'), Options.optional);

export const apiSecretOption = Options.text('api-secret').pipe(
  Options.withDescription('Twitter API secret'),
  Options.optional,
);

export const accessTokenOption = Options.text('access-token').pipe(
  Options.withDescription('Twitter access token'),
  Options.optional,
);

export const accessSecretOption = Options.text('access-secret').pipe(
  Options.withDescription('Twitter access token secret'),
  Options.optional,
);

export const interactiveOption = Options.boolean('interactive').pipe(
  Options.withDescription('Interactive mode - prompt for credentials'),
  Options.withDefault(false),
);

// Profile update options
export const nameOption = Options.text('name').pipe(Options.withDescription('Display name'), Options.optional);

export const bioOption = Options.text('bio').pipe(Options.withDescription('Profile bio/description'), Options.optional);

export const avatarOption = Options.text('avatar').pipe(
  Options.withDescription('Path to avatar image'),
  Options.optional,
);

export const bannerOption = Options.text('banner').pipe(
  Options.withDescription('Path to banner image'),
  Options.optional,
);

// Tweet command options
export const replyToOption = Options.text('reply-to').pipe(
  Options.withDescription('Reply to a tweet ID'),
  Options.optional,
);

export const quoteOption = Options.text('quote').pipe(Options.withDescription('Quote a tweet ID'), Options.optional);

export const mediaOption = Options.text('media').pipe(
  Options.withDescription('Attach media files (comma-separated paths)'),
  Options.optional,
);

// Mentions options
export const sinceLastOption = Options.boolean('since-last').pipe(
  Options.withDescription('Only fetch mentions since last check'),
  Options.withDefault(false),
);

// Sync command options
export const syncLimitOption = Options.integer('limit').pipe(
  Options.withAlias('n'),
  Options.withDescription('Number of tweets to sync'),
  Options.withDefault(100),
);

export const outputDirOption = Options.text('output-dir').pipe(
  Options.withDescription('Output directory relative to git root'),
  Options.withDefault('.nuclom/socials'),
);

export const markdownOption = Options.boolean('markdown').pipe(
  Options.withDescription('Also export as markdown file'),
  Options.withDefault(false),
);

// Arguments
export const tweetTextArg = Args.text({ name: 'text' }).pipe(Args.withDescription('Tweet text'));

export const tweetIdArg = Args.text({ name: 'id' }).pipe(Args.withDescription('Tweet ID'));

export const replyTextArg = Args.text({ name: 'text' }).pipe(Args.withDescription('Reply text'));
