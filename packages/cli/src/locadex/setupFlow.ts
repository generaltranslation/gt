import { Settings } from '../types/index.js';
import { logger } from '../console/logger.js';
import chalk from 'chalk';

/** Opens the GitHub connection page unless the caller only hands off the URL. */
export async function setupLocadex(
  settings: Settings,
  { openBrowser = true }: { openBrowser?: boolean } = {}
): Promise<string> {
  // No returnTo: the dashboard reads /project/<segment> as a project ID, and
  // the route already returns to the dashboard home.
  const urlToOpen = `${settings.dashboardUrl}/api/integrations/github/start`;
  if (openBrowser) {
    await import('open').then((open) =>
      open.default(urlToOpen, {
        wait: false,
      })
    );
  }

  logger.message(
    `${chalk.dim(
      openBrowser
        ? `If the browser window didn't open automatically, open the following link:`
        : 'Open the following link to connect GitHub and finish setting up Locadex:'
    )}\n\n${chalk.cyan(urlToOpen)}`
  );
  return urlToOpen;
}
