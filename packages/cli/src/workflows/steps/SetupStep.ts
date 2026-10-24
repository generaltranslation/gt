import type { FileReference } from 'generaltranslation/types';
import { logger } from '../../console/logger.js';
import type { ProjectHandle } from 'generaltranslation';
import type { Settings } from '../../types/index.js';
import chalk from 'chalk';

type SetupClient = Pick<ProjectHandle, 'generateProjectContext' | 'awaitJobs'>;

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

    const { job: setupJob } = await this.gt.generateProjectContext(files, {
      locales: this.settings.locales,
      force,
    });

    // No job: the project context is already current
    if (!setupJob) {
      this.spinner.stop(chalk.green('Setup successfully completed'));
      return files;
    }

    const { complete, jobs } = await this.gt.awaitJobs([setupJob.id], {
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
          `Setup failed: ${job.error || 'Unknown error'} — proceeding without setup`
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
