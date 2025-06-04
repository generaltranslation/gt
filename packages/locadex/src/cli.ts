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

const packageJson = JSON.parse(
  readFileSync(fromPackageRoot('package.json'), 'utf8')
);

const program = new Command();

program
  .name('locadex')
  .description('AI agent for internationalization')
  .version(packageJson.version)
  .option('-v, --verbose', 'Verbose output')
  .option('--no-telemetry', 'Disable telemetry')
  .action((options: CliOptions) =>
    withTelemetry({ enabled: !options.noTelemetry, options }, () =>
      startCommand(options)
    )
  );

program
  .command('run')
  .description('Fully internationalize your project')
  .option('-v, --verbose', 'Verbose output')
  .option('--no-telemetry', 'Disable telemetry')
  .action((options: CliOptions) =>
    withTelemetry({ enabled: !options.noTelemetry, options }, () =>
      startCommand(options)
    )
  );

program
  .command('setup')
  .description('Set up locadex for your project')
  .option('-v, --verbose', 'Verbose output')
  .option('--no-telemetry', 'Disable telemetry')
  .action((options: CliOptions) =>
    withTelemetry({ enabled: !options.noTelemetry, options }, () =>
      setupCommand(options)
    )
  );

program
  .command('i18n')
  .description('Run AI-powered internationalization tasks')
  .option('-v, --verbose', 'Verbose output')
  .option('--no-telemetry', 'Disable telemetry')
  .action((options: CliOptions) =>
    withTelemetry({ enabled: !options.noTelemetry, options }, () =>
      i18nCommand(options)
    )
  );

program.parse();
