import type { FileReference } from 'generaltranslation/types';
import { ApiError } from 'generaltranslation/errors';
import { logger } from '../../console/logger.js';
import type { ApiClient } from '../../utils/api.js';
import type { Settings } from '../../types/index.js';
import chalk from 'chalk';

type SetupClient = Pick<ApiClient, 'setupProject' | 'awaitJobs'>;

export class SetupStep {
  private spinner = logger.createSpinner('dots');

  constructor(
    private gt: SetupClient,
    private settings: Settings,
    private timeoutMs: number
  ) {}

  async run(
    files: FileReference[],
    force: boolean = false
  ): Promise<FileReference[]> {
    this.spinner.start('Setting up project...');

    if (files.length === 0) {
      this.spinner.stop(chalk.green('Setup successfully completed'));
      return [];
    }

    let result: Awaited<ReturnType<SetupClient['setupProject']>>;
    try {
      result = await this.gt.setupProject(files, {
        locales: this.settings.locales,
        force,
      });
    } catch (error) {
      // Translation can run without generated context, so a failed setup
      // request warns and continues, as a failed setup job already does.
      // The reason goes to logger.warn because --quiet hides spinner text.
      this.spinner.stop(chalk.yellow('Setup request failed'));
      logger.warn(
        error instanceof ApiError && error.code === 403
          ? 'Setup permission denied: setup needs project:context:write, proceeding without generated context'
          : `Setup failed: ${error instanceof Error ? error.message : String(error)}, proceeding without setup`
      );
      return files;
    }

    if (result.status === 'completed') {
      this.spinner.stop(chalk.green('Setup successfully completed'));
      return files;
    }

    if (result.status !== 'queued' || !result.setupJobId) {
      this.spinner.stop(
        chalk.yellow('Setup status unknown — proceeding without setup')
      );
      return files;
    }

    const { complete, jobs } = await this.gt.awaitJobs([result.setupJobId], {
      pollingIntervalSeconds: 5,
      timeoutSeconds: this.timeoutMs / 1000,
    });
    const [job] = jobs;

    if (!complete) {
      this.spinner.stop(
        chalk.yellow('Setup timed out — proceeding without setup')
      );
    } else if (job?.status === 'completed') {
      this.spinner.stop(chalk.green('Setup successfully completed'));
    } else if (job?.status === 'failed') {
      this.spinner.stop(
        chalk.yellow(
          `Setup failed: ${job.error?.message || 'Unknown error'} — proceeding without setup`
        )
      );
    } else {
      this.spinner.stop(
        chalk.yellow('Setup status unknown — proceeding without setup')
      );
    }
    return files;
  }
}
