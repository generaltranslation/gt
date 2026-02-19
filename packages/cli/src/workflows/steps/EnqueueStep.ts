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

  constructor(
    private gt: GT,
    private settings: Settings,
    private force?: boolean
  ) {
    super();
  }

  async run(files: FileReference[]): Promise<EnqueueFilesResult> {
    this.spinner.start('Enqueuing translations...');

    this.result = await this.gt.enqueueFiles(files, {
      sourceLocale: this.settings.defaultLocale,
      targetLocales: this.settings.locales,
      publish: this.settings.publish,
      requireApproval: this.settings.stageTranslations,
      modelProvider: this.settings.modelProvider,
      force: this.force,
    });

    return this.result;
  }

  async wait(): Promise<void> {
    if (this.result) {
      this.spinner.stop(chalk.green('Translations enqueued successfully'));
    }
  }
}
