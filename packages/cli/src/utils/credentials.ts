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

export type Credentials = { apiKey: string; projectId: string };

// Client-side frameworks only expose variables carrying their public prefix.
const FRAMEWORK_ENV_PREFIXES: Partial<
  Record<NonNullable<SupportedFrameworks>, string>
> = {
  'next-pages': 'NEXT_PUBLIC_',
  vite: 'VITE_',
  gatsby: 'GATSBY_',
  react: 'REACT_APP_',
  redwood: 'REDWOOD_ENV_',
};

/** Names of the runtime variables init writes for this framework. */
export function getDevelopmentEnvNames(framework?: SupportedFrameworks) {
  const prefix = (framework && FRAMEWORK_ENV_PREFIXES[framework]) ?? '';
  return {
    projectId: `${prefix}GT_PROJECT_ID`,
    devApiKey: `${prefix}GT_DEV_API_KEY`,
  };
}

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

/**
 * Whether the project already has a runtime key: the framework's development
 * key or an explicit production key. `settings.projectId` already resolves
 * every framework prefix. This is not tooling auth; login is checked separately.
 */
export function areCredentialsSet(
  settings: Pick<Settings, 'projectId' | 'apiKey'>,
  framework?: SupportedFrameworks
): boolean {
  const { devApiKey } = getDevelopmentEnvNames(framework);
  return Boolean(
    settings.projectId && (settings.apiKey || process.env[devApiKey])
  );
}

// ponytail: line-oriented; multi-line quoted dotenv values are not handled.
function upsertEnvAssignment(
  content: string,
  name: string,
  value: string
): string {
  const assignsName = (line: string) =>
    /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)?.[1] === name;
  const lines = content.split('\n');
  const first = lines.findIndex(assignsName);
  if (first === -1) {
    const separator = content && !content.endsWith('\n') ? '\n' : '';
    return `${content}${separator}${name}=${value}\n`;
  }
  // Replace the first assignment in place and drop stale duplicates.
  return lines
    .map((line, index) => (index === first ? `${name}=${value}` : line))
    .filter((line, index) => index === first || !assignsName(line))
    .join('\n');
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

  // Only the hot-reload key: the CLI itself acts as the signed-in user, and
  // CI keys are created deliberately rather than dropped into .env.local.
  // Other lines, comments, and any GT_API_KEY are left untouched.
  const names = getDevelopmentEnvNames(framework);
  envContent = upsertEnvAssignment(
    envContent,
    names.projectId,
    credentials.projectId
  );
  envContent = upsertEnvAssignment(
    envContent,
    names.devApiKey,
    credentials.apiKey
  );

  await fs.promises.writeFile(envFile, envContent, 'utf8');
}
