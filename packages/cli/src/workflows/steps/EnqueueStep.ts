import type { EnqueueFilesResult } from 'generaltranslation/types';
import { logger } from '../../console/logger.js';
import type { ApiClient } from '../../utils/api.js';
import type { Settings } from '../../types/index.js';
import type { FileReference } from 'generaltranslation/types';
import chalk from 'chalk';

type EnqueueClient = Pick<ApiClient, 'enqueueFiles'>;

export class EnqueueStep {
  private spinner = logger.createSpinner('dots');

  constructor(
    private gt: EnqueueClient,
    private settings: Settings,
    private force?: boolean
  ) {}

  async run(files: FileReference[]): Promise<EnqueueFilesResult> {
    if (files.length === 0) {
      return {
        jobData: {},
        locales: this.settings.locales,
        message: 'No files need to be enqueued',
      };
    }

    this.spinner.start('Enqueuing translations...');

    const result = await this.gt.enqueueFiles(files, {
      sourceLocale: this.settings.defaultLocale,
      targetLocales: this.settings.locales,
      modelProvider: this.settings.modelProvider,
      force: this.force,
    });
    this.spinner.stop(chalk.green('Translations enqueued successfully'));
    return result;
  }
}
