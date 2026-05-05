import { Settings } from '../types/index.js';
import { logger } from '../console/logger.js';
import chalk from 'chalk';

export async function setupLocadex(settings: Settings): Promise<void> {
  const urlToOpen = `${settings.dashboardUrl}/api/integrations/github/start?returnTo=%2Fproject%2Flocadex`;

  logger.step('Opening Locadex setup in your browser...');

  await import('open').then((open) =>
    open.default(urlToOpen, {
      wait: false,
    })
  );

  logger.message(
    `${chalk.dim(
      `Sign in or create an account, finish company info, connect GitHub, and configure Locadex. If the browser window didn't open automatically, open the following link:`
    )}\n\n${chalk.cyan(urlToOpen)}`
  );
}
