import chalk from 'chalk';
import { login, type DeviceCode } from '@generaltranslation/auth';
import { globeBanner } from '../console/globe/banner.js';
import { logger } from '../console/logger.js';
import { resolveApiBaseUrl } from '../utils/apiBaseUrl.js';
import { onAuthWarning } from './warning.js';

export async function loginInteractively(
  baseUrl: string | undefined,
  useBrowser = true,
  onDeviceCode?: (deviceCode: DeviceCode) => void
): Promise<void> {
  await login({
    baseUrl: resolveApiBaseUrl(baseUrl),
    noBrowser: !useBrowser,
    onWarning: onAuthWarning,
    onDeviceCode: (deviceCode) => {
      const { userCode, verificationUri, verificationUriComplete } = deviceCode;
      onDeviceCode?.(deviceCode);
      // The user has to act on this, so land the banner and show it in full.
      void globeBanner.settle();
      logger.message(
        `Visit:\n\n${chalk.cyan(verificationUriComplete ?? verificationUri)}\n\n${verificationUriComplete ? '' : `Then enter the code ${chalk.bold(userCode)}.\n`}Waiting for authentication...`
      );
    },
    onAuthorizationUrl: (url) => {
      void globeBanner.settle();
      logger.message(
        `Opening your browser to sign in. If it does not open, visit:\n${chalk.cyan(url)}`
      );
    },
  });
}
