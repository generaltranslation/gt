import { createSpinner, logErrorAndExit, logMessage } from '../console';
import path from 'node:path';
import fs from 'node:fs';
import { Settings, SupportedFrameworks } from '../types';
import chalk from 'chalk';
// Type for credentials returned from the dashboard
type Credentials = {
  apiKey: string;
  projectId: string;
};

// Fetches project ID and API key by opening the dashboard in the browser
export async function retrieveCredentials(
  settings: Settings,
  keyType: 'development' | 'production'
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

  logMessage(
    `${chalk.gray(
      `If the browser window didn't open automatically, please open the following link:`
    )}\n\n${chalk.cyan(urlToOpen)}`
  );

  const spinner = createSpinner('dots');
  spinner.start('Waiting for response from dashboard...');

  const credentials = await new Promise<Credentials>(
    async (resolve, reject) => {
      const interval = setInterval(async () => {
        // Ping the dashboard to see if the credentials are set
        try {
          const res = await fetch(
            `${settings.baseUrl}/cli/wizard/${sessionId}`,
            {
              method: 'GET',
            }
          );
          if (res.status === 200) {
            const data = await res.json();
            resolve(data as Credentials);
            clearInterval(interval);
            clearTimeout(timeout);
            fetch(`${settings.baseUrl}/cli/wizard/${sessionId}`, {
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
    }
  );
  spinner.stop('Received credentials');
  return credentials;
}

export async function generateCredentialsSession(
  url: string,
  keyType: 'development' | 'production'
): Promise<{
  sessionId: string;
}> {
  const res = await fetch(`${url}/cli/wizard/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      keyType,
    }),
  });
  if (!res.ok) {
    logErrorAndExit('Failed to generate credentials session');
  }
  return await res.json();
}

// Checks if the credentials are set in the environment variables
export function areCredentialsSet() {
  return process.env.GT_PROJECT_ID && process.env.GT_API_KEY;
}

// Sets the credentials in .env.local file
export async function setCredentials(
  credentials: Credentials,
  type: 'development' | 'production',
  framework?: SupportedFrameworks
) {
  const envFile = path.join(process.cwd(), '.env.local');
  let envContent = '';

  // Check if .env.local exists, create it if it doesn't
  if (!fs.existsSync(envFile)) {
    // File doesn't exist, create it
    await fs.promises.writeFile(envFile, '', 'utf8');

    // Add .env.local to .gitignore if it exists
    const gitignoreFile = path.join(process.cwd(), '.gitignore');
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
  if (type === 'development') {
    envContent += `${prefix || ''}GT_DEV_API_KEY=${credentials.apiKey}\n`;
  } else {
    envContent += `GT_API_KEY=${credentials.apiKey}\n`;
  }

  // Ensure we don't have excessive newlines
  envContent = envContent.replace(/\n{3,}/g, '\n\n').trim() + '\n';

  // Write the updated content back to the file
  await fs.promises.writeFile(envFile, envContent, 'utf8');
}
