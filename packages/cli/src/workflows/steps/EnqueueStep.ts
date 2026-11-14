import { logger } from '../../console/logger.js';
import type { ProjectHandle, FileReference } from 'generaltranslation';
import type { Settings } from '../../types/index.js';
import type { TranslateFilesResponse } from '@generaltranslation/api';
import chalk from 'chalk';

type EnqueueClient = Pick<ProjectHandle, 'translateFiles'>;

type EnqueuedJob = TranslateFilesResponse['jobs'][number];

/** A queued job that translates one file version into one locale. */
export type FileTranslationJob = EnqueuedJob & {
  subject: Extract<EnqueuedJob['subject'], { type: 'file_translation' }>;
};

export class EnqueueStep {
  private spinner = logger.createSpinner('dots');

  constructor(
    private gt: EnqueueClient,
    private settings: Settings,
    private force?: boolean
  ) {}

  async run(files: FileReference[]): Promise<FileTranslationJob[]> {
    if (files.length === 0) return [];

    this.spinner.start('Enqueuing translations...');

    const { jobs } = await this.gt.translateFiles(files, {
      sourceLocale: this.settings.defaultLocale,
      targetLocales: this.settings.locales,
      modelProvider: this.settings.modelProvider,
      force: this.force,
    });
    this.spinner.stop(chalk.green('Translations enqueued successfully'));
    return jobs.filter(
      (job): job is FileTranslationJob =>
        job.subject.type === 'file_translation'
    );
  }
}
