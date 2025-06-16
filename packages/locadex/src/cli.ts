#!/usr/bin/env node

import dotenv from 'dotenv';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });
dotenv.config({ path: '.env.production', override: true });

import './telemetry.js';
import './utils/shutdown.js';
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fromPackageRoot } from './utils/getPaths.js';
import { setupCommand } from './commands/setup.js';
import { i18nCommand } from './commands/i18n.js';
import { main } from 'gtx-cli/index';
import { fixErrorsCommand } from './commands/fixErrors.js';

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
  .option('-b, --batch-size <number>', 'File batch size')
  .option('-t, --timeout <number>', 'Timeout for each file in a batch')
  .option('-c, --concurrency <number>', 'Max number of concurrent agents')
  .option(
    '-m, --match-files <pattern>',
    'Comma-separated list of glob patterns to match source files. Should be relative to root directory.'
  )
  .option(
    '--package-manager <manager>',
    'Package manager to use. (npm, pnpm, yarn_v1, yarn_v2, bun, deno)'
  )
  .option('-y, --bypass-prompts', 'Bypass interactive prompts')
  .option('--no-telemetry', 'Disable telemetry')
  .option('--app-dir <dir>', 'Relative path to the application directory', '.')
  .option(
    '--local-translations',
    'Enable local translations with loadTranslations.ts file and GT config'
  )
  .action(setupCommand);

program
  .command('i18n')
  .description('Run Locadex i18n on your project')
  .option('-v, --verbose', 'Verbose output')
  .option('-d, --debug', 'Debug output')
  .option('-b, --batch-size <number>', 'File batch size')
  .option('-t, --timeout <number>', 'Timeout for each file in a batch')
  .option('-c, --concurrency <number>', 'Max number of concurrent agents')
  .option(
    '-m, --match-files <pattern>',
    'Comma-separated list of glob patterns to match source files. Should be relative to root directory.'
  )
  .option('--no-telemetry', 'Disable telemetry')
  .option('--app-dir <dir>', 'Relative path to the application directory', '.')
  .action(i18nCommand);

program
  .command('fix')
  .description('Run Locadex to validate your project and fix errors')
  .option('-v, --verbose', 'Verbose output')
  .option('-d, --debug', 'Debug output')
  .option('-b, --batch-size <number>', 'File batch size')
  .option('-t, --timeout <number>', 'Timeout for each file in a batch')
  .option('-c, --concurrency <number>', 'Max number of concurrent agents')
  .option(
    '-m, --match-files <pattern>',
    'Comma-separated list of glob patterns to match source files. Should be relative to root directory.'
  )
  .option('--no-telemetry', 'Disable telemetry')
  .option('--app-dir <dir>', 'Relative path to the application directory', '.')
  .action(fixErrorsCommand);

main(program);

program.parse();
