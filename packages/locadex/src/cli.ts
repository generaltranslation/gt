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
import { i18nCommand } from './commands/i18n.js';
import { displayHeader } from './logging/console.js';
import { main } from 'gtx-cli/index';
import { LocadexManager } from './utils/locadexManager.js';
import { logger } from './logging/logger.js';

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
  .option('-b, --batch-size <number>', 'File batch size', '10')
  .option('-c, --concurrency <number>', 'Max number of concurrent agents', '1')
  .option(
    '-f, --files <pattern>',
    'Comma-separated list of glob patterns to match source files'
  )
  .option(
    '-e, --extensions <extensions>',
    'Comma-separated list of file extensions to match'
  )
  .option(
    '--package-manager <manager>',
    'Package manager to use. (npm, pnpm, yarn_v1, yarn_v2, bun, deno)'
  )
  .option('-y, --bypass-prompts', 'Bypass interactive prompts')
  .option('--no-telemetry', 'Disable telemetry')
  .action(
    (
      options: CliOptions & {
        packageManager?: string;
        bypassPrompts?: boolean;
      },
      command: Command
    ) => {
      const parentOptions = command.parent?.opts() || {};
      const allOptions = { ...parentOptions, ...options };
      withTelemetry(
        { enabled: !allOptions.noTelemetry, options: allOptions },
        async () => {
          const batchSize = Number(allOptions.batchSize) || 1;
          const concurrency = Number(allOptions.concurrency) || 1;

          if (concurrency < 1 || batchSize < 1) {
            logger.error('Batch size and concurrency must be greater than 0');
            process.exit(1);
          }

          displayHeader();
          LocadexManager.initialize({
            mcpTransport: 'sse',
            metadata: {},
            cliOptions: allOptions,
            options: {
              ...(allOptions.matchingFiles && {
                matchingFiles: allOptions.matchingFiles
                  .split(',')
                  .map((file) => file.trim()),
              }),
              ...(allOptions.matchingExtensions && {
                matchingExtensions: allOptions.matchingExtensions
                  .split(',')
                  .map((ext) => ext.trim()),
              }),
              maxConcurrency: concurrency,
              batchSize,
            },
          });
          await setupCommand(
            !!allOptions.bypassPrompts,
            allOptions.packageManager
          );
        }
      );
    }
  );

program
  .command('i18n')
  .description('Run Locadex i18n on your project')
  .option('-v, --verbose', 'Verbose output')
  .option('-d, --debug', 'Debug output')
  .option('-b, --batch-size <number>', 'File batch size', '10')
  .option('-c, --concurrency <number>', 'Max number of concurrent agents', '1')
  .option(
    '-m, --matching-files <pattern>',
    'Comma-separated list of glob patterns to match source files'
  )
  .option(
    '-e, --matching-extensions <extensions>',
    'Comma-separated list of file extensions to match'
  )
  .option('--no-telemetry', 'Disable telemetry')
  .action((options: CliOptions, command: Command) => {
    const parentOptions = command.parent?.opts() || {};
    const allOptions = { ...parentOptions, ...options };
    withTelemetry(
      { enabled: !allOptions.noTelemetry, options: allOptions },
      async () => {
        const batchSize = Number(allOptions.batchSize) || 1;
        const concurrency = Number(allOptions.concurrency) || 1;

        if (concurrency < 1 || batchSize < 1) {
          logger.error('Batch size and concurrency must be greater than 0');
          process.exit(1);
        }

        displayHeader();
        LocadexManager.initialize({
          mcpTransport: 'sse',
          metadata: {},
          cliOptions: allOptions,
          options: {
            ...(allOptions.matchingFiles && {
              matchingFiles: allOptions.matchingFiles
                .split(',')
                .map((file) => file.trim()),
            }),
            ...(allOptions.matchingExtensions && {
              matchingExtensions: allOptions.matchingExtensions
                .split(',')
                .map((ext) => ext.trim()),
            }),
            maxConcurrency: concurrency,
            batchSize,
          },
        });
        await i18nCommand();
      }
    );
  });

main(program);

program.parse();
