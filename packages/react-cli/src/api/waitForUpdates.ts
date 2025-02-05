import chalk from 'chalk';
import { displayLoadingAnimation } from '../console/console';
export const waitForUpdates = async (
  apiKey: string,
  baseUrl: string,
  versionId: string,
  locales: string[]
) => {
  const loadingInterval = displayLoadingAnimation(
    'Waiting for translations to be completed...'
  );

  let attempts = 0;
  const maxAttempts = 60; // 5 minutes total (60 * 5000ms)

  const checkDeployment = async () => {
    if (!locales) return false;
    try {
      const response = await fetch(
        `${baseUrl}/v1/project/translations/status`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey && { 'x-gt-api-key': apiKey }),
          },
          body: JSON.stringify({
            versionId: versionId,
          }),
        }
      );
      if (response.status === 200) {
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

  let intervalCheck: NodeJS.Timeout;
  intervalCheck = setInterval(async () => {
    attempts++;
    const isDeployed = await checkDeployment();

    if (isDeployed || attempts >= maxAttempts) {
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
};
