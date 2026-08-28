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
import open from 'open';
import { defaultBaseUrl } from 'generaltranslation/internal';
import { GT_DASHBOARD_URL } from '../utils/constants.js';

export const OAUTH_CLIENT_ID = 'gt-cli';
export const OAUTH_SCOPES = 'openid profile offline_access api:read api:write';
const TOKEN_REFRESH_BUFFER_MS = 60_000;
const DEFAULT_POLL_INTERVAL_SECONDS = 5;
const SLOW_DOWN_INCREMENT_SECONDS = 5;

export type OAuthTokens = {
  accessToken: string;
  expiresAt: number;
  refreshToken: string;
  scope: string;
  tokenType: string;
};

type StoredCredentials = {
  tokens: OAuthTokens;
  version: 1;
};

export type DeviceCode = {
  deviceCode: string;
  expiresIn: number;
  interval: number;
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
};

export type UserInfo = {
  email?: string;
  name?: string;
  sub: string;
};

type OAuthRequestOptions = {
  authBaseUrl?: string;
  fetch?: typeof fetch;
};

type PollDeviceTokenOptions = OAuthRequestOptions & {
  deviceCode: DeviceCode;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
};

type OpenBrowser = (url: string) => Promise<unknown>;

type LoginOptions = OAuthRequestOptions & {
  apiResource?: string;
  onDeviceCode?: (deviceCode: DeviceCode) => void;
  openBrowser?: OpenBrowser;
  sleep?: (milliseconds: number) => Promise<void>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringField(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  if (typeof field !== 'string' || !field) {
    throw new Error(`OAuth response is missing ${key}`);
  }
  return field;
}

function numberField(value: Record<string, unknown>, key: string): number {
  const field = value[key];
  if (typeof field !== 'number' || !Number.isFinite(field)) {
    throw new Error(`OAuth response is missing ${key}`);
  }
  return field;
}

function optionalStringField(
  value: Record<string, unknown>,
  key: string
): string | undefined {
  const field = value[key];
  return typeof field === 'string' && field ? field : undefined;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const value: unknown = await response.json();
  if (!isRecord(value)) throw new Error('OAuth server returned invalid JSON');
  return value;
}

function parseTokens(
  value: Record<string, unknown>,
  previousRefreshToken?: string,
  now = Date.now()
): OAuthTokens {
  return {
    accessToken: stringField(value, 'access_token'),
    expiresAt: now + numberField(value, 'expires_in') * 1000,
    refreshToken:
      optionalStringField(value, 'refresh_token') ?? previousRefreshToken ?? '',
    scope: optionalStringField(value, 'scope') ?? '',
    tokenType: optionalStringField(value, 'token_type') ?? 'Bearer',
  };
}

export function getAuthBaseUrl(): string {
  return (process.env.GT_AUTH_URL ?? `${GT_DASHBOARD_URL}/api/auth`).replace(
    /\/$/,
    ''
  );
}

export function getApiResource(): string {
  return (process.env.GT_API_URL ?? defaultBaseUrl).replace(/\/$/, '');
}

export function getCredentialsPath(): string {
  const configHome =
    process.env.XDG_CONFIG_HOME || path.join(homedir(), '.config');
  return path.join(configHome, 'gt', 'credentials.json');
}

export async function readOAuthTokens(): Promise<OAuthTokens | undefined> {
  try {
    const parsed: unknown = JSON.parse(
      await readFile(getCredentialsPath(), 'utf8')
    );
    if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.tokens)) {
      return undefined;
    }
    const tokens = parsed.tokens;
    return {
      accessToken: stringField(tokens, 'accessToken'),
      expiresAt: numberField(tokens, 'expiresAt'),
      refreshToken: stringField(tokens, 'refreshToken'),
      scope: stringField(tokens, 'scope'),
      tokenType: stringField(tokens, 'tokenType'),
    };
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') return undefined;
    return undefined;
  }
}

export async function writeOAuthTokens(tokens: OAuthTokens): Promise<void> {
  const credentialsPath = getCredentialsPath();
  const directory = path.dirname(credentialsPath);
  const temporaryPath = path.join(
    directory,
    `.credentials-${randomUUID()}.tmp`
  );
  const credentials: StoredCredentials = { version: 1, tokens };

  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(temporaryPath, `${JSON.stringify(credentials, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  try {
    await rename(temporaryPath, credentialsPath);
    await chmod(credentialsPath, 0o600);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

export async function deleteOAuthTokens(): Promise<void> {
  await rm(getCredentialsPath(), { force: true });
}

export async function requestDeviceCode({
  authBaseUrl = getAuthBaseUrl(),
  apiResource = getApiResource(),
  fetch: fetchImplementation = globalThis.fetch,
}: LoginOptions = {}): Promise<DeviceCode> {
  const response = await fetchImplementation(`${authBaseUrl}/device/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: OAUTH_CLIENT_ID,
      resource: apiResource,
      scope: OAUTH_SCOPES,
    }),
  });
  const value = await readJson(response);
  if (!response.ok) {
    throw new Error(
      optionalStringField(value, 'error_description') ??
        optionalStringField(value, 'error') ??
        'Could not start device authorization'
    );
  }
  return {
    deviceCode: stringField(value, 'device_code'),
    expiresIn: numberField(value, 'expires_in'),
    interval:
      typeof value.interval === 'number'
        ? value.interval
        : DEFAULT_POLL_INTERVAL_SECONDS,
    userCode: stringField(value, 'user_code'),
    verificationUri: stringField(value, 'verification_uri'),
    verificationUriComplete: optionalStringField(
      value,
      'verification_uri_complete'
    ),
  };
}

export async function pollDeviceToken({
  authBaseUrl = getAuthBaseUrl(),
  deviceCode,
  fetch: fetchImplementation = globalThis.fetch,
  now = Date.now,
  sleep = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
}: PollDeviceTokenOptions): Promise<OAuthTokens> {
  const deadline = now() + deviceCode.expiresIn * 1000;
  let intervalSeconds = deviceCode.interval;

  while (now() < deadline) {
    await sleep(intervalSeconds * 1000);
    const response = await fetchImplementation(`${authBaseUrl}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: OAUTH_CLIENT_ID,
        device_code: deviceCode.deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });
    const value = await readJson(response);
    if (response.ok) return parseTokens(value, undefined, now());

    const oauthError = optionalStringField(value, 'error');
    if (oauthError === 'authorization_pending') continue;
    if (oauthError === 'slow_down') {
      intervalSeconds += SLOW_DOWN_INCREMENT_SECONDS;
      continue;
    }
    throw new Error(
      optionalStringField(value, 'error_description') ??
        oauthError ??
        'Device authorization failed'
    );
  }

  throw new Error('Device authorization expired before it was approved');
}

export async function login(options: LoginOptions = {}): Promise<OAuthTokens> {
  const deviceCode = await requestDeviceCode(options);
  options.onDeviceCode?.(deviceCode);
  await (options.openBrowser ?? open)(
    deviceCode.verificationUriComplete ?? deviceCode.verificationUri
  );
  const tokens = await pollDeviceToken({
    authBaseUrl: options.authBaseUrl,
    deviceCode,
    fetch: options.fetch,
    sleep: options.sleep,
  });
  await writeOAuthTokens(tokens);
  return tokens;
}

export async function refreshOAuthTokens({
  authBaseUrl = getAuthBaseUrl(),
  fetch: fetchImplementation = globalThis.fetch,
}: OAuthRequestOptions = {}): Promise<OAuthTokens> {
  const current = await readOAuthTokens();
  if (!current?.refreshToken) throw new Error('Run `gt login` to sign in');

  const response = await fetchImplementation(`${authBaseUrl}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: OAUTH_CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: current.refreshToken,
    }),
  });
  const value = await readJson(response);
  if (!response.ok) {
    throw new Error('Your login expired. Run `gt login` to sign in again');
  }
  const tokens = parseTokens(value, current.refreshToken);
  await writeOAuthTokens(tokens);
  return tokens;
}

export async function getValidAccessToken(
  options: OAuthRequestOptions = {}
): Promise<string | undefined> {
  const tokens = await readOAuthTokens();
  if (!tokens) return undefined;
  if (tokens.expiresAt > Date.now() + TOKEN_REFRESH_BUFFER_MS) {
    return tokens.accessToken;
  }
  return (await refreshOAuthTokens(options)).accessToken;
}

export async function logout({
  authBaseUrl = getAuthBaseUrl(),
  fetch: fetchImplementation = globalThis.fetch,
}: OAuthRequestOptions = {}): Promise<void> {
  const tokens = await readOAuthTokens();
  try {
    if (tokens?.refreshToken) {
      await fetchImplementation(`${authBaseUrl}/oauth2/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: OAUTH_CLIENT_ID,
          token: tokens.refreshToken,
          token_type_hint: 'refresh_token',
        }),
      });
    }
  } finally {
    await deleteOAuthTokens();
  }
}

export async function whoAmI({
  authBaseUrl = getAuthBaseUrl(),
  fetch: fetchImplementation = globalThis.fetch,
}: OAuthRequestOptions = {}): Promise<UserInfo> {
  const accessToken = await getValidAccessToken({
    authBaseUrl,
    fetch: fetchImplementation,
  });
  if (!accessToken) throw new Error('Run `gt login` to sign in');
  const response = await fetchImplementation(`${authBaseUrl}/oauth2/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const value = await readJson(response);
  if (!response.ok) throw new Error('Could not load your account');
  return {
    sub: stringField(value, 'sub'),
    email: optionalStringField(value, 'email'),
    name: optionalStringField(value, 'name'),
  };
}
