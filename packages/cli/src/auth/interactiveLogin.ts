import chalk from 'chalk';
import { logger } from '../console/logger.js';
import { login, type DeviceCode } from './oauth.js';

export async function loginInteractively(
  baseUrl: string | undefined,
  useBrowser = true,
  onDeviceCode?: (deviceCode: DeviceCode) => void
): Promise<void> {
  await login({
    baseUrl,
    noBrowser: !useBrowser,
    onDeviceCode: (deviceCode) => {
      const { userCode, verificationUri, verificationUriComplete } = deviceCode;
      onDeviceCode?.(deviceCode);
      logger.message(
        `Visit:\n\n${chalk.cyan(verificationUriComplete ?? verificationUri)}\n\n${verificationUriComplete ? '' : `Then enter the code ${chalk.bold(userCode)}.\n`}Waiting for authentication...`
      );
    },
    onAuthorizationUrl: (url) => {
      logger.message(
        `Opening your browser to sign in. If it does not open, visit:\n${chalk.cyan(url)}`
      );
    },
  });
}
