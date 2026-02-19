import path from 'node:path';
import { Settings } from '../types/index.js';
import { gt } from '../utils/gt.js';
import { EnqueueFilesResult } from 'generaltranslation/types';
import { clearLocaleDirs } from '../fs/clearLocaleDirs.js';
import {
  FileStatusTracker,
  PollTranslationJobsStep,
} from './steps/PollJobsStep.js';
import { DownloadTranslationsStep } from './steps/DownloadStep.js';
import { BranchData } from '../types/branch.js';
import { logErrorAndExit } from '../console/logging.js';
import { logger } from '../console/logger.js';
import { recordWarning } from '../state/translateWarnings.js';
import { BranchStep } from './steps/BranchStep.js';
import { FileProperties } from '../types/files.js';
import chalk from 'chalk';

export type FileTranslationData = {
  [fileId: string]: {
    versionId: string;
    fileName: string;
  };
};

/**
 * Checks the status of translations and downloads them using a workflow pattern
 * @param fileVersionData - Mapping of file IDs to their version and name information
 * @param jobData - Optional job data from enqueue operation
 * @param locales - The locales to wait for
 * @param timeoutDuration - The timeout duration for the wait in seconds
 * @param resolveOutputPath - Function to resolve the output path for a given source path and locale
 * @param options - Settings configuration
 * @param forceRetranslation - Whether to force retranslation
 * @param forceDownload - Whether to force download even if file exists
 * @returns True if all translations are downloaded successfully, false otherwise
 */
export async function executeDownloadTranslationsWorkflow({
  fileVersionData,
  jobData,
  branchData,
  locales,
  timeoutDuration,
  resolveOutputPath,
  options,
  forceRetranslation,
  forceDownload,
}: {
  fileVersionData: FileTranslationData;
  jobData: EnqueueFilesResult | undefined;
  branchData: BranchData | undefined;
  locales: string[];
  timeoutDuration: number;
  resolveOutputPath: (sourcePath: string, locale: string) => string | null;
  options: Settings;
  forceRetranslation?: boolean;
  forceDownload?: boolean;
}): Promise<boolean> {
  if (!branchData) {
    // Run the branch step
    const branchStep = new BranchStep(gt, options);
    const branchResult = await branchStep.run();
    await branchStep.wait();
    if (!branchResult) {
      return logErrorAndExit('Failed to resolve git branch information.');
    }
    branchData = branchResult;
  }
  // Prepare the query data
  const fileQueryData = prepareFileQueryData(
    fileVersionData,
    locales,
    branchData
  );

  // Clear translated files before any downloads (if enabled)
  if (
    options.options?.experimentalClearLocaleDirs === true &&
    fileQueryData.length > 0
  ) {
    const translatedFiles = new Set(
      fileQueryData
        .map((file) => {
          const outputPath = resolveOutputPath(file.fileName, file.locale);
          // Only clear if the output path is different from the source (i.e., there's a transform)
          return outputPath !== null && outputPath !== file.fileName
            ? outputPath
            : null;
        })
        .filter((path): path is string => path !== null)
    );

    // Derive cwd from config path
    const cwd = path.dirname(options.config);

    await clearLocaleDirs(
      translatedFiles,
      locales,
      options.options?.clearLocaleDirsExclude,
      cwd
    );
  }

  // Initialize download status
  const fileTracker: FileStatusTracker = {
    completed: new Map<string, FileProperties>(),
    inProgress: new Map<string, FileProperties>(),
    failed: new Map<string, FileProperties>(),
    skipped: new Map<string, FileProperties>(),
  };

  // Step 1: Poll translation jobs if jobData exists
  let pollTimedOut = false;
  if (jobData) {
    const pollStep = new PollTranslationJobsStep(gt);
    const pollResult = await pollStep.run({
      fileTracker,
      fileQueryData,
      jobData,
      timeoutDuration,
      forceRetranslation,
    });
    await pollStep.wait();

    if (pollResult.fileTracker.failed.size > 0) {
      logger.error(
        `${chalk.red(`${pollResult.fileTracker.failed.size} file(s) failed to translate:`)}\n${Array.from(
          pollResult.fileTracker.failed.entries()
        )
          .map(([, value]) => `- ${value.fileName}`)
          .join('\n')}`
      );
      for (const [, value] of pollResult.fileTracker.failed) {
        recordWarning(
          'failed_translation',
          value.fileName,
          `Failed to translate for locale ${value.locale}`
        );
      }
    }

    // Even if polling timed out, still download whatever completed successfully
    if (!pollResult.success) {
      pollTimedOut = true;
      if (pollResult.fileTracker.completed.size > 0) {
        logger.warn(
          chalk.yellow(
            `Timed out, but ${pollResult.fileTracker.completed.size} translation(s) completed successfully. Downloading completed files...`
          )
        );
      } else {
        return false;
      }
    }
  } else {
    for (const file of fileQueryData) {
      // Staging - assume all files are completed
      fileTracker.completed.set(
        `${file.branchId}:${file.fileId}:${file.versionId}:${file.locale}`,
        file
      );
    }
  }

  // Step 2: Download translations
  const downloadStep = new DownloadTranslationsStep(gt, options);
  const downloadResult = await downloadStep.run({
    fileTracker,
    resolveOutputPath,
    forceDownload,
  });
  await downloadStep.wait();

  // If polling timed out, report failure even though we downloaded what we could
  if (pollTimedOut) {
    return false;
  }

  return downloadResult;
}

/**
 * Prepares the file query data from input data and locales
 */
function prepareFileQueryData(
  fileVersionData: FileTranslationData,
  locales: string[],
  branchData: BranchData
): FileProperties[] {
  const fileQueryData: FileProperties[] = [];

  for (const fileId in fileVersionData) {
    for (const locale of locales) {
      fileQueryData.push({
        versionId: fileVersionData[fileId].versionId,
        fileName: fileVersionData[fileId].fileName,
        fileId,
        locale,
        branchId: branchData.currentBranch.id,
      });
    }
  }

  return fileQueryData;
}
