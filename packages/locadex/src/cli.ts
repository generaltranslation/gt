#!/usr/bin/env node
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });
dotenv.config({ path: '.env.production', override: true });

import './telemetry.js';
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fromPackageRoot } from './utils/getPaths.js';
import { setupCommand } from './commands/setup.js';
import { i18nCommand } from './commands/i18n.js';
import { i18nDagCommand } from './commands/i18n-dag.js';
import { startCommand } from './commands/run.js';
import { CliOptions } from './types/cli.js';
import { withTelemetry } from './telemetry.js';
import { logger } from './logging/logger.js';

const packageJson = JSON.parse(
  readFileSync(fromPackageRoot('package.json'), 'utf8')
);

const program = new Command();

program
  .name('locadex')
  .description('AI agent for internationalization')
  .version(packageJson.version)
  .option('-v, --verbose', 'Verbose output')
  .option('-d, --debug', 'Debug output')
  .option('--no-telemetry', 'Disable telemetry')
  .action((options: CliOptions) => {
    withTelemetry({ enabled: !options.noTelemetry, options }, () => {
      logger.initialize(options);
      startCommand();
    });
  });

program
  .command('run')
  .description('Fully internationalize your project')
  .action((options: CliOptions, command: Command) => {
    const parentOptions = command.parent?.opts() || {};
    const allOptions = { ...parentOptions, ...options };
    withTelemetry(
      { enabled: !allOptions.noTelemetry, options: allOptions },
      () => {
        logger.initialize(allOptions);
        startCommand();
      }
    );
  });

program
  .command('setup')
  .description('Set up locadex for your project')
  .action((options: CliOptions, command: Command) => {
    const parentOptions = command.parent?.opts() || {};
    const allOptions = { ...parentOptions, ...options };
    withTelemetry(
      { enabled: !allOptions.noTelemetry, options: allOptions },
      () => {
        logger.initialize(allOptions);
        setupCommand();
      }
    );
  });

program
  .command('i18n')
  .description('Run AI-powered internationalization tasks')
  .action((options: CliOptions, command: Command) => {
    const parentOptions = command.parent?.opts() || {};
    const allOptions = { ...parentOptions, ...options };
    withTelemetry(
      { enabled: !allOptions.noTelemetry, options: allOptions },
      () => {
        logger.initialize(allOptions);
        i18nCommand();
      }
    );
  });

program
  .command('i18n-dag')
  .description(
    'Run AI-powered internationalization tasks with concurrent processing'
  )
  .action((options: CliOptions, command: Command) => {
    const parentOptions = command.parent?.opts() || {};
    const allOptions = { ...parentOptions, ...options };
    withTelemetry(
      { enabled: !allOptions.noTelemetry, options: allOptions },
      () => {
        logger.initialize(allOptions);
        i18nDagCommand();
      }
    );
  });

program.parse();
