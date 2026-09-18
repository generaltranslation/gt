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
import * as oidc from 'openid-client';
import type { UserTokenProvider } from 'generaltranslation/api';
import {
  createDiagnosticMessage,
  defaultBaseUrl,
} from 'generaltranslation/internal';
import { GT_DASHBOARD_URL } from '../utils/constants.js';
import { logger } from '../console/logger.js';
import { startLoopbackServer } from './loopback.js';

/** Public native client seeded by the authorization server; never a secret. */
export const OAUTH_CLIENT_ID = 'gt-cli';
/** Explicit on both grants: identity, refresh and the user's dashboard permissions.
 * Must match the seeded gt-cli client; the device endpoint does not default scope.
 */
export const OAUTH_SCOPE = 'openid profile offline_access gt:*';
// Refresh before expiry so an in-flight request does not carry an expired token.
const TOKEN_REFRESH_BUFFER_MS = 30_000;

export type OAuthTokens = {
  accessToken: string;
  expiresAt: number;
  refreshToken: string;
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

export type UserInfo = { email?: string; name?: string; sub: string };
type OAuthRequestOptions = { authBaseUrl?: string; fetch?: typeof fetch };
export type LoginOptions = OAuthRequestOptions & {
  apiResource?: string;
  onAuthorizationUrl?: (url: string) => void;
  openBrowser?: (url: string) => Promise<unknown>;
  timeoutMs?: number;
};

function diagnostic(
  whatHappened: string,
  fix?: string,
  details?: string
): string {
  // The command wrapper supplies the package/severity prefix.
  return createDiagnosticMessage({ whatHappened, fix, details });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const loginRequired = diagnostic(
  'You are not signed in',
  'Run `gt login` to sign in'
);
const obsoleteCredentials = diagnostic(
  'This stored login is obsolete or invalid and cannot be used safely',
  'Run `gt login` again'
);

function parseStoredTokens(value: unknown): OAuthTokens {
  if (
    !isRecord(value) ||
    typeof value.accessToken !== 'string' ||
    !value.accessToken ||
    typeof value.subject !== 'string' ||
    !value.subject ||
    typeof value.expiresAt !== 'number' ||
    !Number.isFinite(value.expiresAt) ||
    typeof value.refreshToken !== 'string' ||
    typeof value.scope !== 'string' ||
    typeof value.tokenType !== 'string' ||
    value.tokenType.toLowerCase() !== 'bearer'
  ) {
    throw new Error(obsoleteCredentials);
  }
  return {
    accessToken: value.accessToken,
    subject: value.subject,
    expiresAt: value.expiresAt,
    refreshToken: value.refreshToken,
    scope: value.scope,
    tokenType: value.tokenType,
  };
}

function oauthError(error: unknown, fallback: string): Error {
  if (
    error instanceof oidc.AuthorizationResponseError ||
    error instanceof oidc.ResponseBodyError
  ) {
    const descriptions: Record<string, string> = {
      access_denied: 'Sign in was denied in the browser',
      expired_token: 'The sign-in code expired before it was approved',
      invalid_scope: 'The authorization server rejected the requested scopes',
      invalid_grant: 'Your login or sign-in code expired or was already used',
      invalid_client: 'This authorization server does not recognize the gt CLI',
      unauthorized_client:
        'This authorization server does not recognize the gt CLI',
    };
    return new Error(
      diagnostic(
        descriptions[error.error] ?? fallback,
        ['invalid_client', 'unauthorized_client'].includes(error.error)
          ? 'Check GT_AUTH_URL or update the server'
          : 'Run `gt login` again',
        // Scope descriptions are useful configuration diagnostics, not token data.
        error.error === 'invalid_scope' ? error.error_description : undefined
      )
    );
  }
  if (error instanceof oidc.ClientError) {
    const status =
      error.cause instanceof Response ? ` (HTTP ${error.cause.status})` : '';
    return new Error(
      diagnostic(
        `${fallback}${status}`,
        'Check the authorization server and try again',
        error.code
      )
    );
  }
  if (
    error instanceof Error &&
    ['AbortError', 'TimeoutError'].includes(error.name)
  ) {
    return new Error(
      diagnostic('Sign in was cancelled or timed out', 'Run `gt login` again')
    );
  }
  // Do not expose transport causes, callback URLs or token responses.
  return new Error(
    diagnostic(fallback, 'Check the authorization server and try again')
  );
}

function assertEndpoint(url: URL, issuer: URL): void {
  if (
    url.username ||
    url.password ||
    url.hash ||
    (url.protocol !== 'https:' &&
      !(issuer.protocol === 'http:' && url.origin === issuer.origin))
  ) {
    throw new Error(
      diagnostic(
        'The authorization server supplied an unsafe endpoint',
        'Use HTTPS, or same-origin local development HTTP'
      )
    );
  }
}

async function configuration({
  authBaseUrl = getAuthBaseUrl(),
  fetch: fetchImplementation = globalThis.fetch,
}: OAuthRequestOptions): Promise<oidc.Configuration> {
  const issuer = new URL(authBaseUrl);
  const local =
    issuer.hostname === 'localhost' ||
    issuer.hostname.endsWith('.localhost') ||
    issuer.hostname === '127.0.0.1' ||
    issuer.hostname === '[::1]';
  if (
    issuer.username ||
    issuer.password ||
    issuer.search ||
    issuer.hash ||
    (issuer.protocol !== 'https:' && !(issuer.protocol === 'http:' && local))
  ) {
    throw new Error(
      diagnostic(
        'GT_AUTH_URL is not a trusted issuer URL',
        'Use HTTPS, or a local development HTTP issuer without credentials, query or fragment'
      )
    );
  }
  return oidc.discovery(issuer, OAUTH_CLIENT_ID, undefined, oidc.None(), {
    execute:
      issuer.protocol === 'http:'
        ? [oidc.enableNonRepudiationChecks, oidc.allowInsecureRequests]
        : [oidc.enableNonRepudiationChecks],
    [oidc.customFetch]: (url, init) => {
      assertEndpoint(new URL(url), issuer);
      return fetchImplementation(url, {
        ...init,
        body:
          init.body instanceof Uint8Array
            ? new Uint8Array(init.body)
            : init.body,
      });
    },
  });
}

function parseTokens(
  result: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers,
  previous?: OAuthTokens
): OAuthTokens {
  const subject = result.claims()?.sub ?? previous?.subject;
  if (!subject || (previous && subject !== previous.subject)) {
    throw new Error(
      diagnostic(
        'The authorization server did not confirm the expected account identity',
        'Run `gt login` again'
      )
    );
  }
  if (
    result.token_type !== 'bearer' ||
    typeof result.expires_in !== 'number' ||
    !Number.isFinite(result.expires_in) ||
    result.expires_in <= 0
  ) {
    throw new Error(
      diagnostic(
        'The authorization server returned an unsupported token type or lifetime'
      )
    );
  }
  return {
    accessToken: result.access_token,
    expiresAt: Date.now() + result.expires_in * 1000,
    refreshToken: result.refresh_token ?? previous?.refreshToken ?? '',
    scope: result.scope ?? previous?.scope ?? OAUTH_SCOPE,
    tokenType: result.token_type,
    subject,
  };
}

export function getAuthBaseUrl(): string {
  return (process.env.GT_AUTH_URL ?? `${GT_DASHBOARD_URL}/api/auth`).replace(
    /\/$/,
    ''
  );
}

/** The API resource is the API origin serialized as a URL href (trailing slash). */
export function getApiResource(): string {
  return new URL(process.env.GT_API_URL ?? defaultBaseUrl).href;
}

export function getCredentialsPath(): string {
  return path.join(
    process.env.XDG_CONFIG_HOME || path.join(homedir(), '.config'),
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
  authBaseUrl = getAuthBaseUrl()
): Promise<OAuthTokens | undefined> {
  const value = (await readCredentialsFile()).servers[authBaseUrl];
  return value === undefined ? undefined : parseStoredTokens(value);
}
export async function writeOAuthTokens(
  tokens: OAuthTokens,
  authBaseUrl = getAuthBaseUrl()
): Promise<void> {
  await setServerTokens(authBaseUrl, tokens);
}
export async function deleteOAuthTokens(
  authBaseUrl = getAuthBaseUrl()
): Promise<void> {
  await setServerTokens(authBaseUrl, undefined);
}

/** Browser authorization code + S256, with the complete callback validated by OIDC. */
export async function login(options: LoginOptions = {}): Promise<OAuthTokens> {
  const authBaseUrl = options.authBaseUrl ?? getAuthBaseUrl();
  const apiResource = options.apiResource ?? getApiResource();
  const config = await configuration({ ...options, authBaseUrl }).catch(
    (error: unknown) => {
      throw oauthError(error, 'Could not discover the authorization server');
    }
  );
  const loopback = await startLoopbackServer();
  let result: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
  try {
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const state = oidc.randomState();
    const authorizationUrl = oidc.buildAuthorizationUrl(config, {
      redirect_uri: loopback.redirectUri,
      scope: OAUTH_SCOPE,
      resource: apiResource,
      state,
      code_challenge: await oidc.calculatePKCECodeChallenge(codeVerifier),
      code_challenge_method: 'S256',
    });
    assertEndpoint(authorizationUrl, new URL(authBaseUrl));
    const callback = loopback.waitForCallback(options.timeoutMs);
    // Printing/launching may fail before we await the listener.
    callback.catch(() => undefined);
    options.onAuthorizationUrl?.(authorizationUrl.href);
    void (options.openBrowser ?? open)(authorizationUrl.href).catch(
      () => undefined
    );
    const callbackUrl = await callback;
    result = await oidc
      .authorizationCodeGrant(
        config,
        callbackUrl,
        {
          pkceCodeVerifier: codeVerifier,
          expectedState: state,
          idTokenExpected: true,
        },
        { resource: apiResource }
      )
      .catch((error: unknown) => {
        throw oauthError(error, 'Could not validate the sign-in response');
      });
  } finally {
    loopback.close();
  }
  const tokens = parseTokens(result);
  await writeOAuthTokens(tokens, authBaseUrl);
  return tokens;
}

const pendingRefreshes = new Map<string, Promise<OAuthTokens>>();
export async function refreshOAuthTokens(
  options: OAuthRequestOptions = {}
): Promise<OAuthTokens> {
  const authBaseUrl = options.authBaseUrl ?? getAuthBaseUrl();
  const pending = pendingRefreshes.get(authBaseUrl);
  if (pending) return pending;
  const refresh = exchangeRefreshToken({ ...options, authBaseUrl });
  pendingRefreshes.set(authBaseUrl, refresh);
  try {
    return await refresh;
  } finally {
    pendingRefreshes.delete(authBaseUrl);
  }
}

async function exchangeRefreshToken(
  options: OAuthRequestOptions
): Promise<OAuthTokens> {
  const current = await readOAuthTokens(options.authBaseUrl);
  if (!current?.refreshToken) throw new Error(loginRequired);
  const result = await (async () =>
    oidc.refreshTokenGrant(
      await configuration(options),
      current.refreshToken
    ))().catch((error: unknown) => {
    throw oauthError(error, 'Could not refresh your login');
  });
  const tokens = parseTokens(result, current);
  await writeOAuthTokens(tokens, options.authBaseUrl);
  return tokens;
}

async function validTokens(
  options: OAuthRequestOptions
): Promise<OAuthTokens | undefined> {
  const tokens = await readOAuthTokens(options.authBaseUrl);
  if (!tokens || tokens.expiresAt > Date.now() + TOKEN_REFRESH_BUFFER_MS)
    return tokens;
  return refreshOAuthTokens(options);
}
export async function getValidAccessToken(
  options: OAuthRequestOptions = {}
): Promise<string | undefined> {
  return (await validTokens(options))?.accessToken;
}

/** Construction is deliberately free of auth/storage/discovery I/O. */
export function createUserTokenProvider(): UserTokenProvider {
  return {
    getAccessToken: async () => {
      const accessToken = await getValidAccessToken();
      if (!accessToken) throw new Error(loginRequired);
      return accessToken;
    },
    refreshAccessToken: async () => (await refreshOAuthTokens()).accessToken,
  };
}

export async function logout(options: OAuthRequestOptions = {}): Promise<void> {
  try {
    const tokens = await readOAuthTokens(options.authBaseUrl);
    if (tokens?.refreshToken)
      await oidc.tokenRevocation(
        await configuration(options),
        tokens.refreshToken,
        { token_type_hint: 'refresh_token' }
      );
  } catch {
    logger.warn(
      createDiagnosticMessage({
        source: 'gt',
        severity: 'Warning',
        whatHappened:
          'Signed out locally, but remote session revocation could not be confirmed',
        fix: 'Revoke the session in the dashboard if needed',
      })
    );
  } finally {
    await deleteOAuthTokens(options.authBaseUrl);
  }
}

export async function whoAmI(
  options: OAuthRequestOptions = {}
): Promise<UserInfo> {
  const tokens = await validTokens(options);
  if (!tokens) throw new Error(loginRequired);
  try {
    const result = await oidc.fetchUserInfo(
      await configuration(options),
      tokens.accessToken,
      tokens.subject
    );
    return { sub: result.sub, email: result.email, name: result.name };
  } catch (error) {
    throw oauthError(error, 'Could not validate your account identity');
  }
}
