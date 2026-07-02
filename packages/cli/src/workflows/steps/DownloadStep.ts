import chalk from 'chalk';
import path from 'node:path';
import { WorkflowStep } from './WorkflowStep.js';
import { logger } from '../../console/logger.js';
import {
  BatchedFiles,
  downloadFileBatch,
  DownloadFileBatchResult,
} from '../../api/downloadFileBatch.js';
import { GT } from 'generaltranslation';
import { Settings } from '../../types/index.js';
import { recordWarning } from '../../state/translateWarnings.js';
import { FileStatusTracker } from './PollJobsStep.js';
import { TEMPLATE_FILE_NAME } from '../../utils/constants.js';
import {
  getFileTranslationKey,
  queryCompletedTranslationKeys,
} from '../utils/queryCompletedTranslations.js';

export type DownloadTranslationsInput = {
  fileTracker: FileStatusTracker;
  resolveOutputPath: (sourcePath: string, locale: string) => string | null;
  forceDownload?: boolean;
  skipTranslationCheck?: boolean;
};

export class DownloadTranslationsStep extends WorkflowStep<
  DownloadTranslationsInput,
  boolean
> {
  private spinner: ReturnType<typeof logger.createProgressBar> | null = null;

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
    skipTranslationCheck,
  }: DownloadTranslationsInput): Promise<boolean> {
    this.spinner = logger.createProgressBar(fileTracker.completed.size);
    this.spinner.start('Downloading files...');

    try {
      // Only download files that are marked as completed
      const currentQueryData = Array.from(fileTracker.completed.values());

      // If no files to download, we're done
      if (currentQueryData.length === 0) {
        this.spinner?.stop(chalk.green('No files to download'));
        return true;
      }

      const requiresReviewPaths =
        this.settings.files?.requiresReviewPaths ?? new Set<string>();
      let readyTranslations: Awaited<
        ReturnType<GT['queryFileData']>
      >['translatedFiles'] = [];
      let readyKeys: Set<string> | undefined;

      if (requiresReviewPaths.size > 0) {
        const responseData = await this.gt.queryFileData({
          translatedFiles: currentQueryData.map((item) => ({
            fileId: item.fileId,
            versionId: item.versionId,
            branchId: item.branchId,
            locale: item.locale,
          })),
        });
        readyTranslations = (responseData.translatedFiles || []).filter(
          (file) => file.completedAt !== null
        );
        readyKeys = new Set(readyTranslations.map(getFileTranslationKey));
      } else if (!skipTranslationCheck) {
        readyKeys = await queryCompletedTranslationKeys(
          this.gt,
          currentQueryData
        );
      }

      const readyFiles = readyKeys
        ? currentQueryData.filter((file) =>
            readyKeys.has(getFileTranslationKey(file))
          )
        : currentQueryData;
      let missingCount = 0;

      if (readyKeys && readyFiles.length < currentQueryData.length) {
        const missing = currentQueryData.filter(
          (item) => !readyKeys.has(getFileTranslationKey(item))
        );
        missingCount = missing.length;
        logger.warn(
          `Failed to download ${missing.length} file(s):\n${missing.map((f) => `- ${f.fileName} (${f.locale})`).join('\n')}`
        );
        for (const f of missing) {
          recordWarning(
            'failed_download',
            f.fileName,
            `Failed to download for locale ${f.locale}`
          );
        }
      }

      // Review gating: skip completed translations for normal files whose
      // effective requiresReview policy is true but that are not approved
      // yet. Skips are intentional, not failures — a review-gated file is
      // simply absent locally and falls back to source behavior.
      // GTJSON is exempt: it is always requested, and the platform filters
      // unapproved components out of the served content itself.
      const reviewGatedKeys = new Set<string>();
      if (requiresReviewPaths.size > 0) {
        for (const translation of readyTranslations) {
          if (translation.approvedAt !== null) continue;
          const fileKey = `${translation.branchId}:${translation.fileId}:${translation.versionId}:${translation.locale}`;
          const fileProperties = fileTracker.completed.get(fileKey);
          if (!fileProperties) continue;
          if (fileProperties.fileName === TEMPLATE_FILE_NAME) continue;
          const absolutePath = path.resolve(
            process.cwd(),
            fileProperties.fileName
          );
          if (!requiresReviewPaths.has(absolutePath)) continue;
          reviewGatedKeys.add(fileKey);
          fileTracker.completed.delete(fileKey);
          fileTracker.skipped.set(fileKey, fileProperties);
          recordWarning(
            'pending_review',
            fileProperties.fileName,
            `Translation for locale ${translation.locale} requires review and is not approved yet`
          );
        }
        if (reviewGatedKeys.size > 0) {
          logger.info(
            `Skipped ${reviewGatedKeys.size} file(s) awaiting review approval. They will download once approved.`
          );
        }
      }

      // Prepare batch download data
      const batchFiles: BatchedFiles = [];
      for (const file of readyFiles) {
        const fileKey = getFileTranslationKey(file);
        if (reviewGatedKeys.has(fileKey)) continue;

        const outputPath = resolveOutputPath(file.fileName, file.locale);
        if (outputPath === null) {
          fileTracker.completed.delete(fileKey);
          fileTracker.skipped.set(fileKey, file);
          continue;
        }
        batchFiles.push({
          branchId: file.branchId,
          fileId: file.fileId,
          versionId: file.versionId,
          locale: file.locale,
          inputPath: file.fileName,
          outputPath,
          componentCount: file.componentCount,
        });
      }

      if (batchFiles.length > 0) {
        const batchResult = await this.downloadFilesWithRetry(
          batchFiles,
          forceDownload
        );
        this.spinner?.stop(
          chalk.green(
            `Downloaded ${batchResult.successful.length} files${batchResult.skipped.length > 0 ? `, skipped ${batchResult.skipped.length} files` : ''}`
          )
        );
        if (batchResult.failed.length > 0) {
          logger.warn(
            `Failed to download ${batchResult.failed.length} files: ${batchResult.failed.map((f) => f.inputPath).join('\n')}`
          );
          for (const f of batchResult.failed) {
            recordWarning(
              'failed_download',
              f.inputPath,
              `Failed to download for locale ${f.locale}`
            );
          }
        }
      } else if (missingCount > 0) {
        this.spinner?.stop(
          chalk.yellow('No files downloaded - see warnings above')
        );
      } else {
        this.spinner?.stop(chalk.green('No files to download'));
      }

      return true;
    } catch (error) {
      this.spinner?.stop(
        chalk.red('An error occurred while downloading translations')
      );
      logger.error(chalk.red('Error: ') + error);
      return false;
    }
  }

  private async downloadFilesWithRetry(
    files: BatchedFiles,
    forceDownload?: boolean,
    maxRetries: number = 3,
    initialDelay: number = 1000
  ): Promise<DownloadFileBatchResult> {
    let remainingFiles = files;
    let allSuccessful: BatchedFiles = [];
    let retryCount = 0;
    let allSkipped: BatchedFiles = [];
    while (remainingFiles.length > 0 && retryCount <= maxRetries) {
      const batchResult = await downloadFileBatch(
        remainingFiles,
        this.settings,
        forceDownload
      );

      allSuccessful = [...allSuccessful, ...batchResult.successful];
      allSkipped = [...allSkipped, ...batchResult.skipped];

      this.spinner?.advance(
        batchResult.successful.length +
          batchResult.skipped.length +
          batchResult.failed.length
      );

      // If no failures or we've exhausted retries, we're done
      if (batchResult.failed.length === 0 || retryCount === maxRetries) {
        return {
          successful: allSuccessful,
          failed: batchResult.failed,
          skipped: allSkipped,
        };
      }

      // Calculate exponential backoff delay
      const delay = initialDelay * Math.pow(2, retryCount);
      logger.error(
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
      skipped: allSkipped,
    };
  }

  async wait(): Promise<void> {
    return;
  }
}
