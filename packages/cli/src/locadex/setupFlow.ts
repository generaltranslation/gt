import { Settings } from '../types/index.js';
import { logger } from '../console/logger.js';
import chalk from 'chalk';

export async function setupLocadex(settings: Settings): Promise<void> {
  const urlToOpen = `${settings.dashboardUrl}/api/integrations/github/start?returnTo=%2Fproject%2Flocadex`;
  await import('open').then((open) =>
    open.default(urlToOpen, {
      wait: false,
    })
  );

  logger.message(
    `${chalk.dim(
      `If the browser window didn't open automatically, please open the following link:`
    )}\n\n${chalk.cyan(urlToOpen)}`
  );
}
