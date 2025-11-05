import { FileReference } from 'generaltranslation/types';
import { WorkflowStep } from './Workflow.js';
import { createSpinner } from '../console/logging.js';
import { GT } from 'generaltranslation';
import { Settings } from '../types/index.js';
import chalk from 'chalk';

export class SetupStep extends WorkflowStep<FileReference[], FileReference[]> {
  private spinner = createSpinner('dots');
  private setupJobId: string | null = null;
  private files: FileReference[] | null = null;
  private completed = false;

  constructor(
    private gt: GT,
    private settings: Settings,
    private timeoutMs: number
  ) {
    super();
  }

  async run(files: FileReference[]): Promise<FileReference[]> {
    this.files = files;
    this.spinner.start('Setting up project...');

    const result = await this.gt.setupProject(files, {
      locales: this.settings.locales,
    });

    if (result.status === 'completed') {
      this.completed = true;
      return files;
    }

    if (result.status === 'queued') {
      this.setupJobId = result.setupJobId;
      return files;
    }

    // Unknown status
    this.completed = true;
    return files;
  }

  async wait(): Promise<void> {
    if (this.completed) {
      this.spinner.stop(chalk.green('Setup successfully completed'));
      return;
    }

    if (!this.setupJobId) {
      this.spinner.stop(
        chalk.yellow('Setup status unknown — proceeding without setup')
      );
      return;
    }

    // Poll for completion
    const start = Date.now();
    const pollInterval = 5000; // 5 seconds

    while (Date.now() - start < this.timeoutMs) {
      const status = await this.gt.checkJobStatus([this.setupJobId]);

      if (!status[0]) {
        this.spinner.stop(
          chalk.yellow('Setup status unknown — proceeding without setup')
        );
        return;
      }

      if (status[0].status === 'completed') {
        this.spinner.stop(chalk.green('Setup successfully completed'));
        return;
      }

      if (status[0].status === 'failed') {
        this.spinner.stop(
          chalk.yellow(
            `Setup failed: ${status[0].error?.message || 'Unknown error'} — proceeding without setup`
          )
        );
        return;
      }

      await new Promise((r) => setTimeout(r, pollInterval));
    }

    // Timeout
    this.spinner.stop(
      chalk.yellow('Setup timed out — proceeding without setup')
    );
  }
}
