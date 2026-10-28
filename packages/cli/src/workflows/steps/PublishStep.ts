import { logger } from '../../console/logger.js';
import { recordWarning } from '../../state/translateWarnings.js';
import type { PublishFileEntry, ProjectHandle } from 'generaltranslation';
import chalk from 'chalk';

export class PublishStep {
  private spinner = logger.createSpinner('dots');

  constructor(private api: ProjectHandle) {}

  /** Returns false when the publish request itself fails. */
  async run(
    files: (PublishFileEntry & { fileName: string })[]
  ): Promise<boolean> {
    if (files.length === 0) return true;

    this.spinner.start('Updating CDN...');

    try {
      const result = await this.api.publishFiles(files);

      // Results follow request order; a version fails when any of its
      // translations fails, so report each failed translation by locale.
      const failures = result.results.flatMap((r, index) => {
        if (r.status !== 'failed') return [];
        const name = files[index]?.fileName ?? r.fileId;
        const failedTranslations = r.translations.filter(
          (t) => t.status === 'failed'
        );
        return failedTranslations.length > 0
          ? failedTranslations.map((t) => ({
              name,
              reason: `Locale ${t.locale}: ${t.error ?? r.error ?? 'Unknown error'}`,
            }))
          : [{ name, reason: r.error ?? 'Unknown error' }];
      });
      if (failures.length > 0) {
        this.spinner.stop(chalk.yellow('CDN updated with errors'));
        for (const { name, reason } of failures) {
          logger.warn(`Failed to update ${name}: ${reason}`);
          recordWarning('failed_publish', name, reason);
        }
      } else {
        this.spinner.stop(chalk.green('CDN updated'));
      }
      return true;
    } catch (err) {
      this.spinner.stop(chalk.red('Failed to update CDN'));
      logger.warn(
        `Publish error: ${err instanceof Error ? err.message : String(err)}`
      );
      return false;
    }
  }
}
