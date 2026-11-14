import chalk from 'chalk';
import path from 'node:path';
import { logger } from '../../console/logger.js';
import {
  BatchedFiles,
  downloadFileBatch,
  DownloadFileBatchResult,
} from '../../api/downloadFileBatch.js';
import type { ProjectHandle } from 'generaltranslation';
import { Settings } from '../../types/index.js';
import { recordWarning } from '../../state/translateWarnings.js';
import { FileStatusTracker } from './PollJobsStep.js';
import { TEMPLATE_FILE_NAME } from '../../utils/constants.js';
import type { InlineLibrary } from '../../types/libraries.js';
import {
  retryTransientRead,
  TRANSIENT_READ_RETRIES,
  transientReadDelay,
  wait,
} from '../utils/retryTransientRead.js';

export type DownloadTranslationsInput = {
  fileTracker: FileStatusTracker;
  resolveOutputPath: (sourcePath: string, locale: string) => string | null;
  forceDownload?: boolean;
};

export class DownloadTranslationsStep {
  private spinner: ReturnType<typeof logger.createProgressBar> | null = null;

  constructor(
    private api: ProjectHandle,
    private settings: Settings,
    private inlineLibrary?: InlineLibrary
  ) {}

  async run({
    fileTracker,
    resolveOutputPath,
    forceDownload,
  }: DownloadTranslationsInput): Promise<boolean> {
    this.spinner = logger.createProgressBar(fileTracker.completed.size);
    this.spinner.start('Downloading files...');

    return this.downloadFiles(fileTracker, resolveOutputPath, forceDownload);
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
        this.spinner?.stop(chalk.green('No files to download'));
        return true;
      }

      // Check for translations
      const { results } = await retryTransientRead(() =>
        this.api.queryFiles(currentQueryData)
      );

      // Filter for ready translations; results follow the selector order
      const isReady = (index: number) =>
        results[index]?.status === 'found' && !!results[index].completedAt;
      const readyTranslations = currentQueryData.flatMap((item, index) =>
        isReady(index)
          ? [{ ...item, approvedAt: results[index].approvedAt }]
          : []
      );
      let missingCount = 0;

      if (readyTranslations.length < currentQueryData.length) {
        const missing = currentQueryData.filter((_, index) => !isReady(index));
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
      const requiresReviewPaths =
        this.settings.files?.requiresReviewPaths ?? new Set<string>();
      const reviewGatedKeys = new Set<string>();
      if (requiresReviewPaths.size > 0) {
        for (const translation of readyTranslations) {
          if (translation.approvedAt) continue;
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

  /** Requests pending files and transient read failures again; failed files are final. */
  private async downloadFilesWithRetry(
    fileTracker: FileStatusTracker,
    files: BatchedFiles,
    forceDownload?: boolean
  ): Promise<Omit<DownloadFileBatchResult, 'retryable'>> {
    const successful: BatchedFiles = [];
    const skipped: BatchedFiles = [];
    const failed: BatchedFiles = [];
    let remainingFiles = files;
    for (let retry = 0; ; retry++) {
      const batchResult = await downloadFileBatch(
        fileTracker,
        remainingFiles,
        this.settings,
        forceDownload,
        this.inlineLibrary
      );
      successful.push(...batchResult.successful);
      skipped.push(...batchResult.skipped);
      failed.push(...batchResult.failed);
      remainingFiles = batchResult.retryable;

      this.spinner?.advance(
        batchResult.successful.length +
          batchResult.skipped.length +
          batchResult.failed.length
      );
      if (remainingFiles.length === 0 || retry === TRANSIENT_READ_RETRIES) {
        // Files still retryable after the last retry did not download
        failed.push(...remainingFiles);
        this.spinner?.advance(remainingFiles.length);
        return { successful, failed, skipped };
      }

      const delay = transientReadDelay(retry);
      logger.error(
        chalk.yellow(
          `Retrying ${remainingFiles.length} file(s) in ${delay}ms (attempt ${retry + 1}/${TRANSIENT_READ_RETRIES})...`
        )
      );
      await wait(delay);
    }
  }
}
