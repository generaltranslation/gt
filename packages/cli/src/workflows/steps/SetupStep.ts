import { FileReference } from 'generaltranslation/types';
import { logger } from '../../console/logger.js';
import { GT } from 'generaltranslation';
import { Settings } from '../../types/index.js';
import chalk from 'chalk';

export class SetupStep {
  private spinner = logger.createSpinner('dots');

  constructor(
    private gt: GT,
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

    const result = await this.gt.setupProject(files, {
      locales: this.settings.locales,
      force,
    });

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
