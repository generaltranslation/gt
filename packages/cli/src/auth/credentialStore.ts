import { randomUUID } from 'node:crypto';
import {
  chmod,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { logger } from '../console/logger.js';
import { UserAuthError } from './errors.js';

export type OAuthTokens = {
  accessToken: string;
  expiresAt: number;
  refreshToken: string;
  /** API resource (origin href) the tokens were issued for. */
  resource: string;
  scope: string;
  tokenType: string;
  /** Subject from a validated, signature-checked ID token. */
  subject: string;
};

type StoredCredentials = {
  version: 2;
  // Validate only the selected entry; obsolete sibling sessions must survive.
  servers: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseStoredTokens(value: unknown): OAuthTokens {
  if (
    !isRecord(value) ||
    typeof value.accessToken !== 'string' ||
    !value.accessToken ||
    typeof value.subject !== 'string' ||
    !value.subject ||
    typeof value.resource !== 'string' ||
    !value.resource ||
    typeof value.expiresAt !== 'number' ||
    !Number.isFinite(value.expiresAt) ||
    typeof value.refreshToken !== 'string' ||
    typeof value.scope !== 'string' ||
    typeof value.tokenType !== 'string' ||
    value.tokenType.toLowerCase() !== 'bearer'
  ) {
    throw new UserAuthError(
      'obsolete_credentials',
      'This stored login is obsolete or invalid and cannot be used safely',
      'Run `gt login` again'
    );
  }
  return {
    accessToken: value.accessToken,
    subject: value.subject,
    resource: value.resource,
    expiresAt: value.expiresAt,
    refreshToken: value.refreshToken,
    scope: value.scope,
    tokenType: value.tokenType,
  };
}

export function getCredentialsPath(): string {
  // XDG Base Directory spec: relative XDG_* values are invalid and ignored.
  const stateHome = process.env.XDG_STATE_HOME;
  return path.join(
    stateHome && path.isAbsolute(stateHome)
      ? stateHome
      : path.join(homedir(), '.local', 'state'),
    'gt',
    'credentials.json'
  );
}

async function readCredentialsFile(): Promise<StoredCredentials> {
  const credentialsPath = getCredentialsPath();
  let contents: string;
  try {
    contents = await readFile(credentialsPath, 'utf8');
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT')
      return { version: 2, servers: {} };
    throw error;
  }
  try {
    const parsed: unknown = JSON.parse(contents);
    if (!isRecord(parsed) || parsed.version !== 2 || !isRecord(parsed.servers))
      throw new Error();
    return { version: 2, servers: parsed.servers };
  } catch {
    const backupPath = `${credentialsPath}.corrupt-${Date.now()}`;
    await rename(credentialsPath, backupPath);
    logger.warn(
      createDiagnosticMessage({
        source: 'gt',
        severity: 'Warning',
        whatHappened:
          'Stored OAuth credentials were invalid and have been reset',
        reassurance: 'The unreadable file was preserved',
        details: backupPath,
        fix: 'Run `gt login` again',
      })
    );
    return { version: 2, servers: {} };
  }
}

async function writeCredentialsFile(
  credentials: StoredCredentials
): Promise<void> {
  const credentialsPath = getCredentialsPath();
  const directory = path.dirname(credentialsPath);
  const temporaryPath = path.join(
    directory,
    `.credentials-${randomUUID()}.tmp`
  );
  await mkdir(directory, { recursive: true, mode: 0o700 });
  try {
    await writeFile(
      temporaryPath,
      `${JSON.stringify(credentials, null, 2)}\n`,
      { encoding: 'utf8', mode: 0o600 }
    );
    await rename(temporaryPath, credentialsPath);
    await chmod(credentialsPath, 0o600);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

async function setServerTokens(
  authBaseUrl: string,
  tokens: OAuthTokens | undefined
): Promise<void> {
  const credentials = await readCredentialsFile();
  if (tokens) credentials.servers[authBaseUrl] = tokens;
  else delete credentials.servers[authBaseUrl];
  if (Object.keys(credentials.servers).length === 0) {
    await rm(getCredentialsPath(), { force: true });
    return;
  }
  await writeCredentialsFile(credentials);
}

export async function readOAuthTokens(
  authBaseUrl: string
): Promise<OAuthTokens | undefined> {
  const value = (await readCredentialsFile()).servers[authBaseUrl];
  return value === undefined ? undefined : parseStoredTokens(value);
}
export async function writeOAuthTokens(
  tokens: OAuthTokens,
  authBaseUrl: string
): Promise<void> {
  await setServerTokens(authBaseUrl, tokens);
}
export async function deleteOAuthTokens(authBaseUrl: string): Promise<void> {
  await setServerTokens(authBaseUrl, undefined);
}
