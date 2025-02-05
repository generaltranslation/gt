import chalk from 'chalk';
import { displayLoadingAnimation } from '../console/console';
export const waitForUpdates = async (
  apiKey: string,
  baseUrl: string,
  versionId: string,
  locales: string[],
  startTime: number
) => {
  const loadingInterval = displayLoadingAnimation(
    'Waiting for translations to be completed...'
  );

  const timeoutDuration = 5 * 60 * 1000; // 5 minutes in milliseconds

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
        if (data.count >= locales.length) {
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
    clearInterval(loadingInterval);
    console.log('\n');
    console.log(chalk.green('✓ All translations are live!'));
    return;
  }

  let intervalCheck: NodeJS.Timeout;
  // Start the interval aligned with the original request time
  setTimeout(() => {
    intervalCheck = setInterval(async () => {
      const isDeployed = await checkDeployment();
      const elapsed = Date.now() - startTime;

      if (isDeployed || elapsed >= timeoutDuration) {
        clearInterval(loadingInterval);
        clearInterval(intervalCheck);
        console.log('\n');

        if (isDeployed) {
          console.log(chalk.green('✓ All translations are live!'));
        } else {
          console.log(chalk.yellow('⚠️  Timed out waiting for translations'));
        }
      }
    }, 5000);
  }, msUntilNextInterval);
};
