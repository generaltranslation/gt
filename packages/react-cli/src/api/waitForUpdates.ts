import chalk from 'chalk';
import { displayLoadingAnimation } from '../console/console';
import { getLocaleProperties } from 'generaltranslation';
export const waitForUpdates = async (
  apiKey: string,
  baseUrl: string,
  versionId: string,
  locales: string[],
  startTime: number,
  timeoutDuration: number
) => {
  const spinner = await displayLoadingAnimation('Waiting for translation...');
  const availableLocales: string[] = [];
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
        if (data.availableLocales) {
          data.availableLocales.forEach((locale: string) => {
            if (
              !availableLocales.includes(locale) &&
              locales.includes(locale)
            ) {
              availableLocales.push(locale);
            }
          });
          const newSuffixText = [
            `\n\n` +
              chalk.green(`${availableLocales.length}/${locales.length}`) +
              ` translations completed`,
            ...availableLocales.map((locale: string) => {
              const localeProperties = getLocaleProperties(locale);
              return `Translation completed for ${chalk.green(
                localeProperties.name
              )} (${chalk.green(localeProperties.code)})`;
            }),
          ];
          spinner.suffixText = newSuffixText.join('\n');
        }
        if (locales.every((locale) => availableLocales.includes(locale))) {
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
    return;
  }

  let intervalCheck: NodeJS.Timeout;
  // Start the interval aligned with the original request time
  setTimeout(() => {
    intervalCheck = setInterval(async () => {
      const isDeployed = await checkDeployment();
      const elapsed = Date.now() - startTime;

      if (isDeployed || elapsed >= timeoutDuration) {
        process.stdout.write('\n');
        clearInterval(intervalCheck);

        if (isDeployed) {
          spinner.succeed(chalk.green('All translations are live!'));
        } else {
          spinner.fail(chalk.red('Timed out waiting for translations'));
        }
        return;
      }
    }, 5000);
  }, msUntilNextInterval);
};
