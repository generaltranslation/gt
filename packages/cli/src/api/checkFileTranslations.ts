import chalk from 'chalk';
import { displayLoadingAnimation } from '../console/console';
import { getLocaleProperties } from 'generaltranslation';
import { downloadFile } from './downloadFile';
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
  apiKey: string,
  baseUrl: string,
  data: {
    [key: string]: {
      versionId: string;
      fileName: string;
    };
  },
  locales: string[],
  timeoutDuration: number,
  resolveOutputPath: (sourcePath: string, locale: string) => string
) {
  const startTime = Date.now();
  const spinner = await displayLoadingAnimation('Waiting for translation...');
  const downloadedFiles: Set<string> = new Set(); // Track which file+locale combinations have been downloaded

  let fileQueryData: {
    versionId: string;
    fileName: string;
    locale: string;
  }[] = [];

  // Initialize the query data
  for (const file in data) {
    for (const locale of locales) {
      fileQueryData.push({
        versionId: data[file].versionId,
        fileName: data[file].fileName,
        locale,
      });
    }
  }

  const checkDeployment = async () => {
    try {
      // Only query for files that haven't been downloaded yet
      const currentQueryData = fileQueryData.filter(
        (item) => !downloadedFiles.has(`${item.fileName}:${item.locale}`)
      );

      // If all files have been downloaded, we're done
      if (currentQueryData.length === 0) {
        return true;
      }

      const response = await fetch(
        `${baseUrl}/v1/project/translations/files/retrieve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey && { 'x-gt-api-key': apiKey }),
          },
          body: JSON.stringify({ files: currentQueryData }),
        }
      );

      if (response.ok) {
        const responseData = await response.json();
        const translations = responseData.translations || [];

        // Process available translations
        for (const translation of translations) {
          const locale = translation.locale;
          const fileName = translation.fileName;
          const translationId = translation.id;
          if (translation.isReady && fileName) {
            // Mark this file+locale as downloaded
            downloadedFiles.add(`${fileName}:${locale}`);

            // Download the file
            const outputPath = resolveOutputPath(fileName, locale);

            await downloadFile(baseUrl, apiKey, translationId, outputPath);
          }
        }

        // Update the spinner text
        spinner.suffixText = generateStatusSuffixText(
          downloadedFiles,
          fileQueryData
        );
      }
      if (downloadedFiles.size === fileQueryData.length) {
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking translation status:', error);
      return false;
    }
  };

  /**
   * Generates a formatted status text showing translation progress
   * @param downloadedFiles - Set of downloaded file+locale combinations
   * @param fileQueryData - Array of file query data objects
   * @returns Formatted status text
   */
  function generateStatusSuffixText(
    downloadedFiles: Set<string>,
    fileQueryData: { versionId: string; fileName: string; locale: string }[]
  ): string {
    const newSuffixText = [
      `\n\n` +
        chalk.green(`${downloadedFiles.size}/${fileQueryData.length}`) +
        ` translations completed\n`,
    ];

    // Group by filename for better organization
    const fileGroups = new Map<string, Set<string>>();

    // Initialize with all files and locales from fileQueryData
    for (const item of fileQueryData) {
      if (!fileGroups.has(item.fileName)) {
        fileGroups.set(item.fileName, new Set());
      }
      fileGroups.get(item.fileName)?.add(item.locale);
    }

    // Mark which ones are completed
    for (const fileLocale of downloadedFiles) {
      const [fileName, locale] = fileLocale.split(':');
      const completedLocales = fileGroups.get(fileName);
      if (completedLocales) {
        completedLocales.delete(locale); // Remove from pending
      }
    }

    // Display each file with its status
    for (const [fileName, pendingLocales] of fileGroups.entries()) {
      newSuffixText.push(`\n${chalk.bold(fileName)}`);

      // Show completed locales for this file
      for (const fileLocale of downloadedFiles) {
        const [currentFileName, locale] = fileLocale.split(':');
        if (currentFileName === fileName) {
          const localeProperties = getLocaleProperties(locale);
          newSuffixText.push(
            `  ${chalk.green('✓')} ${chalk.green(localeProperties.code)}`
          );
        }
      }

      // Show pending locales for this file
      for (const locale of pendingLocales) {
        const localeProperties = getLocaleProperties(locale);
        newSuffixText.push(
          `  ${chalk.yellow('[==>')} ${chalk.yellow(localeProperties.code)}`
        );
      }
    }

    return newSuffixText.join('\n');
  }

  // Calculate time until next 5-second interval since startTime
  const msUntilNextInterval = Math.max(
    0,
    5000 - ((Date.now() - startTime) % 5000)
  );

  // Do first check immediately
  const initialCheck = await checkDeployment();
  if (initialCheck) {
    spinner.succeed(chalk.green('All translations are live!'));
    return true;
  }

  return new Promise<boolean>((resolve) => {
    let intervalCheck: NodeJS.Timeout;
    // Start the interval aligned with the original request time
    setTimeout(() => {
      intervalCheck = setInterval(async () => {
        const isDeployed = await checkDeployment();
        const elapsed = Date.now() - startTime;

        if (isDeployed || elapsed >= timeoutDuration * 1000) {
          process.stdout.write('\n');
          clearInterval(intervalCheck);

          if (isDeployed) {
            spinner.succeed(chalk.green('All translations are live!'));
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
