import { WorkflowStep } from './WorkflowStep.js';
import { logger } from '../../console/logger.js';
import { GT } from 'generaltranslation';
import type { PublishFileEntry } from 'generaltranslation/types';
import chalk from 'chalk';

export class PublishStep extends WorkflowStep<PublishFileEntry[], void> {
  private spinner = logger.createSpinner('dots');

  constructor(private gt: GT) {
    super();
  }

  async run(files: PublishFileEntry[]): Promise<void> {
    if (files.length === 0) return;

    this.spinner.start('Updating CDN...');

    try {
      const result = await this.gt.publishFiles(files);

      const failed = result.results.filter(
        (r: { success: boolean; error?: string }) => !r.success
      );
      if (failed.length > 0) {
        this.spinner.stop(chalk.yellow('CDN updated with errors'));
        for (const f of failed) {
          const file = files.find((p) => p.fileId === f.fileId);
          const name = file?.fileName ?? f.fileId;
          logger.warn(
            `Failed to update ${name}: ${f.error ?? 'unknown error'}`
          );
        }
      } else {
        this.spinner.stop(chalk.green('CDN updated'));
      }
    } catch (err) {
      this.spinner.stop(chalk.red('Failed to update CDN'));
      logger.warn(
        `Publish error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  async wait(): Promise<void> {
    return;
  }
}
