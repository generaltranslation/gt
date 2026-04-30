import { logErrorAndExit } from '../console/logging.js';
import path from 'node:path';
import fs from 'node:fs';
import { Settings, SupportedFrameworks } from '../types/index.js';

export const BROWSER_AUTH_UNAVAILABLE_MESSAGE =
  'Automatic browser-based CLI login is temporarily unavailable. Create an API key in the General Translation dashboard, then provide credentials manually: set GT_PROJECT_ID and GT_API_KEY (or GT_DEV_API_KEY) environment variables, add projectId to gt.config.json, or pass --project-id and --api-key to commands that support them.';

// Type for credentials returned from the dashboard
type Credentials = {
  apiKeys: ApiKey[];
  projectId: string;
};

type ApiKey = {
  key: string;
  type: 'development' | 'production';
};

// Browser credential retrieval is temporarily unavailable.
export async function retrieveCredentials(
  _settings: Settings,
  _keyType: 'development' | 'production' | 'all'
): Promise<Credentials> {
  return logBrowserAuthUnavailableAndExit();
}

export function logBrowserAuthUnavailableAndExit(): never {
  return logErrorAndExit(BROWSER_AUTH_UNAVAILABLE_MESSAGE);
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
