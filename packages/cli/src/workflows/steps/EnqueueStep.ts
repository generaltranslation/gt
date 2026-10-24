import { logger } from '../../console/logger.js';
import type { ProjectHandle } from 'generaltranslation';
import type { Settings } from '../../types/index.js';
import type { FileReference } from 'generaltranslation/types';
import chalk from 'chalk';

type EnqueueClient = Pick<ProjectHandle, 'translateFiles'>;

export type EnqueueFilesResult = {
  jobData: {
    [jobId: string]: {
      fileId: string;
      versionId: string;
      branchId: string;
      targetLocale: string;
    };
  };
  message: string;
};

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
        message: 'No files need to be enqueued',
      };
    }

    this.spinner.start('Enqueuing translations...');

    const { jobs } = await this.gt.translateFiles(files, {
      sourceLocale: this.settings.defaultLocale,
      targetLocales: this.settings.locales,
      modelProvider: this.settings.modelProvider,
      force: this.force,
    });
    // Keyed by job ID in the shape the polling and download steps read.
    const jobData: EnqueueFilesResult['jobData'] = {};
    for (const { id, subject } of jobs) {
      if (subject.type !== 'file_translation') continue;
      jobData[id] = {
        fileId: subject.fileId,
        versionId: subject.versionId,
        branchId: subject.branchId,
        targetLocale: subject.locale,
      };
    }
    this.spinner.stop(chalk.green('Translations enqueued successfully'));
    return {
      jobData,
      message: `Successfully enqueued ${Object.keys(jobData).length} file translation jobs`,
    };
  }
}
