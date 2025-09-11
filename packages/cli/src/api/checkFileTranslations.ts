import chalk from 'chalk';
import { createOraSpinner, logError } from '../console/logging.js';
import { getLocaleProperties } from 'generaltranslation';
import { BatchedFiles, downloadFileBatch } from './downloadFileBatch.js';
import { gt } from '../utils/gt.js';
import { Settings } from '../types/index.js';
import { TEMPLATE_FILE_NAME } from '../cli/commands/stage.js';

export type CheckFileTranslationData = {
  [key: string]: {
    versionId: string;
    fileName: string;
  };
};

/**
 * Checks the status of translations for a given version ID
 * @param apiKey - The API key for the General Translation API
 * @param baseUrl - The base URL for the General Translation API
 * @param versionId - The version ID of the project
 * @param locales - The locales to wait for
 * @param startTime - The start time of the wait
 * @param timeoutDuration - The timeout duration for the wait in seconds
 * @returns True if all translations are deployed, false otherwise
 */
export async function checkFileTranslations(
  data: {
    [key: string]: {
      versionId: string;
      fileName: string;
    };
  },
  locales: string[],
  timeoutDuration: number,
  resolveOutputPath: (sourcePath: string, locale: string) => string | null,
  options: Settings
) {
  const startTime = Date.now();
  console.log();
  const spinner = await createOraSpinner();
  spinner.start('Waiting for translation...');

  // Initialize the query data
  const fileQueryData = prepareFileQueryData(data, locales);

  const downloadStatus = {
    downloaded: new Set<string>(),
    failed: new Set<string>(),
    skipped: new Set<string>(),
  };
  // Do first check immediately
  const initialCheck = await checkTranslationDeployment(
    fileQueryData,
    downloadStatus,
    spinner,
    resolveOutputPath,
    options
  );

  if (initialCheck) {
    spinner.succeed(chalk.green('Files translated!'));
    return true;
  }

  // Calculate time until next 5-second interval since startTime
  const msUntilNextInterval = Math.max(
    0,
    5000 - ((Date.now() - startTime) % 5000)
  );

  return new Promise<boolean>((resolve) => {
    let intervalCheck: NodeJS.Timeout;
    // Start the interval aligned with the original request time
    setTimeout(() => {
      intervalCheck = setInterval(async () => {
        const isDeployed = await checkTranslationDeployment(
          fileQueryData,
          downloadStatus,
          spinner,
          resolveOutputPath,
          options
        );
        const elapsed = Date.now() - startTime;

        if (isDeployed || elapsed >= timeoutDuration * 1000) {
          clearInterval(intervalCheck);

          if (isDeployed) {
            spinner.succeed(chalk.green('All files translated!'));
            resolve(true);
          } else {
            spinner.fail(chalk.red('Timed out waiting for translations'));
            resolve(false);
          }
        }
      }, 5000);
    }, msUntilNextInterval);
  });
}

/**
 * Prepares the file query data from input data and locales
 */
function prepareFileQueryData(
  data: {
    [key: string]: {
      versionId: string;
      fileName: string;
    };
  },
  locales: string[]
): { versionId: string; fileName: string; locale: string }[] {
  const fileQueryData: {
    versionId: string;
    fileName: string;
    locale: string;
  }[] = [];

  for (const file in data) {
    for (const locale of locales) {
      fileQueryData.push({
        versionId: data[file].versionId,
        fileName: data[file].fileName,
        locale,
      });
    }
  }

  return fileQueryData;
}

/**
 * Generates a formatted status text showing translation progress
 * @param downloadedFiles - Set of downloaded file+locale combinations
 * @param fileQueryData - Array of file query data objects
 * @returns Formatted status text
 */
function generateStatusSuffixText(
  downloadStatus: { downloaded: Set<string>; failed: Set<string> },
  fileQueryData: { versionId: string; fileName: string; locale: string }[]
): string {
  // Simple progress indicator
  const progressText =
    chalk.green(
      `[${
        downloadStatus.downloaded.size + downloadStatus.failed.size
      }/${fileQueryData.length}]`
    ) + ` translations completed`;

  // Get terminal height to adapt our output
  const terminalHeight = process.stdout.rows || 24; // Default to 24 if undefined

  // If terminal is very small, just show the basic progress
  if (terminalHeight < 6) {
    return `${progressText}`;
  }

  const newSuffixText = [`${progressText}`];

  // Organize data by filename
  const fileStatus = new Map<
    string,
    { completed: Set<string>; pending: Set<string>; failed: Set<string> }
  >();

  // Initialize with all files and locales from fileQueryData
  for (const item of fileQueryData) {
    if (!fileStatus.has(item.fileName)) {
      fileStatus.set(item.fileName, {
        completed: new Set(),
        pending: new Set([item.locale]),
        failed: new Set(),
      });
    } else {
      fileStatus.get(item.fileName)?.pending.add(item.locale);
    }
  }

  // Mark which ones are completed or failed
  for (const fileLocale of downloadStatus.downloaded) {
    const [fileName, locale] = fileLocale.split(':');
    const status = fileStatus.get(fileName);
    if (status) {
      status.pending.delete(locale);
      status.completed.add(locale);
    }
  }

  for (const fileLocale of downloadStatus.failed) {
    const [fileName, locale] = fileLocale.split(':');
    const status = fileStatus.get(fileName);
    if (status) {
      status.pending.delete(locale);
      status.failed.add(locale);
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

    // Add completed locales
    if (status.completed.size > 0) {
      const completedCodes = Array.from(status.completed)
        .map((locale) => getLocaleProperties(locale).code)
        .join(', ');
      localeStatuses.push(chalk.green(`${completedCodes}`));
    }

    // Add failed locales
    if (status.failed.size > 0) {
      const failedCodes = Array.from(status.failed)
        .map((locale) => getLocaleProperties(locale).code)
        .join(', ');
      localeStatuses.push(chalk.red(`${failedCodes}`));
    }

    // Add pending locales
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

/**
 * Checks translation status and downloads ready files
 */
async function checkTranslationDeployment(
  fileQueryData: { versionId: string; fileName: string; locale: string }[],
  downloadStatus: {
    downloaded: Set<string>;
    failed: Set<string>;
    skipped: Set<string>;
  },
  spinner: Awaited<ReturnType<typeof createOraSpinner>>,
  resolveOutputPath: (sourcePath: string, locale: string) => string | null,
  options: Settings
): Promise<boolean> {
  try {
    // Only query for files that haven't been downloaded yet
    const currentQueryData = fileQueryData.filter(
      (item) =>
        !downloadStatus.downloaded.has(`${item.fileName}:${item.locale}`) &&
        !downloadStatus.failed.has(`${item.fileName}:${item.locale}`) &&
        !downloadStatus.skipped.has(`${item.fileName}:${item.locale}`)
    );

    // If all files have been downloaded, we're done
    if (currentQueryData.length === 0) {
      return true;
    }

    // Check for translations
    const responseData = await gt.checkFileTranslations(currentQueryData);
    const translations = responseData.translations || [];

    // Filter for ready translations
    const readyTranslations = translations.filter(
      (translation) => translation.isReady && translation.fileName
    );

    if (readyTranslations.length > 0) {
      // Prepare batch download data
      const batchFiles: BatchedFiles = readyTranslations
        .map((translation) => {
          const locale = gt.resolveAliasLocale(translation.locale);
          const fileName = translation.fileName;
          const translationId = translation.id;
          const outputPath = resolveOutputPath(fileName, locale);

          // Skip downloading GTJSON files that are not in the files configuration
          if (outputPath === null) {
            downloadStatus.skipped.add(`${fileName}:${locale}`);
            return null;
          }
          return {
            translationId,
            inputPath: fileName,
            outputPath,
            locale,
            fileLocale: `${fileName}:${locale}`,
          };
        })
        .filter((file) => file !== null) as BatchedFiles;

      const batchResult = await downloadFileBatch(batchFiles, options);

      // Process results
      batchFiles.forEach((file) => {
        const { translationId, fileLocale } = file;
        if (batchResult.successful.includes(translationId)) {
          downloadStatus.downloaded.add(fileLocale);
        } else if (batchResult.failed.includes(translationId)) {
          downloadStatus.failed.add(fileLocale);
        }
      });
    }

    // Force a refresh of the spinner display
    const statusText = generateStatusSuffixText(downloadStatus, fileQueryData);

    // Clear and reapply the suffix to force a refresh
    spinner.text = statusText;

    // If all files have been downloaded, we're done
    if (
      downloadStatus.downloaded.size +
        downloadStatus.failed.size +
        downloadStatus.skipped.size ===
      fileQueryData.length
    ) {
      return true;
    }
  } catch (error) {
    logError(chalk.red('Error checking translation status: ') + error);
  }
  return false;
}
