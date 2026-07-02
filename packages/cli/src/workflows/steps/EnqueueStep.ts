import type { EnqueueFilesResult } from 'generaltranslation/types';
import { WorkflowStep } from './WorkflowStep.js';
import { logger } from '../../console/logger.js';
import { GT } from 'generaltranslation';
import { Settings } from '../../types/index.js';
import type { FileReference } from 'generaltranslation/types';
import chalk from 'chalk';

export class EnqueueStep extends WorkflowStep<
  FileReference[],
  EnqueueFilesResult
> {
  private spinner = logger.createSpinner('dots');
  private result: EnqueueFilesResult | null = null;
  private spinnerStarted = false;

  constructor(
    private gt: GT,
    private settings: Settings,
    private force?: boolean
  ) {
    super();
  }

  async run(files: FileReference[]): Promise<EnqueueFilesResult> {
    if (files.length === 0) {
      this.result = {
        jobData: {},
        locales: this.settings.locales,
        message: 'No files need to be enqueued',
      };
      return this.result;
    }

    this.spinner.start('Enqueuing translations...');
    this.spinnerStarted = true;

    this.result = await this.gt.enqueueFiles(files, {
      sourceLocale: this.settings.defaultLocale,
      targetLocales: this.settings.locales,
      modelProvider: this.settings.modelProvider,
      force: this.force,
    });

    return this.result;
  }

  async wait(): Promise<void> {
    if (this.result && this.spinnerStarted) {
      this.spinner.stop(chalk.green('Translations enqueued successfully'));
    }
  }
}
