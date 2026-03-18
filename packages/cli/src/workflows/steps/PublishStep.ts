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
    const filesToPublish = files.filter((f) => f.publish);

    if (filesToPublish.length === 0) return;

    this.spinner.start(
      `Publishing ${filesToPublish.length} file${filesToPublish.length !== 1 ? 's' : ''} to CDN...`
    );

    try {
      const result = await this.gt.publishFiles(filesToPublish);

      const failed = result.results.filter(
        (r: { success: boolean; error?: string }) => !r.success
      );
      if (failed.length > 0) {
        this.spinner.stop(
          chalk.yellow(
            `Published ${filesToPublish.length - failed.length}/${filesToPublish.length} files (${failed.length} failed)`
          )
        );
        for (const f of failed) {
          logger.warn(
            `Failed to publish ${f.fileId}: ${f.error ?? 'unknown error'}`
          );
        }
      } else {
        this.spinner.stop(
          chalk.green(
            `${filesToPublish.length} file${filesToPublish.length !== 1 ? 's' : ''} published to CDN`
          )
        );
      }
    } catch (err) {
      this.spinner.stop(chalk.red('Failed to publish files to CDN'));
      logger.warn(
        `Publish error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  async wait(): Promise<void> {
    return;
  }
}
