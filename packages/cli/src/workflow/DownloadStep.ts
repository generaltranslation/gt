import chalk from 'chalk';
import { WorkflowStep } from './Workflow.js';
import {
  createProgressBar,
  createSpinner,
  logError,
} from '../console/logging.js';
import { BatchedFiles, downloadFileBatch } from '../api/downloadFileBatch.js';
import { GT } from 'generaltranslation';
import { Settings } from '../types/index.js';
import { FileStatusTracker } from './PollJobsStep.js';

export type DownloadTranslationsInput = {
  fileTracker: FileStatusTracker;
  resolveOutputPath: (sourcePath: string, locale: string) => string | null;
  forceDownload?: boolean;
};

export class DownloadTranslationsStep extends WorkflowStep<
  DownloadTranslationsInput,
  boolean
> {
  private spinner: ReturnType<typeof createProgressBar> | null = null;

  constructor(
    private gt: GT,
    private settings: Settings
  ) {
    super();
  }

  async run({
    fileTracker,
    resolveOutputPath,
    forceDownload,
  }: DownloadTranslationsInput): Promise<boolean> {
    console.log();
    this.spinner = createProgressBar(fileTracker.completed.size);
    this.spinner.start('Downloading files...');

    try {
      // Download ready files
      const success = await this.downloadFiles(
        fileTracker,
        resolveOutputPath,
        forceDownload
      );

      if (success) {
        this.spinner.stop(chalk.green('Files downloaded!'));
      } else {
        this.spinner.stop(chalk.red('Failed to download some translations'));
      }

      return success;
    } catch (error) {
      this.spinner.stop(chalk.red('Error downloading translations'));
      logError(chalk.red('Error: ') + error);
      return false;
    }
  }

  private async downloadFiles(
    fileTracker: FileStatusTracker,
    resolveOutputPath: (sourcePath: string, locale: string) => string | null,
    forceDownload?: boolean
  ): Promise<boolean> {
    try {
      // Only download files that are marked as completed
      const currentQueryData = Array.from(fileTracker.completed.values());

      // If no files to download, we're done
      if (currentQueryData.length === 0) {
        return true;
      }

      // Check for translations
      const responseData = await this.gt.queryFileData({
        translatedFiles: currentQueryData.map((item) => ({
          fileId: item.fileId,
          versionId: item.versionId,
          branchId: item.branchId,
          locale: item.locale,
        })),
      });
      const translatedFiles = responseData.translatedFiles || [];

      // Filter for ready translations
      const readyTranslations = translatedFiles.filter(
        (file) => file.completedAt !== null
      );

      // Prepare batch download data
      const batchFiles: BatchedFiles = readyTranslations
        .map((translation) => {
          const fileKey = `${translation.branchId}:${translation.fileId}:${translation.versionId}:${translation.locale}`;

          const fileProperties = fileTracker.completed.get(fileKey);
          if (!fileProperties) {
            return null;
          }
          const outputPath = resolveOutputPath(
            fileProperties.fileName,
            translation.locale
          );

          // Skip downloading GTJSON files that are not in the files configuration
          if (outputPath === null) {
            fileTracker.completed.delete(fileKey);
            fileTracker.skipped.set(fileKey, fileProperties);
            return null;
          }
          return {
            branchId: translation.branchId,
            fileId: translation.fileId,
            versionId: translation.versionId,
            locale: translation.locale,
            inputPath: fileProperties.fileName,
            outputPath,
          };
        })
        .filter((file) => file !== null) as BatchedFiles;

      if (batchFiles.length > 0) {
        const batchResult = await downloadFileBatch(
          fileTracker,
          batchFiles,
          this.settings,
          forceDownload
        );

        this.spinner?.advance(
          batchResult.failed.length + batchResult.successful.length
        );
      }

      // Check if there were any failures
      if (fileTracker.failed.size > 0) {
        return false;
      }

      return true;
    } catch (error) {
      logError(chalk.red('Error downloading translations: ') + error);
      return false;
    }
  }

  async wait(): Promise<void> {
    return;
  }
}
