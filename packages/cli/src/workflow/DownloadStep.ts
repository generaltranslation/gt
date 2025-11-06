import chalk from 'chalk';
import { WorkflowStep } from './Workflow.js';
import { createProgressBar, logError, logWarning } from '../console/logging.js';
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
    this.spinner = createProgressBar(fileTracker.completed.size);
    this.spinner.start('Downloading files...');

    // Download ready files
    const success = await this.downloadFiles(
      fileTracker,
      resolveOutputPath,
      forceDownload
    );
    if (success) {
      this.spinner.stop(chalk.green('Downloaded files successfully'));
    } else {
      this.spinner.stop(chalk.red('Failed to download files'));
    }

    return success;
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
        const batchResult = await this.downloadFilesWithRetry(
          fileTracker,
          batchFiles,
          forceDownload
        );
        this.spinner?.stop(
          chalk.green(`Downloaded ${batchResult.successful.length} files`)
        );
        if (batchResult.failed.length > 0) {
          logWarning(
            `Failed to download ${batchResult.failed.length} files: ${batchResult.failed.map((f) => f.inputPath).join('\n')}`
          );
        }
      } else {
        this.spinner?.stop(chalk.green('No files to download'));
      }

      return true;
    } catch (error) {
      this.spinner?.stop(
        chalk.red('An error occurred while downloading translations')
      );
      logError(chalk.red('Error: ') + error);
      return false;
    }
  }

  private async downloadFilesWithRetry(
    fileTracker: FileStatusTracker,
    files: BatchedFiles,
    forceDownload?: boolean,
    maxRetries: number = 3,
    initialDelay: number = 1000
  ): Promise<{ successful: BatchedFiles; failed: BatchedFiles }> {
    let remainingFiles = files;
    let allSuccessful: BatchedFiles = [];
    let retryCount = 0;

    while (remainingFiles.length > 0 && retryCount < maxRetries) {
      const batchResult = await downloadFileBatch(
        fileTracker,
        remainingFiles,
        this.settings,
        forceDownload
      );

      allSuccessful = [...allSuccessful, ...batchResult.successful];
      this.spinner?.advance(allSuccessful.length);

      // If no failures or we've exhausted retries, we're done
      if (batchResult.failed.length === 0 || retryCount === maxRetries) {
        return {
          successful: allSuccessful,
          failed: batchResult.failed,
        };
      }

      // Calculate exponential backoff delay
      const delay = initialDelay * Math.pow(2, retryCount);
      logError(
        chalk.yellow(
          `Retrying ${batchResult.failed.length} failed file(s) in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})...`
        )
      );

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));

      remainingFiles = batchResult.failed;
      retryCount++;
    }

    return {
      successful: allSuccessful,
      failed: remainingFiles,
    };
  }

  async wait(): Promise<void> {
    return;
  }
}
