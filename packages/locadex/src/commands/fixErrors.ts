import { Command } from 'commander';
import { CliOptions } from '../types/cli.js';
import { withTelemetry } from '../telemetry.js';
import { LocadexManager } from '../utils/locadexManager.js';
import { displayHeader } from '../logging/console.js';
import path from 'node:path';
import { validateConfig } from '../utils/config.js';
import { fixErrorsTask } from '../tasks/fixErrors.js';

export async function fixErrorsCommand(options: CliOptions, command: Command) {
  const parentOptions = command.parent?.opts() || {};
  const allOptions = { ...parentOptions, ...options };
  const telemetryEnabled = !allOptions.noTelemetry;
  withTelemetry(
    { enabled: telemetryEnabled, options: allOptions },
    async () => {
      await validateConfig(allOptions);

      displayHeader(telemetryEnabled);
      LocadexManager.initialize({
        rootDirectory: process.cwd(),
        appDirectory: path.resolve(process.cwd(), allOptions.appDir),
        mcpTransport: 'stdio',
        apiKey: process.env.ANTHROPIC_API_KEY || '',
        metadata: {},
        cliOptions: allOptions,
        options: {
          ...(allOptions.matchingFiles && {
            matchingFiles: allOptions.matchingFiles
              .split(',')
              .map((file) => file.trim()),
          }),
          ...(allOptions.concurrency && {
            maxConcurrency: Number(allOptions.concurrency),
          }),
          ...(allOptions.batchSize && {
            batchSize: Number(allOptions.batchSize),
          }),
          ...(allOptions.timeout && {
            timeout: Number(allOptions.timeout),
          }),
        },
      });
      await fixErrorsTask();
    }
  );
}
