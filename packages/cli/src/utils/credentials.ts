import { logErrorAndExit } from '../console/logging.js';
import { logger } from '../console/logger.js';
import path from 'node:path';
import fs from 'node:fs';
import { Settings, SupportedFrameworks } from '../types/index.js';
import chalk from 'chalk';
import {
  createApiClient,
  createCliWizardSession,
  deleteCliWizardSession,
  getCliWizardSession,
  type GetCliWizardSessionResponse,
} from 'generaltranslation/api';
import { unwrapApiResult } from 'generaltranslation/internal';

type Credentials = { apiKey: string; projectId: string };

// Fetches project ID and API key by opening the dashboard in the browser
export async function retrieveCredentials(
  settings: Settings
): Promise<Credentials> {
  // Generate a session ID
  const { sessionId } = await generateCredentialsSession(settings.baseUrl);

  const urlToOpen = `${settings.dashboardUrl}/cli/wizard/${sessionId}`;
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

  const spinner = logger.createSpinner('dots');
  spinner.start('Waiting for response from dashboard...');

  const client = createApiClient({
    baseUrl: settings.baseUrl,
    retryPolicy: 'none',
  });
  const credentials = await new Promise<Credentials>((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const result = await getCliWizardSession({
          client,
          path: { sessionId },
        });
        if (result.response.status !== 200) return;

        let credentials: Credentials;
        try {
          credentials = normalizeCredentials(unwrapApiResult(result));
        } catch (error) {
          clearInterval(interval);
          clearTimeout(timeout);
          reject(error);
          return;
        }
        resolve(credentials);
        clearInterval(interval);
        clearTimeout(timeout);
        void deleteCliWizardSession({
          client,
          path: { sessionId },
        }).catch(console.error);
      } catch (err) {
        console.error(err);
      }
    }, 2000);
    // timeout after 1 hour
    const timeout = setTimeout(
      () => {
        spinner.stop('Timed out');
        clearInterval(interval);
        logErrorAndExit('Timed out waiting for response from dashboard');
      },
      1000 * 60 * 60
    );
  });
  spinner.stop('Received credentials');
  return credentials;
}

export async function generateCredentialsSession(url: string): Promise<{
  sessionId: string;
}> {
  try {
    return unwrapApiResult(
      await createCliWizardSession({
        body: {},
        client: createApiClient({ baseUrl: url, retryPolicy: 'none' }),
      })
    );
  } catch {
    logErrorAndExit('Failed to generate credentials session');
  }
}

// The wizard issues one key; older servers repeat it per requested slot.
function normalizeCredentials(
  response: GetCliWizardSessionResponse
): Credentials {
  const apiKey =
    'apiKey' in response
      ? response.apiKey
      : 'apiKeys' in response
        ? response.apiKeys[0]?.key
        : undefined;
  if (!apiKey || !('projectId' in response))
    throw new Error(
      'The dashboard returned an unsupported credentials response'
    );
  return { apiKey, projectId: response.projectId };
}

// Checks if the credentials are set in the environment variables
export function areCredentialsSet() {
  return (
    process.env.GT_PROJECT_ID &&
    (process.env.GT_API_KEY || process.env.GT_DEV_API_KEY)
  );
}

// Sets the credentials in .env.local file
export async function setCredentials(
  credentials: Credentials,
  framework?: SupportedFrameworks,
  cwd: string = process.cwd()
) {
  const envFile = path.join(cwd, '.env.local');
  let envContent = '';

  // Check if .env.local exists, create it if it doesn't
  if (!fs.existsSync(envFile)) {
    // File doesn't exist, create it
    await fs.promises.writeFile(envFile, '', 'utf8');

    // Add .env.local to .gitignore if it exists
    const gitignoreFile = path.join(cwd, '.gitignore');
    if (fs.existsSync(gitignoreFile)) {
      const gitignoreContent = await fs.promises.readFile(
        gitignoreFile,
        'utf8'
      );
      if (!gitignoreContent.includes('.env.local')) {
        await fs.promises.appendFile(gitignoreFile, '\n.env.local\n', 'utf8');
      }
    } else {
      // Create .gitignore file with .env.local
      await fs.promises.writeFile(gitignoreFile, '.env.local\n', 'utf8');
    }
  } else {
    // Read existing content
    envContent = await fs.promises.readFile(envFile, 'utf8');
  }

  // Always append the credentials to the file
  let prefix = '';
  if (framework === 'next-pages') {
    prefix = 'NEXT_PUBLIC_';
  } else if (framework === 'vite') {
    prefix = 'VITE_';
  } else if (framework === 'gatsby') {
    prefix = 'GATSBY_';
  } else if (framework === 'react') {
    prefix = 'REACT_APP_';
  } else if (framework === 'redwood') {
    prefix = 'REDWOOD_ENV_';
  }

  // Only the hot-reload key: the CLI itself acts as the signed-in user, and
  // CI keys are created deliberately rather than dropped into .env.local.
  envContent += `\n${prefix}GT_PROJECT_ID=${credentials.projectId}\n`;
  envContent += `${prefix}GT_DEV_API_KEY=${credentials.apiKey}\n`;

  // Ensure we don't have excessive newlines
  envContent = envContent.replace(/\n{3,}/g, '\n\n').trim() + '\n';

  // Write the updated content back to the file
  await fs.promises.writeFile(envFile, envContent, 'utf8');
}
