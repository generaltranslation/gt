import type { EnqueueFilesResult } from 'generaltranslation/types';
import { WorkflowStep } from './WorkflowStep.js';
import { logger } from '../../console/logger.js';
import { GT } from 'generaltranslation';
import { Settings } from '../../types/index.js';
import type { FileReference } from 'generaltranslation/types';
import { ApiError } from 'generaltranslation/errors';
import chalk from 'chalk';

const EMPTY_ENQUEUE_RESULT: EnqueueFilesResult = {
  jobData: {},
  locales: [],
  message: 'Enqueue skipped due to insufficient credits.',
};

export class EnqueueStep extends WorkflowStep<
  FileReference[],
  EnqueueFilesResult
> {
  private spinner = logger.createSpinner('dots');
  private result: EnqueueFilesResult | null = null;
  private skippedDueToPayment = false;

  constructor(
    private gt: GT,
    private settings: Settings,
    private force?: boolean,
    private skipOnPaymentError?: boolean
  ) {
    super();
  }

  async run(files: FileReference[]): Promise<EnqueueFilesResult> {
    this.spinner.start('Enqueuing translations...');

    try {
      this.result = await this.gt.enqueueFiles(files, {
        sourceLocale: this.settings.defaultLocale,
        targetLocales: this.settings.locales,
        requireApproval: this.settings.stageTranslations,
        modelProvider: this.settings.modelProvider,
        force: this.force,
      });
    } catch (error) {
      if (
        this.skipOnPaymentError &&
        error instanceof ApiError &&
        error.code === 402
      ) {
        this.skippedDueToPayment = true;
        this.result = EMPTY_ENQUEUE_RESULT;
        return this.result;
      }
      throw error;
    }

    return this.result;
  }

  async wait(): Promise<void> {
    if (this.skippedDueToPayment) {
      this.spinner.stop(
        chalk.yellow(
          'Enqueue skipped: insufficient credits. Files that were not enqueued have been treated as skipped.'
        )
      );
    } else if (this.result) {
      this.spinner.stop(chalk.green('Translations enqueued successfully'));
    }
  }
}
