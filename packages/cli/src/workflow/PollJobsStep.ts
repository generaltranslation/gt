import chalk from 'chalk';
import { WorkflowStep } from './Workflow.js';
import { createOraSpinner, logError } from '../console/logging.js';
import { getLocaleProperties } from 'generaltranslation';
import { GT } from 'generaltranslation';
import { EnqueueFilesResult } from 'generaltranslation/types';
import { TEMPLATE_FILE_NAME } from '../cli/commands/stage.js';
import type { FileProperties } from '../types/files.js';

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

export class PollTranslationJobsStep extends WorkflowStep<
  PollJobsInput,
  PollJobsOutput
> {
  private spinner: Awaited<ReturnType<typeof createOraSpinner>> | null = null;

  constructor(private gt: GT) {
    super();
  }

  async run({
    fileTracker,
    fileQueryData,
    jobData,
    timeoutDuration,
    forceRetranslation,
  }: PollJobsInput): Promise<PollJobsOutput> {
    const startTime = Date.now();
    console.log();
    this.spinner = await createOraSpinner();
    const spinnerMessage = forceRetranslation
      ? 'Waiting for retranslation...'
      : 'Waiting for translation...';
    this.spinner.start(spinnerMessage);

    // Build a map of branchId:fileId:versionId:locale -> FileProperties
    const filePropertiesMap = new Map<string, FileProperties>();
    fileQueryData.forEach((item) => {
      filePropertiesMap.set(
        `${item.branchId}:${item.fileId}:${item.versionId}:${item.locale}`,
        item
      );
    });

    // Initial query to check which files already have translations
    const initialFileData = await this.gt.queryFileData({
      translatedFiles: fileQueryData.map((item) => ({
        fileId: item.fileId,
        versionId: item.versionId,
        branchId: item.branchId,
        locale: item.locale,
      })),
    });
    const existingTranslations = initialFileData.translatedFiles || [];

    // Mark all existing translations as completed
    existingTranslations.forEach((translation) => {
      if (!translation.completedAt) {
        return;
      }
      const fileKey = `${translation.branchId}:${translation.fileId}:${translation.versionId}:${translation.locale}`;
      const fileProperties = filePropertiesMap.get(fileKey);
      if (fileProperties) {
        fileTracker.completed.set(fileKey, fileProperties);
      }
    });

    // Build a map of jobs for quick lookup:
    // branchId:fileId:versionId:locale -> job
    const jobMap = new Map<
      string,
      (typeof jobData.jobData)[number] & { jobId: string }
    >();
    Object.entries(jobData.jobData).forEach(([jobId, job]) => {
      const key = `${job.branchId}:${job.fileId}:${job.versionId}:${job.targetLocale}`;
      jobMap.set(key, { ...job, jobId });
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
      jobFileMap.set(jobId, {
        branchId: job.branchId,
        fileId: job.fileId,
        versionId: job.versionId,
        locale: job.targetLocale,
      });
    });

    // Categorize each file query item
    for (const item of fileQueryData) {
      const fileKey = `${item.branchId}:${item.fileId}:${item.versionId}:${item.locale}`;

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
      if (fileTracker.inProgress.size === 0 && fileTracker.failed.size === 0) {
        this.spinner.succeed(chalk.green('All translations ready!'));
        return { success: true, fileTracker };
      }
    }

    // Calculate time until next 5-second interval since startTime
    const msUntilNextInterval = Math.max(
      0,
      5000 - ((Date.now() - startTime) % 5000)
    );

    return new Promise<PollJobsOutput>((resolve) => {
      let intervalCheck: NodeJS.Timeout;

      setTimeout(() => {
        intervalCheck = setInterval(async () => {
          try {
            // Query job status
            const jobIds = Array.from(jobFileMap.keys());
            const jobStatusResponse = await this.gt.checkJobStatus(jobIds);

            // Update status based on job completion
            for (const job of jobStatusResponse) {
              const jobFileProperties = jobFileMap.get(job.jobId);
              if (jobFileProperties) {
                const fileKey = `${jobFileProperties.branchId}:${jobFileProperties.fileId}:${jobFileProperties.versionId}:${jobFileProperties.locale}`;
                const fileProperties = filePropertiesMap.get(fileKey);
                if (!fileProperties) {
                  continue;
                }
                if (job.status === 'completed') {
                  fileTracker.completed.set(fileKey, fileProperties);
                  fileTracker.inProgress.delete(fileKey);
                } else if (job.status === 'failed') {
                  fileTracker.failed.set(fileKey, fileProperties);
                  fileTracker.inProgress.delete(fileKey);
                } else if (job.status === 'unknown') {
                  fileTracker.skipped.set(fileKey, fileProperties);
                  fileTracker.inProgress.delete(fileKey);
                }
              }
            }

            // Update spinner
            this.updateSpinner(fileTracker, fileQueryData);

            const elapsed = Date.now() - startTime;
            const allJobsProcessed = fileTracker.inProgress.size === 0;

            if (allJobsProcessed || elapsed >= timeoutDuration * 1000) {
              clearInterval(intervalCheck);

              if (fileTracker.inProgress.size === 0) {
                this.spinner!.succeed(
                  chalk.green('Translation jobs finished!')
                );
                resolve({ success: true, fileTracker });
              } else {
                this.spinner!.fail(
                  chalk.red('Timed out waiting for translation jobs')
                );
                resolve({ success: false, fileTracker });
              }
            }
          } catch (error) {
            logError(chalk.red('Error checking job status: ') + error);
          }
        }, 5000);
      }, msUntilNextInterval);
    });
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
    this.spinner.text = statusText;
  }

  private generateStatusSuffixText(
    fileTracker: FileStatusTracker,
    fileQueryData: FileProperties[]
  ): string {
    // Simple progress indicator
    const progressText =
      chalk.green(
        `[${
          fileTracker.completed.size +
          fileTracker.failed.size +
          fileTracker.skipped.size
        }/${fileQueryData.length}]`
      ) + ` translations completed`;

    // Get terminal height to adapt our output
    const terminalHeight = process.stdout.rows || 24;

    // If terminal is very small, just show the basic progress
    if (terminalHeight < 6) {
      return `${progressText}`;
    }

    const newSuffixText = [`${progressText}`];

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
      const localeStatuses = [];

      // Add completed locales (green)
      if (status.completed.size > 0) {
        const completedCodes = Array.from(status.completed)
          .map((locale) => getLocaleProperties(locale).code)
          .join(', ');
        localeStatuses.push(chalk.green(`${completedCodes}`));
      }

      // Add skipped locales (green)
      if (status.skipped.size > 0) {
        const skippedCodes = Array.from(status.skipped)
          .map((locale) => getLocaleProperties(locale).code)
          .join(', ');
        localeStatuses.push(chalk.green(`${skippedCodes}`));
      }

      // Add failed locales (red)
      if (status.failed.size > 0) {
        const failedCodes = Array.from(status.failed)
          .map((locale) => getLocaleProperties(locale).code)
          .join(', ');
        localeStatuses.push(chalk.red(`${failedCodes}`));
      }

      // Add pending locales (yellow)
      if (status.pending.size > 0) {
        const pendingCodes = Array.from(status.pending)
          .map((locale) => getLocaleProperties(locale).code)
          .join(', ');
        localeStatuses.push(chalk.yellow(`${pendingCodes}`));
      }

      // Format the line
      const prettyFileName =
        fileName === TEMPLATE_FILE_NAME ? '<React Elements>' : fileName;
      newSuffixText.push(
        `${chalk.bold(prettyFileName)} [${localeStatuses.join(', ')}]`
      );
    }

    // If we couldn't show all files, add an indicator
    if (filesArray.length > maxFilesToShow) {
      newSuffixText.push(
        `... and ${filesArray.length - maxFilesToShow} more files`
      );
    }

    return newSuffixText.join('\n');
  }

  async wait(): Promise<void> {
    return;
  }
}
