import { logErrorAndExit } from '../console/logging.js';
import { logger } from '../console/logger.js';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { Settings, SupportedFrameworks } from '../types/index.js';
import chalk from 'chalk';
import {
  createApiClient,
  createCliWizardSession,
  deleteCliWizardSession,
  getCliWizardSession,
  type GetCliWizardSessionResponse,
} from 'generaltranslation/api';
import {
  createDiagnosticMessage,
  unwrapApiResult,
} from 'generaltranslation/internal';

const unsafeCredentialsEnvError = createDiagnosticMessage({
  whatHappened: 'Cannot safely update .env.local',
  reassurance: 'The existing .env.local file was not changed',
  fix: 'Move multiline values away from project/key assignments or set the development credentials manually, then retry',
});

function unwritableEnvFileError(envFile: string): string {
  return createDiagnosticMessage({
    whatHappened: `${envFile} is not a regular file`,
    reassurance: 'Nothing was changed',
    fix: 'Replace it with a regular file or a symlink to one, or set the development credentials manually, then retry',
  });
}

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
 * key, or an explicit production key for server runtimes (gt-next, gt-node).
 * Browser frameworks only read their prefixed key, so there `settings.apiKey`
 * is tooling auth alone. `settings.projectId` already resolves every
 * framework prefix. Login is checked separately.
 */
export function areCredentialsSet(
  settings: Pick<Settings, 'projectId' | 'apiKey'>,
  framework?: SupportedFrameworks
): boolean {
  const { devApiKey } = getDevelopmentEnvNames(framework);
  const browserOnly = Boolean(framework && FRAMEWORK_ENV_PREFIXES[framework]);
  return Boolean(
    settings.projectId &&
    (process.env[devApiKey] || (!browserOnly && settings.apiKey))
  );
}

function assignedName(line: string): string | undefined {
  return /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)?.[1];
}

/**
 * dotenv continues a quoted value onto later lines until its closing quote.
 * Replacing such a line would orphan the continuation, even when a later
 * duplicate hides the multiline value from dotenv's effective values.
 */
function opensMultilineValue(line: string): boolean {
  const value = line.slice(line.indexOf('=') + 1).trim();
  const quote = value[0];
  return (
    ['"', "'", '`'].includes(quote) &&
    !value.slice(1).replaceAll(`\\${quote}`, '').includes(quote)
  );
}

function upsertEnvAssignment(
  content: string,
  name: string,
  value: string
): string {
  const assignsName = (line: string) => assignedName(line) === name;
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

/**
 * Where .env.local content lives and its mode. Follows an existing symlink so
 * its referent is replaced, never the link itself; anything but a regular
 * file (dangling link, directory) fails before any write.
 */
async function resolveEnvFile(
  envFile: string
): Promise<{ target: string; mode: number } | undefined> {
  const entry = await fs.promises.lstat(envFile).catch((error) => {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  });
  if (!entry) return undefined;
  // stat follows the link and fails on a dangling one.
  const stat = await fs.promises.stat(envFile).catch((error) => {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  });
  if (!stat?.isFile()) throw new Error(unwritableEnvFileError(envFile));
  return {
    target: entry.isSymbolicLink()
      ? await fs.promises.realpath(envFile)
      : envFile,
    mode: stat.mode & 0o777,
  };
}

// Same-directory temporary file and rename, as in auth/credentialStore.ts:
// a failed write never truncates the existing file.
async function writeEnvFileAtomically(
  target: string,
  content: string,
  mode: number
): Promise<void> {
  const temporaryPath = path.join(
    path.dirname(target),
    `.env.local.${randomUUID()}.tmp`
  );
  try {
    await fs.promises.writeFile(temporaryPath, content, {
      encoding: 'utf8',
      flag: 'wx',
      mode,
    });
    await fs.promises.chmod(temporaryPath, mode);
    await fs.promises.rename(temporaryPath, target);
  } catch (error) {
    await fs.promises.rm(temporaryPath, { force: true });
    throw error;
  }
}

// Sets the credentials in .env.local file
export async function setCredentials(
  credentials: Credentials,
  framework?: SupportedFrameworks,
  cwd: string = process.cwd()
) {
  const envFile = path.join(cwd, '.env.local');
  const existingEnvFile = await resolveEnvFile(envFile);
  let envContent = '';

  // Check if .env.local exists, create it if it doesn't
  if (!existingEnvFile) {
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
    envContent = await fs.promises.readFile(existingEnvFile.target, 'utf8');
  }

  // Only the hot-reload key: the CLI itself acts as the signed-in user, and
  // CI keys are created deliberately rather than dropped into .env.local.
  // Other lines, comments, and any GT_API_KEY are left untouched.
  const names = getDevelopmentEnvNames(framework);
  const targetNames = Object.values(names);
  const targetOpensMultiline = envContent
    .split('\n')
    .some(
      (line) =>
        targetNames.includes(assignedName(line) ?? '') &&
        opensMultilineValue(line)
    );
  const original = dotenv.parse(envContent);
  const expected = {
    ...original,
    [names.projectId]: credentials.projectId,
    [names.devApiKey]: credentials.apiKey,
  };
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

  const updated = dotenv.parse(envContent);
  if (
    targetOpensMultiline ||
    targetNames.some((name) => original[name]?.includes('\n')) ||
    Object.keys(updated).length !== Object.keys(expected).length ||
    Object.entries(expected).some(([name, value]) => updated[name] !== value)
  ) {
    throw new Error(unsafeCredentialsEnvError);
  }

  await writeEnvFileAtomically(
    existingEnvFile?.target ?? envFile,
    envContent,
    existingEnvFile?.mode ?? 0o600
  );
}
