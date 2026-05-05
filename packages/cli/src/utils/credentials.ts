import { logErrorAndExit } from '../console/logging.js';
import { logger } from '../console/logger.js';
import path from 'node:path';
import fs from 'node:fs';
import { Settings, SupportedFrameworks } from '../types/index.js';
import chalk from 'chalk';
import apiRequest from './fetch.js';
// Type for credentials returned from the dashboard
type Credentials = {
  apiKeys: ApiKey[];
  projectId: string;
};

type ApiKey = {
  key: string;
  type: 'development' | 'production';
};

// Fetches project ID and API key by opening the dashboard in the browser
export async function retrieveCredentials(
  settings: Settings,
  keyType: 'development' | 'production' | 'all'
): Promise<Credentials> {
  // Generate a session ID
  const { sessionId } = await generateCredentialsSession(
    settings.baseUrl,
    keyType
  );

  const urlToOpen = `${settings.dashboardUrl}/cli/wizard/${sessionId}`;
  await import('open').then((open) =>
    open.default(urlToOpen, {
      wait: false,
    })
  );

  logger.message(
    `${chalk.dim(
      `Sign in or create an account, finish company info, and create your project credentials. If the browser window didn't open automatically, please open the following link:`
    )}\n\n${chalk.cyan(urlToOpen)}`
  );

  const spinner = logger.createSpinner('dots');
  spinner.start('Waiting for response from dashboard...');

  const credentials = await new Promise<Credentials>(async (resolve) => {
    const interval = setInterval(async () => {
      // Ping the dashboard to see if the credentials are set
      try {
        const res = await apiRequest(
          settings.baseUrl,
          `/cli/wizard/${sessionId}`,
          {
            method: 'GET',
          }
        );
        if (res.status === 200) {
          const data = await res.json();
          resolve(data as Credentials);
          clearInterval(interval);
          clearTimeout(timeout);
          apiRequest(settings.baseUrl, `/cli/wizard/${sessionId}`, {
            method: 'DELETE',
          });
        }
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
  spinner.stop('Received project credentials');
  return credentials;
}

export async function generateCredentialsSession(
  url: string,
  keyType: 'development' | 'production' | 'all'
): Promise<{
  sessionId: string;
}> {
  const res = await apiRequest(url, '/cli/wizard/session', {
    body: { keyType },
  });
  if (!res.ok) {
    logErrorAndExit('Failed to generate credentials session');
  }
  return await res.json();
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

  envContent += `\n${prefix}GT_PROJECT_ID=${credentials.projectId}\n`;

  for (const apiKey of credentials.apiKeys) {
    if (apiKey.type === 'development') {
      envContent += `${prefix || ''}GT_DEV_API_KEY=${apiKey.key}\n`;
    } else {
      envContent += `GT_API_KEY=${apiKey.key}\n`;
    }
  }

  // Ensure we don't have excessive newlines
  envContent = envContent.replace(/\n{3,}/g, '\n\n').trim() + '\n';

  // Write the updated content back to the file
  await fs.promises.writeFile(envFile, envContent, 'utf8');
}
