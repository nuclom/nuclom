#!/usr/bin/env bun

import { Command } from '@effect/cli';
import { BunContext, BunRuntime } from '@effect/platform-bun';
import { Console, Effect, Layer } from 'effect';
// Import package.json for version
import pkg from '../package.json' with { type: 'json' };
import { twitterCommand } from './commands/twitter/index.ts';
import { getAvailableProviders } from './manager.ts';
import { ServicesLive } from './services/index.ts';
import { getStorageDirectory } from './storage/store.ts';

/**
 * Format helpers for terminal output
 */
const bold = (text: string) => `\x1b[1m${text}\x1b[0m`;
const cyan = (text: string) => `\x1b[36m${text}\x1b[0m`;
const gray = (text: string) => `\x1b[90m${text}\x1b[0m`;

/**
 * Providers command - list available providers
 */
const providersCommand = Command.make('providers', {}, () =>
  Effect.gen(function* () {
    const providers = getAvailableProviders();
    yield* Console.log(bold('Available Providers:\n'));
    for (const provider of providers) {
      yield* Console.log(`  ${cyan(provider)}`);
    }
    yield* Console.log('');
    yield* Console.log(gray("Run 'nuclom-socials <provider> --help' for provider-specific commands."));
  }),
).pipe(Command.withDescription('List available social media providers'));

/**
 * Config command - show configuration information
 */
const configCommand = Command.make('config', {}, () =>
  Effect.gen(function* () {
    yield* Console.log(bold('Configuration:\n'));
    yield* Console.log(`Storage directory: ${cyan(getStorageDirectory())}`);
    yield* Console.log('');
    yield* Console.log(gray('Credentials and state are stored per-provider in the storage directory.'));
  }),
).pipe(Command.withDescription('Show configuration information'));

/**
 * Main CLI app command
 */
const app = Command.make('nuclom-socials', {}, () => Console.log('Use --help to see available commands')).pipe(
  Command.withDescription('CLI tool for managing Nuclom social media accounts'),
  Command.withSubcommands([twitterCommand, providersCommand, configCommand]),
);

/**
 * Build and run the CLI
 */
const cli = Command.run(app, {
  name: 'nuclom-socials',
  version: pkg.version,
});

/**
 * Main layer combining all services
 */
const MainLayer = Layer.mergeAll(ServicesLive, BunContext.layer);

// Run the CLI
cli(process.argv).pipe(Effect.provide(MainLayer), BunRuntime.runMain);
