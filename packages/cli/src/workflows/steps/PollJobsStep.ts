import chalk from 'chalk';
import { pollJobs, type JobResult } from 'generaltranslation/api';
import { logger } from '../../console/logger.js';
import type { ApiClient } from '../../utils/api.js';
import { EnqueueFilesResult } from 'generaltranslation/types';
import { TEMPLATE_FILE_NAME } from '../../utils/constants.js';
import type { FileProperties } from '../../types/files.js';
import {
  getFileTranslationKey,
  queryCompletedTranslationKeys,
} from '../utils/queryCompletedTranslations.js';
import {
  getInlineElementsLabel,
  type InlineLibrary,
} from '../../types/libraries.js';

export type PollJobsInput = {
  fileTracker: FileStatusTracker;
  fileQueryData: FileProperties[];
  jobData: EnqueueFilesResult;
  timeoutDuration: number;
  forceRetranslation?: boolean;
};

export type FileStatusTracker = {
  completed: Map<string, FileProperties>;
  inProgress: Map<string, FileProperties>;
  failed: Map<string, FileProperties>;
  skipped: Map<string, FileProperties>;
};

export type PollJobsOutput = {
  success: boolean;
  fileTracker: FileStatusTracker;
};

export class PollTranslationJobsStep {
  private spinner: ReturnType<typeof logger.createProgressBar> | null = null;
  private previousProgress = 0;

  constructor(
    private api: ApiClient,
    private inlineLibrary?: InlineLibrary
  ) {}

  async run({
    fileTracker,
    fileQueryData,
    jobData,
    timeoutDuration,
    forceRetranslation,
  }: PollJobsInput): Promise<PollJobsOutput> {
    const startTime = Date.now();
    this.spinner = logger.createProgressBar(fileQueryData.length);
    const spinnerMessage = forceRetranslation
      ? 'Waiting for retranslation...'
      : 'Waiting for translation...';
    this.spinner.start(spinnerMessage);

    // Build a map of branchId:fileId:versionId:locale -> FileProperties
    const filePropertiesMap = new Map<string, FileProperties>();
    fileQueryData.forEach((item) => {
      filePropertiesMap.set(getFileTranslationKey(item), item);
    });

    // Initial query to check which files already have translations
    // Skip when force retranslation is enabled, since the server
    // no longer marks force-retranslated files as incomplete
    if (!forceRetranslation) {
      const completedKeys = await queryCompletedTranslationKeys(
        this.api,
        fileQueryData
      );

      completedKeys.forEach((fileKey) => {
        const fileProperties = filePropertiesMap.get(fileKey);
        if (fileProperties) {
          fileTracker.completed.set(fileKey, fileProperties);
        }
      });
    }

    // Build a map of jobs for quick lookup:
    // branchId:fileId:versionId:locale -> job
    const jobMap = new Map<
      string,
      (typeof jobData.jobData)[number] & { jobId: string }
    >();
    Object.entries(jobData.jobData).forEach(([jobId, job]) => {
      const jobLocale = this.api.resolveAliasLocale(job.targetLocale);
      const key = `${job.branchId}:${job.fileId}:${job.versionId}:${jobLocale}`;
      jobMap.set(key, { ...job, jobId, targetLocale: jobLocale });
    });

    // Build a map of jobs for quick lookup:
    // jobId -> file data for the job
    const jobFileMap = new Map<
      string,
      {
        branchId: string;
        fileId: string;
        versionId: string;
        locale: string;
      }
    >();
    Object.entries(jobData.jobData).forEach(([jobId, job]) => {
      const jobLocale = this.api.resolveAliasLocale(job.targetLocale);
      jobFileMap.set(jobId, {
        branchId: job.branchId,
        fileId: job.fileId,
        versionId: job.versionId,
        locale: jobLocale,
      });
    });

    // Categorize each file query item
    for (const item of fileQueryData) {
      const fileKey = getFileTranslationKey(item);

      // Check if translation already exists (completedAt is truthy)
      const existingTranslation = fileTracker.completed.get(fileKey);

      if (existingTranslation) {
        continue;
      }

      // Check if there's a job for this file
      const jobKey = `${item.branchId}:${item.fileId}:${item.versionId}:${item.locale}`;
      const job = jobMap.get(jobKey);

      if (job) {
        // Job exists - mark as in progress initially
        fileTracker.inProgress.set(fileKey, item);
      } else {
        // No job and no existing translation - mark as skipped
        fileTracker.skipped.set(fileKey, item);
      }
    }

    // Update spinner with initial status
    this.updateSpinner(fileTracker, fileQueryData);

    // If force retranslation, don't skip the initial check
    if (!forceRetranslation) {
      // Check if all jobs are already complete
      if (fileTracker.inProgress.size === 0) {
        this.spinner.stop(chalk.green('All translations ready'));
        return { success: true, fileTracker };
      }
    }

    const timeoutSeconds = Math.max(
      0,
      timeoutDuration - (Date.now() - startTime) / 1000
    );

    const updateJobStatuses = (statuses: readonly JobResult[]) => {
      for (const job of statuses) {
        const jobFileProperties = jobFileMap.get(job.jobId);
        if (!jobFileProperties) continue;

        const fileKey = `${jobFileProperties.branchId}:${jobFileProperties.fileId}:${jobFileProperties.versionId}:${jobFileProperties.locale}`;
        const fileProperties = filePropertiesMap.get(fileKey);
        if (!fileProperties) continue;

        if (job.status === 'completed') {
          fileTracker.completed.set(fileKey, fileProperties);
        } else if (job.status === 'failed') {
          fileTracker.failed.set(fileKey, fileProperties);
        } else if (job.status === 'unknown') {
          fileTracker.skipped.set(fileKey, fileProperties);
        } else {
          continue;
        }
        fileTracker.inProgress.delete(fileKey);
        jobFileMap.delete(job.jobId);
      }
      this.updateSpinner(fileTracker, fileQueryData);
    };

    try {
      const result = await pollJobs(
        [...jobFileMap.keys()],
        (jobIds, signal) => this.api.checkJobStatus(jobIds, signal),
        {
          pollingIntervalSeconds: 5,
          timeoutSeconds,
          onPoll: updateJobStatuses,
        }
      );
      if (result.complete) updateJobStatuses(result.jobs);
    } catch (error) {
      this.spinner.stop(chalk.red('Error checking translation job status'));
      throw error;
    }

    if (fileTracker.inProgress.size === 0) {
      this.spinner.stop(chalk.green('Translation jobs finished'));
      return { success: true, fileTracker };
    }

    this.spinner.stop(chalk.red('Timed out waiting for translation jobs'));
    return { success: false, fileTracker };
  }

  private updateSpinner(
    fileTracker: FileStatusTracker,
    fileQueryData: FileProperties[]
  ): void {
    if (!this.spinner) return;

    const statusText = this.generateStatusSuffixText(
      fileTracker,
      fileQueryData
    );
    const currentProgress =
      fileTracker.completed.size +
      fileTracker.failed.size +
      fileTracker.skipped.size;
    const progressDelta = currentProgress - this.previousProgress;
    this.spinner.advance(progressDelta, statusText);
    this.previousProgress = currentProgress;
  }

  private generateStatusSuffixText(
    fileTracker: FileStatusTracker,
    fileQueryData: FileProperties[]
  ): string {
    // Simple progress indicator
    const progressText = `${chalk.green(
      `[${
        fileTracker.completed.size +
        fileTracker.failed.size +
        fileTracker.skipped.size
      }/${fileQueryData.length}]`
    )} translations completed`;

    // Get terminal height to adapt our output
    const terminalHeight = process.stdout.rows || 24;

    // If terminal is very small, just show the basic progress
    if (terminalHeight < 6) {
      return progressText;
    }

    const newSuffixText = [progressText];

    // Organize data by filename : locale
    const fileStatus = new Map<
      string,
      {
        completed: Set<string>;
        pending: Set<string>;
        failed: Set<string>;
        skipped: Set<string>;
      }
    >();

    // Initialize with all files and locales from fileQueryData
    for (const item of fileQueryData) {
      if (!fileStatus.has(item.fileName)) {
        fileStatus.set(item.fileName, {
          completed: new Set(),
          pending: new Set([item.locale]),
          failed: new Set(),
          skipped: new Set(),
        });
      } else {
        fileStatus.get(item.fileName)?.pending.add(item.locale);
      }
    }

    // Mark which ones are completed, failed, or skipped
    for (const [_, fileProperties] of fileTracker.completed) {
      const { fileName, locale } = fileProperties;
      const status = fileStatus.get(fileName);
      if (status) {
        status.pending.delete(locale);
        status.completed.add(locale);
      }
    }

    for (const [_, fileProperties] of fileTracker.failed) {
      const { fileName, locale } = fileProperties;
      const status = fileStatus.get(fileName);
      if (status) {
        status.pending.delete(locale);
        status.failed.add(locale);
      }
    }

    for (const [_, fileProperties] of fileTracker.skipped) {
      const { fileName, locale } = fileProperties;
      const status = fileStatus.get(fileName);
      if (status) {
        status.pending.delete(locale);
        status.skipped.add(locale);
      }
    }

    // Calculate how many files we can show based on terminal height
    const filesArray = Array.from(fileStatus.entries());
    const maxFilesToShow = Math.min(
      filesArray.length,
      terminalHeight - 3 // Header + progress + buffer
    );

    // Display each file with its status on a single line
    for (let i = 0; i < maxFilesToShow; i++) {
      const [fileName, status] = filesArray[i];

      // Create condensed locale status
      const localeStatuses: { locale: string; status: string }[] = [];

      // Add completed locales (green)
      if (status.completed.size > 0) {
        localeStatuses.push(
          ...Array.from(status.completed).map((locale) => ({
            locale,
            status: 'completed',
          }))
        );
      }

      // Add skipped locales (green)
      if (status.skipped.size > 0) {
        localeStatuses.push(
          ...Array.from(status.skipped).map((locale) => ({
            locale,
            status: 'skipped',
          }))
        );
      }

      // Add failed locales (red)
      if (status.failed.size > 0) {
        localeStatuses.push(
          ...Array.from(status.failed).map((locale) => ({
            locale,
            status: 'failed',
          }))
        );
      }

      // Add pending locales (yellow)
      if (status.pending.size > 0) {
        localeStatuses.push(
          ...Array.from(status.pending).map((locale) => ({
            locale,
            status: 'pending',
          }))
        );
      }

      // Sort localeStatuses by locale
      localeStatuses.sort((a, b) => a.locale.localeCompare(b.locale));

      // Add colors
      const localeString = localeStatuses
        .map((locale) => {
          if (locale.status === 'completed') {
            return chalk.green(locale.locale);
          } else if (locale.status === 'skipped') {
            return chalk.gray(locale.locale);
          } else if (locale.status === 'failed') {
            return chalk.red(locale.locale);
          } else if (locale.status === 'pending') {
            return chalk.yellow(locale.locale);
          }
        })
        .join(', ');

      // Format the line
      const prettyFileName =
        fileName === TEMPLATE_FILE_NAME
          ? `<${getInlineElementsLabel(this.inlineLibrary)}>`
          : fileName;
      newSuffixText.push(`${chalk.bold(prettyFileName)} [${localeString}]`);
    }

    // If we couldn't show all files, add an indicator
    if (filesArray.length > maxFilesToShow) {
      newSuffixText.push(
        `... and ${filesArray.length - maxFilesToShow} more files`
      );
    }

    return newSuffixText.join('\n');
  }
}
