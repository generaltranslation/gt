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
import { UserAuthError } from './errors.js';

type WarningHandler = (message: string) => void;

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

async function readCredentialsFile(
  onWarning: WarningHandler = console.warn
): Promise<StoredCredentials> {
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
    onWarning(
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

const LOCK_POLL_MS = 50;
// Above the three requests a refresh can make at the client library's
// 30-second timeout each; a holder still alive after it is treated as hung.
const LOCK_WAIT_MS = 120_000;

/** Whether the process that wrote the lock has exited without removing it. */
async function lockHolderIsGone(lockPath: string): Promise<boolean> {
  const pid = Number(await readFile(lockPath, 'utf8').catch(() => ''));
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return isRecord(error) && error.code === 'ESRCH';
  }
}

/**
 * Runs `work` while no other process does. For work that reads the stored
 * login, spends it and writes its replacement, which two processes at once
 * would each do with the same login.
 */
export async function withCredentialsLock<T>(
  work: () => Promise<T>
): Promise<T> {
  const lockPath = `${getCredentialsPath()}.lock`;
  await mkdir(path.dirname(lockPath), { recursive: true, mode: 0o700 });
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      await writeFile(lockPath, String(process.pid), {
        flag: 'wx',
        mode: 0o600,
      });
      break;
    } catch (error) {
      if (!isRecord(error) || error.code !== 'EEXIST') throw error;
    }
    if (Date.now() > deadline || (await lockHolderIsGone(lockPath)))
      await rm(lockPath, { force: true });
    else await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_MS));
  }
  try {
    return await work();
  } finally {
    await rm(lockPath, { force: true });
  }
}

async function setServerTokens(
  authBaseUrl: string,
  tokens: OAuthTokens | undefined,
  onWarning?: WarningHandler
): Promise<void> {
  const credentials = await readCredentialsFile(onWarning);
  if (tokens) credentials.servers[authBaseUrl] = tokens;
  else delete credentials.servers[authBaseUrl];
  if (Object.keys(credentials.servers).length === 0) {
    await rm(getCredentialsPath(), { force: true });
    return;
  }
  await writeCredentialsFile(credentials);
}

export async function readOAuthTokens(
  authBaseUrl: string,
  onWarning?: WarningHandler
): Promise<OAuthTokens | undefined> {
  const value = (await readCredentialsFile(onWarning)).servers[authBaseUrl];
  return value === undefined ? undefined : parseStoredTokens(value);
}
export async function writeOAuthTokens(
  tokens: OAuthTokens,
  authBaseUrl: string,
  onWarning?: WarningHandler
): Promise<void> {
  await setServerTokens(authBaseUrl, tokens, onWarning);
}
export async function deleteOAuthTokens(
  authBaseUrl: string,
  onWarning?: WarningHandler
): Promise<void> {
  await setServerTokens(authBaseUrl, undefined, onWarning);
}
