import { WorkflowStep } from './WorkflowStep.js';
import { logger } from '../../console/logger.js';
import { GT } from 'generaltranslation';
import { Settings } from '../../types/index.js';
import chalk from 'chalk';
import { BranchData } from '../../types/branch.js';
import type { FileReference, FileToUpload } from 'generaltranslation/types';

type UploadTranslationsInput = {
  files: {
    source: FileToUpload;
    translations: FileToUpload[];
  }[];
  branchData: BranchData;
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

  async run({
    files,
    branchData,
  }: UploadTranslationsInput): Promise<FileReference[]> {
    // Filter to only files that have translations
    const filesWithTranslations = files.filter(
      (f) => f.translations.length > 0
    );

    if (filesWithTranslations.length === 0) {
      logger.info(
        'No translation files to upload... skipping upload translations step'
      );
      return [];
    }

    const totalTranslations = filesWithTranslations.reduce(
      (acc, f) => acc + f.translations.length,
      0
    );

    this.spinner.start(
      `Syncing ${totalTranslations} translation file${totalTranslations !== 1 ? 's' : ''} with General Translation API...`
    );

    // Build the query for existing translation files
    const translatedFilesQuery = filesWithTranslations.flatMap((f) =>
      f.translations.map((t) => ({
        fileId: t.fileId,
        versionId: t.versionId,
        branchId: t.branchId ?? branchData.currentBranch.id,
        locale: t.locale,
      }))
    );

    // Query for existing translation files
    const fileData = await this.gt.queryFileData({
      translatedFiles: translatedFilesQuery,
    });

    // Build a map of existing translations: branchId:fileId:versionId:locale
    const existingTranslationsMap = new Set<string>();
    fileData.translatedFiles?.forEach((f) => {
      existingTranslationsMap.add(
        `${f.branchId}:${f.fileId}:${f.versionId}:${f.locale}`
      );
    });

    // Filter out translations that already exist
    const filesToUpload = filesWithTranslations
      .map((f) => {
        const newTranslations = f.translations.filter((t) => {
          const branchId = t.branchId ?? branchData.currentBranch.id;
          const key = `${branchId}:${t.fileId}:${t.versionId}:${t.locale}`;
          return !existingTranslationsMap.has(key);
        });

        return {
          source: f.source,
          translations: newTranslations,
        };
      })
      .filter((f) => f.translations.length > 0);

    const skippedCount =
      totalTranslations -
      filesToUpload.reduce((acc, f) => acc + f.translations.length, 0);

    if (filesToUpload.length === 0) {
      this.spinner.stop(
        chalk.green(
          `All ${totalTranslations} translation files already uploaded`
        )
      );
      return [];
    }

    const uploadCount = filesToUpload.reduce(
      (acc, f) => acc + f.translations.length,
      0
    );

    const response = await this.gt.uploadTranslations(filesToUpload, {
      sourceLocale: this.settings.defaultLocale,
      modelProvider: this.settings.modelProvider,
    });

    this.result = response.uploadedFiles;
    this.spinner.stop(
      chalk.green(
        `Translation files synced successfully! Uploaded: (${uploadCount}), Skipped: (${skippedCount})`
      )
    );

    return this.result;
  }

  async wait(): Promise<void> {
    return;
  }
}
