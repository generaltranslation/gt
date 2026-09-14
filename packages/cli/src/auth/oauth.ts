import { createHash, randomBytes, randomUUID } from 'node:crypto';
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
import {
  parseAuthorizationCallback,
  startLoopbackServer,
  type AuthorizationCallback,
} from './loopback.js';

export const OAUTH_CLIENT_NAME = 'General Translation CLI';

/**
 * Scopes requested by `gt login`. The provider rejects unknown scopes, so each
 * entry must exist in gt-cloud's oauthProviderConfig. Permission scopes map to
 * the CLI commands that call operations requiring them:
 */
export const OAUTH_SCOPES = [
  'openid', // identity for `gt whoami`
  'profile', // name/email for `gt whoami`
  'offline_access', // refresh tokens so logins outlive the 1h access token
  'project:files:read', // stage/download/status polling, project + branch + file info, orphaned files
  'project:files:write', // upload sources/translations, branches, tags, publish, moves, user-edit diffs, fonts
  'project:translations:enqueue', // translate/enqueue
  'project:translations:generate', // runtime `POST /v2/translate` used by `gt api` and dev workflows
  'project:context:write', // `gt setup`'s project context generation
  'org:projects:create', // `gt project create`
] as const;
export const OAUTH_SCOPE = OAUTH_SCOPES.join(' ');

/**
 * Registered once per authorization server; the provider matches loopback
 * redirect URIs ignoring the port (RFC 8252 §7.3), so the ephemeral port
 * chosen at login does not need to be re-registered.
 */
const REGISTERED_REDIRECT_URI = 'http://127.0.0.1/callback';
// Distinct from defaultTimeout on purpose: refresh slightly before expiry so
// an in-flight request never carries a token that expires mid-request.
const TOKEN_REFRESH_BUFFER_MS = 30_000;

export type OAuthTokens = {
  accessToken: string;
  expiresAt: number;
  refreshToken: string;
  scope: string;
  tokenType: string;
};

export type OAuthClient = {
  clientId: string;
  redirectUri: string;
};

type StoredOAuthTokens = {
  access_token: string;
  expires_at: number;
  refresh_token: string;
  scope: string;
  token_type: string;
};

type StoredOAuthClient = {
  client_id: string;
  redirect_uri: string;
};

type StoredServerCredentials = {
  client?: StoredOAuthClient;
  tokens?: StoredOAuthTokens;
};

type StoredCredentials = {
  version: 2;
  /** Keyed by authorization server base URL so dev and prod logins coexist. */
  servers: Record<string, StoredServerCredentials>;
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

type OpenBrowser = (url: string) => Promise<unknown>;

export type LoginOptions = OAuthRequestOptions & {
  apiResource?: string;
  /** Skip opening a browser; the URL is still reported through onAuthorizationUrl. */
  noBrowser?: boolean;
  onAuthorizationUrl?: (url: string) => void;
  openBrowser?: OpenBrowser;
  /**
   * Headless fallback: called when the loopback listener cannot receive the
   * redirect (bind failure, remote shell, or --no-browser). Should return the
   * full redirect URL or the bare authorization code the user pasted.
   */
  promptForCallback?: () => Promise<string>;
  timeoutMs?: number;
};

export type PkcePair = { codeVerifier: string; codeChallenge: string };

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
      return describeOAuthError(
        optionalStringField(value, 'error'),
        optionalStringField(value, 'error_description'),
        fallback
      );
    }
  } catch {
    // OAuth servers may return an empty or non-JSON error response.
  }
  return fallback;
}

function describeOAuthError(
  error: string | undefined,
  description: string | undefined,
  fallback: string
): string {
  switch (error) {
    case 'access_denied':
      return 'Sign in was denied in the browser';
    case 'invalid_scope':
      return `The authorization server rejected the requested scopes${description ? `: ${description}` : ''}`;
    case 'invalid_grant':
      return 'The sign-in code expired or was already used. Run `gt login` again';
    case 'invalid_client':
      return 'The CLI client registration is no longer valid. Run `gt logout` and `gt login` again';
    default:
      return description ?? error ?? fallback;
  }
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

/** The API resource identifier is the API origin serialized as a URL href (trailing slash). */
export function getApiResource(): string {
  return new URL(process.env.GT_API_URL ?? defaultBaseUrl).href;
}

export function getCredentialsPath(): string {
  const configHome =
    process.env.XDG_CONFIG_HOME || path.join(homedir(), '.config');
  return path.join(configHome, 'gt', 'credentials.json');
}

// ---------------------------------------------------------------------------
// Credentials file
// ---------------------------------------------------------------------------

async function readCredentialsFile(): Promise<StoredCredentials> {
  let contents: string;
  try {
    contents = await readFile(getCredentialsPath(), 'utf8');
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') {
      return { version: 2, servers: {} };
    }
    throw error;
  }

  try {
    const parsed: unknown = JSON.parse(contents);
    if (
      !isRecord(parsed) ||
      parsed.version !== 2 ||
      !isRecord(parsed.servers)
    ) {
      throw new Error('expected version 2 with a servers object');
    }
    const servers: Record<string, StoredServerCredentials> = {};
    for (const [authBaseUrl, entry] of Object.entries(parsed.servers)) {
      if (!isRecord(entry)) throw new Error(`invalid entry for ${authBaseUrl}`);
      const server: StoredServerCredentials = {};
      if (isRecord(entry.client)) {
        server.client = {
          client_id: stringField(entry.client, 'client_id'),
          redirect_uri: stringField(entry.client, 'redirect_uri'),
        };
      }
      if (isRecord(entry.tokens)) {
        server.tokens = {
          access_token: stringField(entry.tokens, 'access_token'),
          expires_at: numberField(entry.tokens, 'expires_at'),
          refresh_token: stringField(entry.tokens, 'refresh_token'),
          scope: stringField(entry.tokens, 'scope'),
          token_type: stringField(entry.tokens, 'token_type'),
        };
      }
      servers[authBaseUrl] = server;
    }
    return { version: 2, servers };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown error';
    throw new Error(`Stored OAuth credentials are invalid: ${detail}`, {
      cause: error,
    });
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

async function updateServerCredentials(
  authBaseUrl: string,
  update: (current: StoredServerCredentials) => StoredServerCredentials | null
): Promise<void> {
  const credentials = await readCredentialsFile();
  const next = update(credentials.servers[authBaseUrl] ?? {});
  if (next === null || (!next.client && !next.tokens)) {
    delete credentials.servers[authBaseUrl];
  } else {
    credentials.servers[authBaseUrl] = next;
  }
  if (Object.keys(credentials.servers).length === 0) {
    await rm(getCredentialsPath(), { force: true });
    return;
  }
  await writeCredentialsFile(credentials);
}

export async function readOAuthTokens(
  authBaseUrl = getAuthBaseUrl()
): Promise<OAuthTokens | undefined> {
  const stored = (await readCredentialsFile()).servers[authBaseUrl]?.tokens;
  if (!stored) return undefined;
  return {
    accessToken: stored.access_token,
    expiresAt: stored.expires_at,
    refreshToken: stored.refresh_token,
    scope: stored.scope,
    tokenType: stored.token_type,
  };
}

export async function writeOAuthTokens(
  tokens: OAuthTokens,
  authBaseUrl = getAuthBaseUrl()
): Promise<void> {
  await updateServerCredentials(authBaseUrl, (current) => ({
    ...current,
    tokens: {
      access_token: tokens.accessToken,
      expires_at: tokens.expiresAt,
      refresh_token: tokens.refreshToken,
      scope: tokens.scope,
      token_type: tokens.tokenType,
    },
  }));
}

/** Removes stored tokens; the client registration is kept for the next login. */
export async function deleteOAuthTokens(
  authBaseUrl = getAuthBaseUrl()
): Promise<void> {
  await updateServerCredentials(authBaseUrl, ({ client }) =>
    client ? { client } : null
  );
}

export async function readOAuthClient(
  authBaseUrl = getAuthBaseUrl()
): Promise<OAuthClient | undefined> {
  const stored = (await readCredentialsFile()).servers[authBaseUrl]?.client;
  if (!stored) return undefined;
  return { clientId: stored.client_id, redirectUri: stored.redirect_uri };
}

export async function writeOAuthClient(
  client: OAuthClient,
  authBaseUrl = getAuthBaseUrl()
): Promise<void> {
  await updateServerCredentials(authBaseUrl, (current) => ({
    ...current,
    client: { client_id: client.clientId, redirect_uri: client.redirectUri },
  }));
}

// ---------------------------------------------------------------------------
// PKCE
// ---------------------------------------------------------------------------

export function createPkcePair(
  codeVerifier = randomBytes(32).toString('base64url')
): PkcePair {
  return {
    codeVerifier,
    codeChallenge: createHash('sha256')
      .update(codeVerifier)
      .digest('base64url'),
  };
}

// ---------------------------------------------------------------------------
// Dynamic client registration
// ---------------------------------------------------------------------------

export async function registerOAuthClient({
  authBaseUrl = getAuthBaseUrl(),
  fetch: fetchImplementation = globalThis.fetch,
}: OAuthRequestOptions = {}): Promise<OAuthClient> {
  const response = await fetchImplementation(`${authBaseUrl}/oauth2/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: OAUTH_CLIENT_NAME,
      // Registration defaults application_type to "web", which rejects http
      // loopback redirects; native permits http://127.0.0.1 on any port.
      application_type: 'native',
      redirect_uris: [REGISTERED_REDIRECT_URI],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      scope: OAUTH_SCOPE,
    }),
  });
  if (!response.ok) {
    throw new Error(
      await getOAuthErrorMessage(response, 'Could not register the CLI client')
    );
  }
  const value = await readJson(response);
  const client = {
    clientId: stringField(value, 'client_id'),
    redirectUri: REGISTERED_REDIRECT_URI,
  };
  await writeOAuthClient(client, authBaseUrl);
  return client;
}

async function getOrRegisterOAuthClient(
  options: OAuthRequestOptions
): Promise<OAuthClient> {
  return (
    (await readOAuthClient(options.authBaseUrl)) ??
    (await registerOAuthClient(options))
  );
}

// ---------------------------------------------------------------------------
// Authorization code + PKCE
// ---------------------------------------------------------------------------

export function buildAuthorizationUrl({
  authBaseUrl,
  clientId,
  redirectUri,
  codeChallenge,
  state,
  apiResource,
}: {
  authBaseUrl: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
  apiResource: string;
}): string {
  const url = new URL(`${authBaseUrl}/oauth2/authorize`);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: OAUTH_SCOPE,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    resource: apiResource,
  }).toString();
  return url.toString();
}

export async function exchangeAuthorizationCode({
  authBaseUrl = getAuthBaseUrl(),
  fetch: fetchImplementation = globalThis.fetch,
  clientId,
  code,
  codeVerifier,
  redirectUri,
  apiResource,
}: OAuthRequestOptions & {
  clientId: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
  apiResource: string;
}): Promise<OAuthTokens> {
  const response = await fetchImplementation(`${authBaseUrl}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
      resource: apiResource,
    }),
  });
  if (!response.ok) {
    throw new Error(
      await getOAuthErrorMessage(response, 'Could not complete sign in')
    );
  }
  return parseTokens(await readJson(response));
}

/**
 * Accepts either the full redirect URL or a bare authorization code pasted by
 * the user when the loopback redirect cannot reach this process.
 */
export function parsePastedCallback(input: string): AuthorizationCallback {
  const trimmed = input.trim();
  if (!trimmed) return {};
  if (/^https?:\/\//i.test(trimmed)) {
    return parseAuthorizationCallback(trimmed);
  }
  return { code: trimmed };
}

function assertCallback(
  callback: AuthorizationCallback,
  expectedState: string,
  stateRequired: boolean
): string {
  if (callback.error) {
    throw new Error(
      describeOAuthError(
        callback.error,
        callback.errorDescription,
        'Sign in failed'
      )
    );
  }
  if (
    (stateRequired || callback.state !== undefined) &&
    callback.state !== expectedState
  ) {
    throw new Error(
      'Sign in response did not match this login attempt (state mismatch). Run `gt login` again'
    );
  }
  if (!callback.code) {
    throw new Error('Sign in response did not include an authorization code');
  }
  return callback.code;
}

export async function login(options: LoginOptions = {}): Promise<OAuthTokens> {
  const authBaseUrl = options.authBaseUrl ?? getAuthBaseUrl();
  const apiResource = options.apiResource ?? getApiResource();
  const requestOptions = { authBaseUrl, fetch: options.fetch };
  const client = await getOrRegisterOAuthClient(requestOptions);
  const { codeVerifier, codeChallenge } = createPkcePair();
  const state = randomBytes(16).toString('base64url');

  let loopback: Awaited<ReturnType<typeof startLoopbackServer>> | undefined;
  if (!options.noBrowser) {
    try {
      loopback = await startLoopbackServer();
    } catch {
      // Fall through to the paste-the-code flow below.
    }
  }
  const redirectUri = loopback?.redirectUri ?? client.redirectUri;

  const authorizationUrl = buildAuthorizationUrl({
    authBaseUrl,
    clientId: client.clientId,
    redirectUri,
    codeChallenge,
    state,
    apiResource,
  });
  options.onAuthorizationUrl?.(authorizationUrl);
  if (!options.noBrowser) {
    await (options.openBrowser ?? open)(authorizationUrl).catch(
      () => undefined
    );
  }

  let code: string;
  try {
    if (loopback) {
      const callback = await loopback.waitForCallback(options.timeoutMs);
      code = assertCallback(callback, state, true);
    } else {
      if (!options.promptForCallback) {
        throw new Error(
          'No browser is available and no way to receive the sign-in code was provided'
        );
      }
      const pasted = parsePastedCallback(await options.promptForCallback());
      code = assertCallback(pasted, state, false);
    }
  } finally {
    loopback?.close();
  }

  const tokens = await exchangeAuthorizationCode({
    ...requestOptions,
    clientId: client.clientId,
    code,
    codeVerifier,
    redirectUri,
    apiResource,
  });
  await writeOAuthTokens(tokens, authBaseUrl);
  return tokens;
}

// ---------------------------------------------------------------------------
// Refresh / logout / userinfo
// ---------------------------------------------------------------------------

export async function refreshOAuthTokens({
  authBaseUrl = getAuthBaseUrl(),
  fetch: fetchImplementation = globalThis.fetch,
}: OAuthRequestOptions = {}): Promise<OAuthTokens> {
  const current = await readOAuthTokens(authBaseUrl);
  const client = await readOAuthClient(authBaseUrl);
  if (!current?.refreshToken || !client) {
    throw new Error('Run `gt login` to sign in');
  }

  const response = await fetchImplementation(`${authBaseUrl}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: client.clientId,
      grant_type: 'refresh_token',
      refresh_token: current.refreshToken,
    }),
  });
  if (!response.ok) {
    throw new Error('Your login expired. Run `gt login` to sign in again');
  }
  const tokens = parseTokens(await readJson(response), current);
  await writeOAuthTokens(tokens, authBaseUrl);
  return tokens;
}

export async function getValidAccessToken(
  options: OAuthRequestOptions = {}
): Promise<string | undefined> {
  const authBaseUrl = options.authBaseUrl ?? getAuthBaseUrl();
  const tokens = await readOAuthTokens(authBaseUrl);
  if (!tokens) return undefined;
  if (tokens.expiresAt > Date.now() + TOKEN_REFRESH_BUFFER_MS) {
    return tokens.accessToken;
  }
  return (await refreshOAuthTokens({ ...options, authBaseUrl })).accessToken;
}

export async function logout({
  authBaseUrl = getAuthBaseUrl(),
  fetch: fetchImplementation = globalThis.fetch,
}: OAuthRequestOptions = {}): Promise<void> {
  const tokens = await readOAuthTokens(authBaseUrl);
  const client = await readOAuthClient(authBaseUrl);
  try {
    if (tokens?.refreshToken && client) {
      await fetchImplementation(`${authBaseUrl}/oauth2/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: client.clientId,
          token: tokens.refreshToken,
          token_type_hint: 'refresh_token',
        }),
      });
    }
  } finally {
    await deleteOAuthTokens(authBaseUrl);
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
