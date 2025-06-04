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
    logger.initialize(options);
    console.log('startCommand', options);
    withTelemetry({ enabled: !options.noTelemetry, options }, () =>
      startCommand()
    );
  });

program
  .command('run')
  .description('Fully internationalize your project')
  .action((options: CliOptions, command: Command) => {
    const parentOptions = command.parent?.opts() || {};
    const allOptions = { ...parentOptions, ...options };
    logger.initialize(allOptions);
    console.log('runCommand', allOptions);
    withTelemetry({ enabled: !allOptions.noTelemetry, options: allOptions }, () =>
      startCommand()
    );
  });

program
  .command('setup')
  .description('Set up locadex for your project')
  .action((options: CliOptions, command: Command) => {
    const parentOptions = command.parent?.opts() || {};
    const allOptions = { ...parentOptions, ...options };
    withTelemetry({ enabled: !allOptions.noTelemetry, options: allOptions }, () => {
      logger.initialize(allOptions);
      console.log('setupCommand', allOptions);
      setupCommand();
    });
  });

program
  .command('i18n')
  .description('Run AI-powered internationalization tasks')
  .action((options: CliOptions, command: Command) => {
    const parentOptions = command.parent?.opts() || {};
    const allOptions = { ...parentOptions, ...options };
    withTelemetry({ enabled: !allOptions.noTelemetry, options: allOptions }, () => {
      logger.initialize(allOptions);
      console.log('i18nCommand', allOptions);
      i18nCommand();
    });
  });

program.parse();
