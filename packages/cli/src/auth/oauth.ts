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

type StoredOAuthTokens = {
  access_token: string;
  expires_at: number;
  refresh_token: string;
  scope: string;
  token_type: string;
};

type StoredCredentials = {
  tokens: StoredOAuthTokens;
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

async function getOAuthErrorMessage(
  response: Response,
  fallback: string
): Promise<string> {
  try {
    const value: unknown = await response.json();
    if (isRecord(value)) {
      return (
        optionalStringField(value, 'error_description') ??
        optionalStringField(value, 'error') ??
        fallback
      );
    }
  } catch {
    // OAuth servers may return an empty or non-JSON error response.
  }
  return fallback;
}

function parseTokens(
  value: Record<string, unknown>,
  previous?: OAuthTokens,
  now = Date.now()
): OAuthTokens {
  return {
    accessToken: stringField(value, 'access_token'),
    expiresAt: now + numberField(value, 'expires_in') * 1000,
    refreshToken:
      optionalStringField(value, 'refresh_token') ??
      previous?.refreshToken ??
      '',
    scope: optionalStringField(value, 'scope') ?? previous?.scope ?? '',
    tokenType:
      optionalStringField(value, 'token_type') ??
      previous?.tokenType ??
      'Bearer',
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
  let contents: string;
  try {
    contents = await readFile(getCredentialsPath(), 'utf8');
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') return undefined;
    throw error;
  }

  try {
    const parsed: unknown = JSON.parse(contents);
    if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.tokens)) {
      throw new Error('expected version 1 with a tokens object');
    }
    return {
      accessToken: stringField(parsed.tokens, 'access_token'),
      expiresAt: numberField(parsed.tokens, 'expires_at'),
      refreshToken: stringField(parsed.tokens, 'refresh_token'),
      scope: stringField(parsed.tokens, 'scope'),
      tokenType: stringField(parsed.tokens, 'token_type'),
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown error';
    throw new Error(`Stored OAuth credentials are invalid: ${detail}`, {
      cause: error,
    });
  }
}

export async function writeOAuthTokens(tokens: OAuthTokens): Promise<void> {
  const credentialsPath = getCredentialsPath();
  const directory = path.dirname(credentialsPath);
  const temporaryPath = path.join(
    directory,
    `.credentials-${randomUUID()}.tmp`
  );
  const credentials: StoredCredentials = {
    version: 1,
    tokens: {
      access_token: tokens.accessToken,
      expires_at: tokens.expiresAt,
      refresh_token: tokens.refreshToken,
      scope: tokens.scope,
      token_type: tokens.tokenType,
    },
  };

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
  if (!response.ok) {
    throw new Error(
      await getOAuthErrorMessage(
        response,
        'Could not start device authorization'
      )
    );
  }
  const value = await readJson(response);
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
    if (now() >= deadline) break;

    const response = await fetchImplementation(`${authBaseUrl}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: OAUTH_CLIENT_ID,
        device_code: deviceCode.deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });
    if (response.ok) {
      return parseTokens(await readJson(response), undefined, now());
    }

    let value: Record<string, unknown> | undefined;
    try {
      const parsed: unknown = await response.json();
      if (isRecord(parsed)) value = parsed;
    } catch {
      // Fall through to the stable device-authorization error below.
    }
    const oauthError = value && optionalStringField(value, 'error');
    if (oauthError === 'authorization_pending') continue;
    if (oauthError === 'slow_down') {
      intervalSeconds += SLOW_DOWN_INCREMENT_SECONDS;
      continue;
    }
    throw new Error(
      (value && optionalStringField(value, 'error_description')) ??
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
  ).catch(() => undefined);
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
  if (!response.ok) {
    throw new Error('Your login expired. Run `gt login` to sign in again');
  }
  const tokens = parseTokens(await readJson(response), current);
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
  if (!response.ok) throw new Error('Could not load your account');
  const value = await readJson(response);
  return {
    sub: stringField(value, 'sub'),
    email: optionalStringField(value, 'email'),
    name: optionalStringField(value, 'name'),
  };
}
