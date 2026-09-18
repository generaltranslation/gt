import open from 'open';
import * as oidc from 'openid-client';
import type { UserTokenProvider } from 'generaltranslation/api';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { defaultBaseUrl } from 'generaltranslation/internal';
import { GT_DASHBOARD_URL } from '../utils/constants.js';
import { logger } from '../console/logger.js';
import {
  deleteOAuthTokens,
  readOAuthTokens,
  writeOAuthTokens,
} from './credentialStore.js';
import type { OAuthTokens } from './credentialStore.js';
import { UserAuthError, loginRequiredError } from './errors.js';
import { startLoopbackServer } from './loopback.js';

/** Public native client seeded by the authorization server; never a secret. */
const OAUTH_CLIENT_ID = 'gt-cli';
/** Explicit on both grants: identity, refresh and the user's dashboard permissions.
 * Must match the seeded gt-cli client; the device endpoint does not default scope.
 */
const OAUTH_SCOPE = 'openid profile offline_access gt:*';
// Refresh before expiry so an in-flight request does not carry an expired token.
const TOKEN_REFRESH_BUFFER_MS = 30_000;

export type DeviceCode = {
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
};
export type UserInfo = { email?: string; name?: string; sub: string };
type OAuthRequestOptions = { authBaseUrl?: string; fetch?: typeof fetch };
export type UserTokenProviderOptions = OAuthRequestOptions & {
  /** API the requests go to; must match the resource the login was issued for. */
  baseUrl: string;
};
export type LoginOptions = OAuthRequestOptions & {
  /** API the token is issued for; GT_API_URL overrides, then the public API. */
  baseUrl?: string;
  noBrowser?: boolean;
  onDeviceCode?: (deviceCode: DeviceCode) => void;
  signal?: AbortSignal;
  onAuthorizationUrl?: (url: string) => void;
  openBrowser?: (url: string) => Promise<unknown>;
  timeoutMs?: number;
};

function oauthFailure(
  whatHappened: string,
  fix?: string,
  details?: string
): UserAuthError {
  return new UserAuthError('oauth', whatHappened, fix, details);
}

function oauthError(error: unknown, fallback: string): UserAuthError {
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
    return oauthFailure(
      descriptions[error.error] ?? fallback,
      ['invalid_client', 'unauthorized_client'].includes(error.error)
        ? 'Check GT_AUTH_URL or update the server'
        : 'Run `gt login` again',
      // Scope descriptions are useful configuration diagnostics, not token data.
      error.error === 'invalid_scope' ? error.error_description : undefined
    );
  }
  if (error instanceof oidc.ClientError) {
    const status =
      error.cause instanceof Response ? ` (HTTP ${error.cause.status})` : '';
    return oauthFailure(
      `${fallback}${status}`,
      'Check the authorization server and try again',
      error.code
    );
  }
  if (
    error instanceof Error &&
    ['AbortError', 'TimeoutError'].includes(error.name)
  ) {
    return oauthFailure(
      'Sign in was cancelled or timed out',
      'Run `gt login` again'
    );
  }
  // Do not expose transport causes, callback URLs or token responses.
  return oauthFailure(fallback, 'Check the authorization server and try again');
}

function assertEndpoint(url: URL, issuer: URL): void {
  if (
    url.username ||
    url.password ||
    url.hash ||
    (url.protocol !== 'https:' &&
      !(issuer.protocol === 'http:' && url.origin === issuer.origin))
  ) {
    throw oauthFailure(
      'The authorization server supplied an unsafe endpoint',
      'Use HTTPS, or same-origin local development HTTP'
    );
  }
}

async function configuration(
  {
    authBaseUrl = getAuthBaseUrl(),
    fetch: fetchImplementation = globalThis.fetch,
  }: OAuthRequestOptions,
  signal?: AbortSignal
): Promise<oidc.Configuration> {
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
    throw oauthFailure(
      'GT_AUTH_URL is not a trusted issuer URL',
      'Use HTTPS, or a local development HTTP issuer without credentials, query or fragment'
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
        // Include operation cancellation in JWKS fetches as well as token requests.
        signal: signal
          ? AbortSignal.any([signal, ...(init.signal ? [init.signal] : [])])
          : init.signal,
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
): Omit<OAuthTokens, 'resource'> {
  const subject = result.claims()?.sub ?? previous?.subject;
  if (!subject || (previous && subject !== previous.subject)) {
    throw oauthFailure(
      'The authorization server did not confirm the expected account identity',
      'Run `gt login` again'
    );
  }
  if (
    result.token_type !== 'bearer' ||
    typeof result.expires_in !== 'number' ||
    !Number.isFinite(result.expires_in) ||
    result.expires_in <= 0
  ) {
    throw oauthFailure(
      'The authorization server returned an unsupported token type or lifetime'
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

function getAuthBaseUrl(): string {
  return (process.env.GT_AUTH_URL ?? `${GT_DASHBOARD_URL}/api/auth`).replace(
    /\/$/,
    ''
  );
}

/** Resource indicators are the API origin serialized as a URL href (trailing slash). */
function toApiResource(baseUrl: string): string {
  return new URL(baseUrl).href;
}

function loginResource(options: LoginOptions): string {
  return toApiResource(
    process.env.GT_API_URL ?? options.baseUrl ?? defaultBaseUrl
  );
}

async function loginWithDeviceCode(
  options: LoginOptions
): Promise<OAuthTokens> {
  if (options.noBrowser && !options.onDeviceCode) {
    throw oauthFailure(
      'Device login needs a way to display the verification code',
      'Provide onDeviceCode when using noBrowser'
    );
  }
  const authBaseUrl = options.authBaseUrl ?? getAuthBaseUrl();
  const resource = loginResource(options);
  const lifetime = new AbortController();
  const signal = options.signal
    ? AbortSignal.any([options.signal, lifetime.signal])
    : lifetime.signal;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let result: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
  try {
    signal.throwIfAborted();
    const config = await configuration({ ...options, authBaseUrl }, signal);
    const started = Date.now();
    const response = await oidc.initiateDeviceAuthorization(config, {
      scope: OAUTH_SCOPE,
      resource,
    });
    const deadline = started + response.expires_in * 1000;
    const checkLifetime = () => {
      if (Date.now() >= deadline)
        lifetime.abort(new DOMException('Device code expired', 'TimeoutError'));
      signal.throwIfAborted();
    };
    checkLifetime();
    timer = setTimeout(
      () =>
        lifetime.abort(new DOMException('Device code expired', 'TimeoutError')),
      deadline - Date.now()
    );
    assertEndpoint(new URL(response.verification_uri), new URL(authBaseUrl));
    if (response.verification_uri_complete)
      assertEndpoint(
        new URL(response.verification_uri_complete),
        new URL(authBaseUrl)
      );
    options.onDeviceCode?.({
      userCode: response.user_code,
      verificationUri: response.verification_uri,
      verificationUriComplete: response.verification_uri_complete,
    });
    checkLifetime();
    if (!options.noBrowser) {
      void (options.openBrowser ?? open)(
        response.verification_uri_complete ?? response.verification_uri
      ).catch(() => undefined);
    }
    result = await oidc.pollDeviceAuthorizationGrant(
      config,
      response,
      { resource },
      { signal }
    );
    checkLifetime();
  } catch (error) {
    throw oauthError(error, 'Could not complete device sign in');
  } finally {
    clearTimeout(timer);
  }
  const tokens = { ...parseTokens(result), resource };
  await writeOAuthTokens(tokens, authBaseUrl);
  return tokens;
}

/** Browser S256/loopback, or device login for --no-browser and bind failure. */
export async function login(options: LoginOptions = {}): Promise<OAuthTokens> {
  if (options.noBrowser) return loginWithDeviceCode(options);
  const authBaseUrl = options.authBaseUrl ?? getAuthBaseUrl();
  const resource = loginResource(options);
  const config = await configuration({ ...options, authBaseUrl }).catch(
    (error: unknown) => {
      throw oauthError(error, 'Could not discover the authorization server');
    }
  );
  const loopback = await startLoopbackServer().catch(() => undefined);
  if (!loopback) return loginWithDeviceCode(options);
  let result: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
  try {
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const state = oidc.randomState();
    const authorizationUrl = oidc.buildAuthorizationUrl(config, {
      redirect_uri: loopback.redirectUri,
      scope: OAUTH_SCOPE,
      resource,
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
        { resource }
      )
      .catch((error: unknown) => {
        throw oauthError(error, 'Could not validate the sign-in response');
      });
  } finally {
    loopback.close();
  }
  const tokens = { ...parseTokens(result), resource };
  await writeOAuthTokens(tokens, authBaseUrl);
  return tokens;
}

const pendingRefreshes = new Map<string, Promise<OAuthTokens>>();
function refreshTokens(options: OAuthRequestOptions): Promise<OAuthTokens> {
  const authBaseUrl = options.authBaseUrl ?? getAuthBaseUrl();
  const pending = pendingRefreshes.get(authBaseUrl);
  if (pending) return pending;
  const refresh = exchangeRefreshToken({ ...options, authBaseUrl }).finally(
    () => pendingRefreshes.delete(authBaseUrl)
  );
  pendingRefreshes.set(authBaseUrl, refresh);
  return refresh;
}

async function exchangeRefreshToken(
  options: OAuthRequestOptions & { authBaseUrl: string }
): Promise<OAuthTokens> {
  const current = await readOAuthTokens(options.authBaseUrl);
  if (!current?.refreshToken) throw loginRequiredError();
  const result = await (async () =>
    oidc.refreshTokenGrant(
      await configuration(options),
      current.refreshToken
    ))().catch((error: unknown) => {
    throw oauthError(error, 'Could not refresh your login');
  });
  // The grant reuses the bound resource, so the refreshed token keeps its audience.
  const tokens = {
    ...parseTokens(result, current),
    resource: current.resource,
  };
  await writeOAuthTokens(tokens, options.authBaseUrl);
  return tokens;
}

async function validTokens(
  options: OAuthRequestOptions
): Promise<OAuthTokens | undefined> {
  const tokens = await readOAuthTokens(options.authBaseUrl ?? getAuthBaseUrl());
  if (!tokens || tokens.expiresAt > Date.now() + TOKEN_REFRESH_BUFFER_MS)
    return tokens;
  return refreshTokens(options);
}

/** Construction is deliberately free of auth/storage/discovery I/O. */
export function createUserTokenProvider(
  options: UserTokenProviderOptions
): UserTokenProvider {
  // Check the audience before any refresh so a stale mismatched login is
  // never rotated on behalf of the wrong API.
  const storedTokens = async (): Promise<OAuthTokens> => {
    const tokens = await readOAuthTokens(
      options.authBaseUrl ?? getAuthBaseUrl()
    );
    if (!tokens) throw loginRequiredError();
    const resource = toApiResource(options.baseUrl);
    if (tokens.resource !== resource) {
      throw new UserAuthError(
        'resource_mismatch',
        `You are signed in to ${tokens.resource}, but this project uses ${resource}`,
        'Run `gt login` in this project to sign in to its API'
      );
    }
    return tokens;
  };
  return {
    getAccessToken: async () => {
      const tokens = await storedTokens();
      if (tokens.expiresAt > Date.now() + TOKEN_REFRESH_BUFFER_MS)
        return tokens.accessToken;
      return (await refreshTokens(options)).accessToken;
    },
    refreshAccessToken: async () => {
      await storedTokens();
      return (await refreshTokens(options)).accessToken;
    },
  };
}

export async function logout(options: OAuthRequestOptions = {}): Promise<void> {
  const authBaseUrl = options.authBaseUrl ?? getAuthBaseUrl();
  try {
    const tokens = await readOAuthTokens(authBaseUrl);
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
    await deleteOAuthTokens(authBaseUrl);
  }
}

export async function whoAmI(
  options: OAuthRequestOptions = {}
): Promise<UserInfo> {
  const tokens = await validTokens(options);
  if (!tokens) throw loginRequiredError();
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
