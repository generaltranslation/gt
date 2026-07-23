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

    // Poll for completion
    const start = Date.now();
    const pollInterval = 5000; // 5 seconds

    while (Date.now() - start < this.timeoutMs) {
      const status = await this.gt.checkJobStatus([result.setupJobId]);

      if (!status[0]) {
        this.spinner.stop(
          chalk.yellow('Setup status unknown — proceeding without setup')
        );
        return files;
      }

      if (status[0].status === 'completed') {
        this.spinner.stop(chalk.green('Setup successfully completed'));
        return files;
      }

      if (status[0].status === 'failed') {
        this.spinner.stop(
          chalk.yellow(
            `Setup failed: ${status[0].error?.message || 'Unknown error'} — proceeding without setup`
          )
        );
        return files;
      }

      await new Promise((r) => setTimeout(r, pollInterval));
    }

    // Timeout
    this.spinner.stop(
      chalk.yellow('Setup timed out — proceeding without setup')
    );
    return files;
  }
}
