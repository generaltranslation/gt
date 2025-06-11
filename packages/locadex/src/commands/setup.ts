import { Command } from 'commander';
import { logger } from '../logging/logger.js';
import { setupTask } from '../tasks/setup.js';
import { CliOptions } from '../types/cli.js';
import { withTelemetry } from '../telemetry.js';
import { LocadexManager } from '../utils/locadexManager.js';
import { displayHeader } from '../logging/console.js';
import { exit } from '../utils/shutdown.js';

export async function setupCommand(
  options: CliOptions & {
    packageManager?: string;
    bypassPrompts?: boolean;
  },
  command: Command
) {
  const parentOptions = command.parent?.opts() || {};
  const allOptions = { ...parentOptions, ...options };
  const telemetryEnabled = !allOptions.noTelemetry;
  withTelemetry(
    { enabled: telemetryEnabled, options: allOptions },
    async () => {
      const batchSize = Number(allOptions.batchSize) || 1;
      const concurrency = Number(allOptions.concurrency) || 1;

      if (concurrency < 1 || batchSize < 1) {
        logger.error('Batch size and concurrency must be greater than 0');
        await exit(1);
      }

      displayHeader(telemetryEnabled);
      LocadexManager.initialize({
        mcpTransport: 'sse',
        apiKey: process.env.ANTHROPIC_API_KEY || '',
        metadata: {},
        cliOptions: allOptions,
        options: {
          ...(allOptions.matchingFiles && {
            matchingFiles: allOptions.matchingFiles
              .split(',')
              .map((file) => file.trim()),
          }),
          maxConcurrency: concurrency,
          batchSize,
        },
      });
      await setupTask(!!allOptions.bypassPrompts, allOptions.packageManager);
    }
  );
}
