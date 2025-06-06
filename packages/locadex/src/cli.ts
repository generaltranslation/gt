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
import { CliOptions } from './types/cli.js';
import { withTelemetry } from './telemetry.js';
import { logger } from './logging/logger.js';
import { i18nCommand } from './commands/i18n.js';
import { displayHeader } from './logging/console.js';
import { main } from 'gtx-cli/index';

const packageJson = JSON.parse(
  readFileSync(fromPackageRoot('package.json'), 'utf8')
);

const program = new Command();

program
  .name('locadex')
  .description('AI agent for internationalization')
  .version(packageJson.version);

program
  .command('start')
  .description('Run Locadex on your project')
  .option('-v, --verbose', 'Verbose output')
  .option('-d, --debug', 'Debug output')
  .option('-b, --batch-size <number>', 'Batch size', '1')
  .option('--no-telemetry', 'Disable telemetry')
  .action((options: CliOptions, command: Command) => {
    const parentOptions = command.parent?.opts() || {};
    const allOptions = { ...parentOptions, ...options };
    withTelemetry(
      { enabled: !allOptions.noTelemetry, options: allOptions },
      () => {
        logger.initialize(allOptions);
        displayHeader();
        setupCommand(Number(allOptions.batchSize) || 1);
      }
    );
  });

program
  .command('i18n')
  .description('Run Locadex i18n on your project')
  .option('-v, --verbose', 'Verbose output')
  .option('-d, --debug', 'Debug output')
  .option('-b, --batch-size <number>', 'Batch size', '1')
  .option('--no-telemetry', 'Disable telemetry')
  .action((options: CliOptions, command: Command) => {
    const parentOptions = command.parent?.opts() || {};
    const allOptions = { ...parentOptions, ...options };
    withTelemetry(
      { enabled: !allOptions.noTelemetry, options: allOptions },
      () => {
        logger.initialize(allOptions);
        displayHeader();
        i18nCommand(Number(allOptions.batchSize) || 1);
      }
    );
  });

main(program);

program.parse();
