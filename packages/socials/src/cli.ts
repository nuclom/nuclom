#!/usr/bin/env bun

import chalk from 'chalk';
import { Command } from 'commander';
import { createTwitterCommand } from './commands/twitter.ts';
import { getAvailableProviders } from './manager.ts';
import { getStorageDirectory } from './storage/store.ts';

const program = new Command();

program.name('nuclom-socials').description('CLI tool for managing Nuclom social media accounts').version('0.0.1');

// Add provider subcommands
program.addCommand(createTwitterCommand());

// Info command
program
  .command('providers')
  .description('List available social media providers')
  .action(() => {
    const providers = getAvailableProviders();
    console.log(chalk.bold('Available Providers:\n'));
    for (const provider of providers) {
      console.log(`  ${chalk.cyan(provider)}`);
    }
    console.log();
    console.log(chalk.gray(`Run 'nuclom-socials <provider> --help' for provider-specific commands.`));
  });

// Config command
program
  .command('config')
  .description('Show configuration information')
  .action(() => {
    console.log(chalk.bold('Configuration:\n'));
    console.log(`Storage directory: ${chalk.cyan(getStorageDirectory())}`);
    console.log();
    console.log(chalk.gray('Credentials and state are stored per-provider in the storage directory.'));
  });

// Parse and run
program.parse();
