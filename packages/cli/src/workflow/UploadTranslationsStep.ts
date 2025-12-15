import { WorkflowStep } from './Workflow.js';
import { logger } from '../console/logger.js';
import { GT } from 'generaltranslation';
import { Settings } from '../types/index.js';
import chalk from 'chalk';
import { BranchData } from '../types/branch.js';
import type { FileReference, FileUpload } from 'generaltranslation/types';

type UploadTranslationsInput = {
  files: {
    source: FileUpload;
    translations: FileUpload[];
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
      `Checking ${totalTranslations} translation file${totalTranslations !== 1 ? 's' : ''} against General Translation API...`
    );

    // Build the query for existing translation files
    const translatedFilesQuery = filesWithTranslations.flatMap((f) =>
      f.translations.map((t) => ({
        fileId: t.fileId || f.source.fileId || f.source.fileName,
        versionId: t.versionId || f.source.versionId || '',
        branchId:
          t.branchId || f.source.branchId || branchData.currentBranch.id,
        locale: t.locale,
      }))
    );

    const translatedFilesQueryWithLocale = translatedFilesQuery.filter(
      (t) => t.locale !== undefined
    ) as {
      fileId: string;
      versionId: string;
      branchId: string;
      locale: string;
    }[];

    // Query for existing translation files
    const fileData = await this.gt.queryFileData({
      translatedFiles: translatedFilesQueryWithLocale,
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
        const branchId = f.source.branchId || branchData.currentBranch.id;
        const fileId = f.source.fileId || f.source.fileName;
        const versionId = f.source.versionId || '';

        const newTranslations = f.translations.filter((t) => {
          const key = `${t.branchId || branchId}:${t.fileId || fileId}:${t.versionId || versionId}:${t.locale}`;
          return !existingTranslationsMap.has(key);
        });

        return {
          source: {
            ...f.source,
            branchId,
            locale: f.source.locale || this.settings.defaultLocale,
          },
          translations: newTranslations.map((t) => ({
            ...t,
            branchId: t.branchId || branchId,
          })),
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
    this.spinner.stop(
      chalk.dim(
        `Uploading ${uploadCount} translation files (${skippedCount} already exist)...`
      )
    );

    this.spinner.start(
      `Uploading ${uploadCount} translation file${uploadCount !== 1 ? 's' : ''} to General Translation API...`
    );

    const response = await this.gt.uploadTranslations(filesToUpload, {
      sourceLocale: this.settings.defaultLocale,
      modelProvider: this.settings.modelProvider,
    });

    this.result = response.uploadedFiles;
    this.spinner.stop(chalk.green('Translation files uploaded successfully'));

    return this.result;
  }

  async wait(): Promise<void> {
    return;
  }
}
