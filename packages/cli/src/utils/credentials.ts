import { logErrorAndExit } from '../console/logging.js';
import { logger } from '../console/logger.js';
import path from 'node:path';
import fs from 'node:fs';
import { Settings, SupportedFrameworks } from '../types/index.js';
import chalk from 'chalk';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/internal';
import apiRequest from './fetch.js';
import { createCliAuthorizationCallback } from './cliAuthorizationCallback.js';
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
  const spinner = logger.createSpinner('dots');
  let callback: Awaited<
    ReturnType<typeof createCliAuthorizationCallback>
  > | null = null;

  try {
    callback = await createCliAuthorizationCallback();
    const { sessionId, verifier } = await generateCredentialsSession(
      settings.baseUrl,
      keyType,
      callback.callbackUrl
    );
    const authorizationCode = callback.waitForCode(sessionId);
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
    spinner.start('Waiting for response from dashboard...');

    const credentials = await exchangeCliWizardCredentials(
      settings.baseUrl,
      sessionId,
      verifier,
      await authorizationCode
    );

    spinner.stop('Received credentials');
    return credentials;
  } catch (error) {
    callback?.close();
    spinner.stop('Authorization failed');
    return logErrorAndExit(
      createDiagnosticMessage({
        source: 'gt',
        severity: 'Error',
        whatHappened: 'CLI authorization did not complete',
        fix: 'Run the setup command again and approve the new browser request',
        details: formatDiagnosticErrorDetails(error),
      })
    );
  }
}

export async function exchangeCliWizardCredentials(
  baseUrl: string,
  sessionId: string,
  verifier: string,
  authorizationCode: string
): Promise<Credentials> {
  const response = await apiRequest(
    baseUrl,
    `/cli/wizard/${sessionId}/exchange`,
    {
      body: { authorizationCode },
      headers: { 'x-gt-cli-verifier': verifier },
    }
  );
  if (!response.ok) {
    throw new Error(`Credential exchange returned HTTP ${response.status}`);
  }

  const credentials = await response.json();
  if (!isCredentials(credentials)) {
    throw new Error('Credential exchange returned an invalid response');
  }
  return credentials;
}

export async function generateCredentialsSession(
  url: string,
  keyType: 'development' | 'production' | 'all',
  callbackUrl: string
): Promise<{
  sessionId: string;
  verifier: string;
}> {
  const res = await apiRequest(url, '/cli/wizard/session', {
    body: { callbackUrl, flowVersion: 2, keyType },
  });
  if (!res.ok) {
    throw new Error(`Session creation returned HTTP ${res.status}`);
  }
  const session = await res.json();
  if (!isCredentialSession(session)) {
    throw new Error('Session creation returned an invalid response');
  }
  return session;
}

function isCredentialSession(
  value: unknown
): value is { sessionId: string; verifier: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const { sessionId, verifier } = value as Record<string, unknown>;
  return (
    typeof sessionId === 'string' &&
    sessionId.startsWith('cli_') &&
    typeof verifier === 'string' &&
    /^[A-Za-z0-9_-]{43}$/.test(verifier)
  );
}

function isCredentials(value: unknown): value is Credentials {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const { apiKeys, projectId } = value as Record<string, unknown>;
  return (
    typeof projectId === 'string' &&
    Array.isArray(apiKeys) &&
    apiKeys.length > 0 &&
    apiKeys.every(
      (apiKey) =>
        !!apiKey &&
        typeof apiKey === 'object' &&
        !Array.isArray(apiKey) &&
        typeof (apiKey as Record<string, unknown>).key === 'string' &&
        ['development', 'production'].includes(
          (apiKey as Record<string, unknown>).type as string
        )
    )
  );
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
