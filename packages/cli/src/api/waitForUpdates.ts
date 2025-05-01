import chalk from 'chalk';
import { createOraSpinner, createSpinner } from '../console';
import { getLocaleProperties } from 'generaltranslation';

/**
 * Waits for translations to be deployed to the General Translation API
 * @param apiKey - The API key for the General Translation API
 * @param baseUrl - The base URL for the General Translation API
 * @param versionId - The version ID of the project
 * @param locales - The locales to wait for
 * @param startTime - The start time of the wait
 * @param timeoutDuration - The timeout duration for the wait
 * @returns True if all translations are deployed, false otherwise
 */
export const waitForUpdates = async (
  apiKey: string,
  baseUrl: string,
  versionId: string,
  startTime: number,
  timeoutDuration: number
) => {
  console.log();
  const spinner = await createOraSpinner();
  spinner.start('Waiting for translation...');

  const checkDeployment = async () => {
    try {
      const response = await fetch(
        `${baseUrl}/v1/project/translations/status/${encodeURIComponent(
          versionId
        )}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey && { 'x-gt-api-key': apiKey }),
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        const { availableLocales, locales, localesWaitingForApproval } = data;
        if (localesWaitingForApproval.length > 0) {
          spinner.text = `Waiting for approval for ${localesWaitingForApproval.length} locales`;
          return false;
        }
        if (availableLocales) {
          availableLocales.forEach((locale: string) => {
            if (!availableLocales.includes(locale)) {
              availableLocales.push(locale);
            }
          });
          const newSuffixText = [
            chalk.green(`[${availableLocales.length}/${locales.length}]`) +
              ` translations completed`,
            ...availableLocales.map((locale: string) => {
              const localeProperties = getLocaleProperties(locale);
              return `Translation completed for ${chalk.green(
                localeProperties.name
              )} (${chalk.green(localeProperties.code)})`;
            }),
          ];

          spinner.text = newSuffixText.join('\n');
        }
        if (
          locales.every((locale: string) => availableLocales.includes(locale))
        ) {
          return true;
        }
      }
      return false;
    } catch (error) {
      return false;
    }
  };

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

        if (isDeployed || elapsed >= timeoutDuration) {
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
};
