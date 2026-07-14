import { WorkflowStep } from './WorkflowStep.js';
import { logger } from '../../console/logger.js';
import { GT } from 'generaltranslation';
import { Settings } from '../../types/index.js';
import chalk from 'chalk';
import type { FileReference, FileToUpload } from 'generaltranslation/types';

type UploadTranslationsInput = {
  files: {
    source: FileToUpload;
    translations: FileToUpload[];
  }[];
};

export class UploadTranslationsStep extends WorkflowStep<
  UploadTranslationsInput,
  FileReference[]
> {
  private spinner = logger.createSpinner('dots');
  private result: FileReference[] = [];

  constructor(
    private gt: GT,
    private settings: Settings
  ) {
    super();
  }

  async run({ files }: UploadTranslationsInput): Promise<FileReference[]> {
    // Filter to only files that have translations
    const filesToUpload = files.filter((f) => f.translations.length > 0);

    if (filesToUpload.length === 0) {
      logger.info(
        'No translation files to upload... skipping upload translations step'
      );
      return [];
    }

    const totalTranslations = filesToUpload.reduce(
      (acc, f) => acc + f.translations.length,
      0
    );

    this.spinner.start(
      `Uploading ${totalTranslations} translation file${totalTranslations !== 1 ? 's' : ''} to the General Translation API...`
    );

    // Local translation files are the source of truth: upload every resolved
    // translation file. The upload endpoint is an upsert, so translations
    // that already exist on the platform are overwritten.
    const response = await this.gt.uploadTranslations(filesToUpload, {
      sourceLocale: this.settings.defaultLocale,
      modelProvider: this.settings.modelProvider,
    });

    this.result = response.uploadedFiles;
    this.spinner.stop(
      chalk.green(
        `Uploaded ${totalTranslations} translation file${totalTranslations !== 1 ? 's' : ''}`
      )
    );

    return this.result;
  }

  async wait(): Promise<void> {
    return;
  }
}
