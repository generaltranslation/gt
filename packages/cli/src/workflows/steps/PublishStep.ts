import { logger } from '../../console/logger.js';
import type { PublishFileEntry } from 'generaltranslation/types';
import type { ApiClient } from '../../utils/api.js';
import chalk from 'chalk';

/** A file the CDN did not publish or unpublish, and why. */
export type PublishFailure = {
  fileName: string;
  publish: boolean;
  reason: string;
};

export class PublishStep {
  private spinner = logger.createSpinner('dots');

  constructor(private api: ApiClient) {}

  /** Updates the CDN and returns the files it could not update. */
  async run(files: PublishFileEntry[]): Promise<PublishFailure[]> {
    if (files.length === 0) return [];

    this.spinner.start('Updating CDN...');

    try {
      const result = await this.api.publishFiles(files);

      const failed = result.results.filter(
        (r: { success: boolean; error?: string }) => !r.success
      );
      if (failed.length > 0) {
        this.spinner.stop(chalk.red('CDN updated with errors'));
        return failed.map((f) => {
          const file = files.find((p) => p.fileId === f.fileId);
          return {
            fileName: file?.fileName ?? f.fileId,
            publish: file?.publish ?? true,
            reason: f.error ?? 'unknown error',
          };
        });
      }
      this.spinner.stop(chalk.green('CDN updated'));
      return [];
    } catch (err) {
      this.spinner.stop(chalk.red('Failed to update CDN'));
      const reason = err instanceof Error ? err.message : String(err);
      return files.map((file) => ({
        fileName: file.fileName ?? file.fileId,
        publish: file.publish,
        reason,
      }));
    }
  }
}
