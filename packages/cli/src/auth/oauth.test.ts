import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildAuthorizationUrl,
  createPkcePair,
  deleteOAuthTokens,
  exchangeAuthorizationCode,
  getApiResource,
  getCredentialsPath,
  getValidAccessToken,
  login,
  logout,
  OAUTH_SCOPE,
  OAUTH_SCOPES,
  parsePastedCallback,
  readOAuthClient,
  readOAuthTokens,
  refreshOAuthTokens,
  registerOAuthClient,
  whoAmI,
  writeOAuthClient,
  writeOAuthTokens,
  type OAuthClient,
  type OAuthTokens,
} from './oauth.js';

const authBaseUrl = 'https://auth.example/api/auth';
const apiResource = 'https://api.example/';

const tokens: OAuthTokens = {
  accessToken: 'access-1',
  expiresAt: Date.now() + 3_600_000,
  refreshToken: 'refresh-1',
  scope: 'openid project:files:read',
  tokenType: 'Bearer',
};

const client: OAuthClient = {
  clientId: 'client-1',
  redirectUri: 'http://127.0.0.1/callback',
};

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function tokenResponse(
  accessToken: string,
  refreshToken: string
): Record<string, unknown> {
  return {
    access_token: accessToken,
    expires_in: 3600,
    refresh_token: refreshToken,
    scope: 'openid project:files:read',
    token_type: 'Bearer',
  };
}

function formBody(call: unknown[] | undefined): URLSearchParams {
  const init = call?.[1] as RequestInit | undefined;
  return new URLSearchParams(String(init?.body));
}

let configHome: string;

beforeEach(async () => {
  configHome = await mkdtemp(path.join(tmpdir(), 'gt-oauth-test-'));
  process.env.XDG_CONFIG_HOME = configHome;
});

afterEach(async () => {
  await rm(configHome, { recursive: true, force: true });
  delete process.env.XDG_CONFIG_HOME;
  delete process.env.GT_API_URL;
});

describe('OAuth credential storage', () => {
  it('writes a versioned credential file with owner-only permissions', async () => {
    await writeOAuthClient(client, authBaseUrl);
    await writeOAuthTokens(tokens, authBaseUrl);

    expect(await readOAuthTokens(authBaseUrl)).toEqual(tokens);
    expect(await readOAuthClient(authBaseUrl)).toEqual(client);
    expect(JSON.parse(await readFile(getCredentialsPath(), 'utf8'))).toEqual({
      version: 2,
      servers: {
        [authBaseUrl]: {
          client: {
            client_id: client.clientId,
            redirect_uri: client.redirectUri,
          },
          tokens: {
            access_token: tokens.accessToken,
            expires_at: tokens.expiresAt,
            refresh_token: tokens.refreshToken,
            scope: tokens.scope,
            token_type: tokens.tokenType,
          },
        },
      },
    });
    if (process.platform !== 'win32') {
      expect((await stat(getCredentialsPath())).mode & 0o777).toBe(0o600);
    }
  });

  it('keeps credentials for different authorization servers apart', async () => {
    await writeOAuthTokens(tokens, authBaseUrl);
    await writeOAuthTokens(
      { ...tokens, accessToken: 'dev-access' },
      'http://localhost:3000/api/auth'
    );

    expect((await readOAuthTokens(authBaseUrl))?.accessToken).toBe('access-1');
    expect(
      (await readOAuthTokens('http://localhost:3000/api/auth'))?.accessToken
    ).toBe('dev-access');
  });

  it('atomically replaces rotated refresh tokens', async () => {
    await writeOAuthTokens(tokens, authBaseUrl);
    await writeOAuthTokens(
      { ...tokens, refreshToken: 'refresh-2' },
      authBaseUrl
    );

    expect((await readOAuthTokens(authBaseUrl))?.refreshToken).toBe(
      'refresh-2'
    );
  });

  it('keeps the client registration when tokens are deleted', async () => {
    await writeOAuthClient(client, authBaseUrl);
    await writeOAuthTokens(tokens, authBaseUrl);

    await deleteOAuthTokens(authBaseUrl);

    expect(await readOAuthTokens(authBaseUrl)).toBeUndefined();
    expect(await readOAuthClient(authBaseUrl)).toEqual(client);
  });

  it('reports malformed credential files instead of treating them as logged out', async () => {
    await writeOAuthTokens(tokens, authBaseUrl);
    await writeFile(getCredentialsPath(), '{not json', 'utf8');

    await expect(readOAuthTokens(authBaseUrl)).rejects.toThrow(
      'Stored OAuth credentials are invalid'
    );
  });

  it('rejects the retired version 1 layout', async () => {
    await writeOAuthTokens(tokens, authBaseUrl);
    await writeFile(
      getCredentialsPath(),
      JSON.stringify({ version: 1, tokens: {} }),
      'utf8'
    );

    await expect(readOAuthTokens(authBaseUrl)).rejects.toThrow(
      'expected version 2'
    );
  });
});

describe('PKCE and authorization URL', () => {
  it('derives the S256 challenge from the verifier (RFC 7636 appendix B)', () => {
    expect(
      createPkcePair('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')
    ).toEqual({
      codeVerifier: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
      codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    });
  });

  it('generates a fresh 43-character verifier by default', () => {
    const first = createPkcePair();
    const second = createPkcePair();
    expect(first.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.codeVerifier).not.toBe(second.codeVerifier);
  });

  it('builds the authorize URL with PKCE, state, resource, and the CLI scopes', () => {
    const url = new URL(
      buildAuthorizationUrl({
        authBaseUrl,
        clientId: 'client-1',
        redirectUri: 'http://127.0.0.1:4242/callback',
        codeChallenge: 'challenge',
        state: 'state-1',
        apiResource,
      })
    );

    expect(url.origin + url.pathname).toBe(`${authBaseUrl}/oauth2/authorize`);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'client-1',
      redirect_uri: 'http://127.0.0.1:4242/callback',
      scope: OAUTH_SCOPE,
      state: 'state-1',
      code_challenge: 'challenge',
      code_challenge_method: 'S256',
      resource: apiResource,
    });
  });

  it('never requests API key management scopes', () => {
    expect(OAUTH_SCOPES).not.toContain('project:api_keys:write');
    expect(OAUTH_SCOPES).toContain('offline_access');
  });

  it('serializes the API resource as a URL href', () => {
    process.env.GT_API_URL = 'https://api.example';
    expect(getApiResource()).toBe('https://api.example/');
  });
});

describe('dynamic client registration', () => {
  it('registers a native public client with a loopback redirect and persists it', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ client_id: 'client-9' }, 201));

    const registered = await registerOAuthClient({
      authBaseUrl,
      fetch: fetchImplementation,
    });

    expect(registered).toEqual({
      clientId: 'client-9',
      redirectUri: 'http://127.0.0.1/callback',
    });
    expect(await readOAuthClient(authBaseUrl)).toEqual(registered);
    const [url, init] = fetchImplementation.mock.calls[0];
    expect(url).toBe(`${authBaseUrl}/oauth2/register`);
    expect(JSON.parse(String(init?.body))).toEqual({
      client_name: 'General Translation CLI',
      application_type: 'native',
      redirect_uris: ['http://127.0.0.1/callback'],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      scope: OAUTH_SCOPE,
    });
  });

  it('surfaces registration errors', async () => {
    await expect(
      registerOAuthClient({
        authBaseUrl,
        fetch: vi
          .fn<typeof fetch>()
          .mockResolvedValue(
            jsonResponse(
              { error: 'invalid_scope', error_description: 'nope' },
              400
            )
          ),
      })
    ).rejects.toThrow('rejected the requested scopes: nope');
  });
});

describe('authorization code exchange', () => {
  it('posts the PKCE verifier, redirect URI, and resource as a public client', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(tokenResponse('access-2', 'refresh-2')));

    const result = await exchangeAuthorizationCode({
      authBaseUrl,
      fetch: fetchImplementation,
      clientId: 'client-1',
      code: 'code-1',
      codeVerifier: 'verifier-1',
      redirectUri: 'http://127.0.0.1:4242/callback',
      apiResource,
    });

    expect(result.accessToken).toBe('access-2');
    expect(fetchImplementation.mock.calls[0][0]).toBe(
      `${authBaseUrl}/oauth2/token`
    );
    expect(
      Object.fromEntries(formBody(fetchImplementation.mock.calls[0]))
    ).toEqual({
      grant_type: 'authorization_code',
      client_id: 'client-1',
      code: 'code-1',
      code_verifier: 'verifier-1',
      redirect_uri: 'http://127.0.0.1:4242/callback',
      resource: apiResource,
    });
  });

  it('explains expired or reused codes', async () => {
    await expect(
      exchangeAuthorizationCode({
        authBaseUrl,
        fetch: vi
          .fn<typeof fetch>()
          .mockResolvedValue(jsonResponse({ error: 'invalid_grant' }, 400)),
        clientId: 'client-1',
        code: 'code-1',
        codeVerifier: 'verifier-1',
        redirectUri: 'http://127.0.0.1:4242/callback',
        apiResource,
      })
    ).rejects.toThrow('expired or was already used');
  });
});

describe('parsePastedCallback', () => {
  it('accepts a full redirect URL', () => {
    expect(
      parsePastedCallback(' http://127.0.0.1/callback?code=c&state=s ')
    ).toMatchObject({ code: 'c', state: 's' });
  });

  it('accepts a bare code', () => {
    expect(parsePastedCallback('raw-code')).toEqual({ code: 'raw-code' });
  });
});

describe('login', () => {
  it('reuses the stored client, opens the browser, receives the loopback callback, and stores tokens', async () => {
    await writeOAuthClient(client, authBaseUrl);
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(tokenResponse('access-2', 'refresh-2'))
      );
    const openBrowser = vi.fn(async (url: string) => {
      const authorize = new URL(url);
      const redirect = new URL(authorize.searchParams.get('redirect_uri')!);
      redirect.searchParams.set('code', 'code-1');
      redirect.searchParams.set('state', authorize.searchParams.get('state')!);
      // Simulate the browser following the provider redirect back to the CLI.
      void fetch(redirect);
    });

    const result = await login({
      authBaseUrl,
      apiResource,
      fetch: fetchImplementation,
      openBrowser,
      timeoutMs: 5_000,
    });

    expect(result.accessToken).toBe('access-2');
    expect((await readOAuthTokens(authBaseUrl))?.refreshToken).toBe(
      'refresh-2'
    );
    // Only the token exchange hit the provider; registration was skipped.
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    const authorizeUrl = new URL(openBrowser.mock.calls[0][0]);
    expect(authorizeUrl.searchParams.get('client_id')).toBe('client-1');
    expect(authorizeUrl.searchParams.get('redirect_uri')).toMatch(
      /^http:\/\/127\.0\.0\.1:\d+\/callback$/
    );
    const exchange = Object.fromEntries(
      formBody(fetchImplementation.mock.calls[0])
    );
    expect(exchange.redirect_uri).toBe(
      authorizeUrl.searchParams.get('redirect_uri')
    );
    expect(exchange.code).toBe('code-1');
    expect(exchange.code_verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('registers a client on first login', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ client_id: 'client-new' }, 201))
      .mockResolvedValueOnce(
        jsonResponse(tokenResponse('access-2', 'refresh-2'))
      );
    const openBrowser = vi.fn(async (url: string) => {
      const authorize = new URL(url);
      const redirect = new URL(authorize.searchParams.get('redirect_uri')!);
      redirect.searchParams.set('code', 'code-1');
      redirect.searchParams.set('state', authorize.searchParams.get('state')!);
      void fetch(redirect);
    });

    await login({
      authBaseUrl,
      apiResource,
      fetch: fetchImplementation,
      openBrowser,
    });

    expect(fetchImplementation.mock.calls[0][0]).toBe(
      `${authBaseUrl}/oauth2/register`
    );
    expect(await readOAuthClient(authBaseUrl)).toEqual({
      clientId: 'client-new',
      redirectUri: 'http://127.0.0.1/callback',
    });
  });

  it('rejects a callback whose state does not match', async () => {
    await writeOAuthClient(client, authBaseUrl);
    const fetchImplementation = vi.fn<typeof fetch>();
    const openBrowser = vi.fn(async (url: string) => {
      const redirect = new URL(new URL(url).searchParams.get('redirect_uri')!);
      redirect.searchParams.set('code', 'code-1');
      redirect.searchParams.set('state', 'forged');
      void fetch(redirect);
    });

    await expect(
      login({
        authBaseUrl,
        apiResource,
        fetch: fetchImplementation,
        openBrowser,
      })
    ).rejects.toThrow('state mismatch');
    expect(fetchImplementation).not.toHaveBeenCalled();
    expect(await readOAuthTokens(authBaseUrl)).toBeUndefined();
  });

  it('reports access_denied from the provider', async () => {
    await writeOAuthClient(client, authBaseUrl);
    const openBrowser = vi.fn(async (url: string) => {
      const authorize = new URL(url);
      const redirect = new URL(authorize.searchParams.get('redirect_uri')!);
      redirect.searchParams.set('error', 'access_denied');
      redirect.searchParams.set('state', authorize.searchParams.get('state')!);
      void fetch(redirect);
    });

    await expect(
      login({
        authBaseUrl,
        apiResource,
        fetch: vi.fn<typeof fetch>(),
        openBrowser,
      })
    ).rejects.toThrow('Sign in was denied in the browser');
  });

  it('times out when the browser never returns', async () => {
    await writeOAuthClient(client, authBaseUrl);
    await expect(
      login({
        authBaseUrl,
        apiResource,
        fetch: vi.fn<typeof fetch>(),
        openBrowser: vi.fn().mockResolvedValue(undefined),
        timeoutMs: 20,
      })
    ).rejects.toThrow('Timed out waiting for the browser to sign in');
  });

  it('falls back to a pasted redirect URL with --no-browser and the registered redirect', async () => {
    await writeOAuthClient(client, authBaseUrl);
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(tokenResponse('access-2', 'refresh-2'))
      );
    const openBrowser = vi.fn();
    let authorizationUrl = '';

    await login({
      authBaseUrl,
      apiResource,
      fetch: fetchImplementation,
      noBrowser: true,
      openBrowser,
      onAuthorizationUrl: (url) => {
        authorizationUrl = url;
      },
      promptForCallback: async () => {
        const state = new URL(authorizationUrl).searchParams.get('state')!;
        return `http://127.0.0.1/callback?code=pasted&state=${state}`;
      },
    });

    expect(openBrowser).not.toHaveBeenCalled();
    expect(new URL(authorizationUrl).searchParams.get('redirect_uri')).toBe(
      client.redirectUri
    );
    const exchange = Object.fromEntries(
      formBody(fetchImplementation.mock.calls[0])
    );
    expect(exchange).toMatchObject({
      code: 'pasted',
      redirect_uri: client.redirectUri,
    });
  });

  it('accepts a bare pasted code without a state', async () => {
    await writeOAuthClient(client, authBaseUrl);
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(tokenResponse('access-2', 'refresh-2'))
      );

    await login({
      authBaseUrl,
      apiResource,
      fetch: fetchImplementation,
      noBrowser: true,
      promptForCallback: async () => 'bare-code',
    });

    expect(
      Object.fromEntries(formBody(fetchImplementation.mock.calls[0])).code
    ).toBe('bare-code');
  });

  it('fails clearly when headless and no paste handler is provided', async () => {
    await writeOAuthClient(client, authBaseUrl);
    await expect(
      login({
        authBaseUrl,
        apiResource,
        fetch: vi.fn<typeof fetch>(),
        noBrowser: true,
      })
    ).rejects.toThrow('no way to receive the sign-in code');
  });
});

describe('OAuth session operations', () => {
  beforeEach(async () => {
    await writeOAuthClient(client, authBaseUrl);
  });

  it('reports expired login when refresh fails with a non-JSON response', async () => {
    await writeOAuthTokens({ ...tokens, expiresAt: 0 }, authBaseUrl);

    await expect(
      refreshOAuthTokens({
        authBaseUrl,
        fetch: vi
          .fn<typeof fetch>()
          .mockResolvedValue(new Response(null, { status: 401 })),
      })
    ).rejects.toThrow('Your login expired. Run `gt login` to sign in again');
  });

  it('persists refresh-token rotation before returning the new access token', async () => {
    await writeOAuthTokens({ ...tokens, expiresAt: 0 }, authBaseUrl);
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(tokenResponse('access-2', 'refresh-2')));

    await expect(
      getValidAccessToken({ authBaseUrl, fetch: fetchImplementation })
    ).resolves.toBe('access-2');
    expect((await readOAuthTokens(authBaseUrl))?.refreshToken).toBe(
      'refresh-2'
    );
    expect(
      Object.fromEntries(formBody(fetchImplementation.mock.calls[0]))
    ).toEqual({
      client_id: client.clientId,
      grant_type: 'refresh_token',
      refresh_token: 'refresh-1',
    });
  });

  it('returns the cached access token while it is still fresh', async () => {
    await writeOAuthTokens(tokens, authBaseUrl);
    const fetchImplementation = vi.fn<typeof fetch>();

    await expect(
      getValidAccessToken({ authBaseUrl, fetch: fetchImplementation })
    ).resolves.toBe('access-1');
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it('preserves the refresh token when a provider does not rotate it', async () => {
    await writeOAuthTokens(tokens, authBaseUrl);
    const response = tokenResponse('access-2', 'unused');
    delete response.refresh_token;

    await refreshOAuthTokens({
      authBaseUrl,
      fetch: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(response)),
    });

    expect(await readOAuthTokens(authBaseUrl)).toMatchObject({
      refreshToken: 'refresh-1',
      scope: tokens.scope,
    });
  });

  it('revokes the refresh token and removes local tokens on logout', async () => {
    await writeOAuthTokens(tokens, authBaseUrl);
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 200 }));

    await logout({ authBaseUrl, fetch: fetchImplementation });

    expect(await readOAuthTokens(authBaseUrl)).toBeUndefined();
    expect(await readOAuthClient(authBaseUrl)).toEqual(client);
    expect(fetchImplementation.mock.calls[0][0]).toBe(
      `${authBaseUrl}/oauth2/revoke`
    );
    expect(
      Object.fromEntries(formBody(fetchImplementation.mock.calls[0]))
    ).toEqual({
      client_id: client.clientId,
      token: 'refresh-1',
      token_type_hint: 'refresh_token',
    });
  });

  it('refreshes and returns userinfo for whoami', async () => {
    await writeOAuthTokens({ ...tokens, expiresAt: 0 }, authBaseUrl);
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(tokenResponse('access-2', 'refresh-2'))
      )
      .mockResolvedValueOnce(
        jsonResponse({ sub: 'user-1', email: 'dev@example.com', name: 'Dev' })
      );

    await expect(
      whoAmI({ authBaseUrl, fetch: fetchImplementation })
    ).resolves.toEqual({
      sub: 'user-1',
      email: 'dev@example.com',
      name: 'Dev',
    });
    expect(fetchImplementation.mock.calls[1][0]).toBe(
      `${authBaseUrl}/oauth2/userinfo`
    );
    expect(fetchImplementation.mock.calls[1][1]?.headers).toEqual({
      Authorization: 'Bearer access-2',
    });
  });
});
