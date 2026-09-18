import {
  chmod,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { logger } from '../console/logger.js';
import {
  createUserTokenProvider,
  deleteOAuthTokens,
  getApiResource,
  getCredentialsPath,
  getValidAccessToken,
  login,
  logout,
  OAUTH_CLIENT_ID,
  OAUTH_SCOPE,
  readOAuthTokens,
  refreshOAuthTokens,
  whoAmI,
  writeOAuthTokens,
  type OAuthTokens,
  type LoginOptions,
} from './oauth.js';

vi.mock('node:fs/promises', { spy: true });

const authBaseUrl = 'https://auth.example/api/auth';
const apiResource = 'https://api.example/';
const tokens: OAuthTokens = {
  accessToken: 'access-1',
  expiresAt: Date.now() + 3_600_000,
  refreshToken: 'refresh-1',
  scope: OAUTH_SCOPE,
  tokenType: 'bearer',
  subject: 'user-1',
};
let keys: CryptoKeyPair;
let jwk: JsonWebKey;
beforeAll(async () => {
  keys = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  jwk = await crypto.subtle.exportKey('jwk', keys.publicKey);
});
function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
async function idToken(
  claims: Record<string, unknown> = {},
  signingKey?: CryptoKey
): Promise<string> {
  const encoded = (v: unknown) =>
    Buffer.from(JSON.stringify(v)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = `${encoded({ alg: 'EdDSA', kid: 'test-key' })}.${encoded({ iss: authBaseUrl, aud: OAUTH_CLIENT_ID, sub: 'user-1', iat: now, exp: now + 3600, ...claims })}`;
  return `${payload}.${Buffer.from(await crypto.subtle.sign('Ed25519', signingKey ?? keys.privateKey, new TextEncoder().encode(payload))).toString('base64url')}`;
}
function tokenResponse(id?: string): Record<string, unknown> {
  return {
    access_token: 'access-2',
    refresh_token: 'refresh-2',
    expires_in: 3600,
    token_type: 'Bearer',
    scope: OAUTH_SCOPE,
    ...(id ? { id_token: id } : {}),
  };
}
function metadata(issuer = authBaseUrl): Record<string, unknown> {
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth2/authorize`,
    token_endpoint: `${issuer}/oauth2/token`,
    device_authorization_endpoint: `${issuer}/device/code`,
    userinfo_endpoint: `${issuer}/oauth2/userinfo`,
    revocation_endpoint: `${issuer}/oauth2/revoke`,
    jwks_uri: `${issuer}/jwks`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['EdDSA'],
    authorization_response_iss_parameter_supported: true,
  };
}
function provider(
  options: {
    issuer?: string;
    metadata?: Record<string, unknown>;
    token?: (init?: RequestInit) => Promise<Response>;
    device?: () => Promise<Response>;
    jwks?: (init?: RequestInit) => Promise<Response>;
    user?: string;
  } = {}
) {
  const issuer = options.issuer ?? authBaseUrl;
  return vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    if (url === `${issuer}/.well-known/openid-configuration`)
      return json(options.metadata ?? metadata(issuer));
    if (url === `${issuer}/jwks`)
      return options.jwks
        ? options.jwks(init)
        : json({
            keys: [{ ...jwk, kid: 'test-key', alg: 'EdDSA', use: 'sig' }],
          });
    if (url === `${issuer}/device/code`)
      return options.device ? options.device() : json(deviceResponse());
    if (url === `${issuer}/oauth2/token`)
      return options.token
        ? options.token(init)
        : json(tokenResponse(await idToken({ iss: issuer })));
    if (url === `${issuer}/oauth2/revoke`)
      return new Response(null, { status: 200 });
    if (url === `${issuer}/oauth2/userinfo`)
      return json({
        sub: options.user ?? 'user-1',
        name: 'Dev',
        email: 'dev@example.com',
      });
    throw new Error(`Unexpected fixture request: ${url}`);
  });
}
const networkFetch = globalThis.fetch;
async function callback(
  url: string,
  change?: (params: URLSearchParams) => void
): Promise<void> {
  const authorize = new URL(url);
  const redirect = new URL(authorize.searchParams.get('redirect_uri')!);
  redirect.searchParams.set('code', 'code-1');
  redirect.searchParams.set('state', authorize.searchParams.get('state')!);
  redirect.searchParams.set('iss', authorize.origin + '/api/auth');
  change?.(redirect.searchParams);
  const response = await networkFetch(redirect);
  expect(await response.text()).toContain('check whether sign in completed');
}
function browserLogin(options: LoginOptions = {}) {
  return login({
    authBaseUrl,
    apiResource,
    fetch: provider(),
    openBrowser: callback,
    timeoutMs: 1000,
    ...options,
  });
}
function forms(fetcher: ReturnType<typeof provider>) {
  return fetcher.mock.calls
    .filter(([url]) => String(url).endsWith('/oauth2/token'))
    .map(([, init]) => new URLSearchParams(String(init?.body)));
}
let configHome: string;
beforeEach(async () => {
  configHome = await mkdtemp(path.join(tmpdir(), 'gt-oauth-test-'));
  vi.stubEnv('XDG_CONFIG_HOME', configHome);
  // All provider traffic must use the explicit synthetic transport.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('Unexpected network request');
    })
  );
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  await rm(configHome, { recursive: true, force: true });
});
async function rawFile(servers: Record<string, unknown>) {
  await writeOAuthTokens(tokens, authBaseUrl);
  await writeFile(
    getCredentialsPath(),
    JSON.stringify({ version: 2, servers })
  );
}

describe('OAuth credential storage', () => {
  it('writes owner-only files and directories, atomically replaces rotation, and removes the last entry', async () => {
    await writeOAuthTokens(tokens, authBaseUrl);
    if (process.platform !== 'win32') {
      expect((await stat(getCredentialsPath())).mode & 0o777).toBe(0o600);
      expect(
        (await stat(path.dirname(getCredentialsPath()))).mode & 0o777
      ).toBe(0o700);
    }
    const old = await fs.open(getCredentialsPath());
    await writeOAuthTokens({ ...tokens, refreshToken: 'rotated' }, authBaseUrl);
    expect(
      JSON.parse(await old.readFile('utf8')).servers[authBaseUrl].refreshToken
    ).toBe('refresh-1');
    await old.close();
    expect((await readOAuthTokens(authBaseUrl))?.refreshToken).toBe('rotated');
    await deleteOAuthTokens(authBaseUrl);
    await expect(stat(getCredentialsPath())).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
  it.each([
    { ...tokens, subject: undefined },
    { client: { clientId: 'old' }, tokens },
    { ...tokens, expiresAt: 'bad' },
    null,
  ])(
    'requires a fresh login for obsolete or invalid v2 entries (%j), preserving siblings',
    async (obsolete) => {
      const servers: Record<string, unknown> = {
        [authBaseUrl]: obsolete,
        'https://other.example/api/auth': tokens,
        'https://old.example/api/auth': { accessToken: 'old' },
      };
      await rawFile(servers);
      const fetcher = provider();
      await expect(
        getValidAccessToken({ authBaseUrl, fetch: fetcher })
      ).rejects.toThrow(/gt login/);
      expect(fetcher).not.toHaveBeenCalled();
      expect(
        JSON.parse(await readFile(getCredentialsPath(), 'utf8')).servers
      ).toEqual(servers);
      await browserLogin();
      expect((await readOAuthTokens(authBaseUrl))?.subject).toBe('user-1');
      await logout({ authBaseUrl, fetch: fetcher });
      delete servers[authBaseUrl];
      expect(
        JSON.parse(await readFile(getCredentialsPath(), 'utf8')).servers
      ).toEqual(servers);
    }
  );
  it('logs out an obsolete selected entry without sending its tokens', async () => {
    await rawFile({
      [authBaseUrl]: { ...tokens, subject: undefined },
      other: tokens,
    });
    const fetcher = provider();
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    await logout({ authBaseUrl, fetch: fetcher });
    expect(fetcher).not.toHaveBeenCalled();
    expect(
      JSON.parse(await readFile(getCredentialsPath(), 'utf8')).servers
    ).toEqual({ other: tokens });
  });
  it.each([
    '{not json',
    JSON.stringify({ version: 1, tokens: {} }),
    JSON.stringify({ version: 2, servers: [] }),
  ])('backs up malformed envelopes and can replace them', async (contents) => {
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    await writeOAuthTokens(tokens, authBaseUrl);
    await writeFile(getCredentialsPath(), contents);
    await browserLogin();
    const [backup] = (await readdir(path.dirname(getCredentialsPath()))).filter(
      (name) => name.includes('.corrupt-')
    );
    expect(
      await readFile(
        path.join(path.dirname(getCredentialsPath()), backup),
        'utf8'
      )
    ).toBe(contents);
    expect((await readOAuthTokens(authBaseUrl))?.accessToken).toBe('access-2');
  });
  it('propagates filesystem errors rather than resetting the file', async () => {
    if (process.platform === 'win32' || process.getuid?.() === 0) return;
    await writeOAuthTokens(tokens, authBaseUrl);
    await chmod(getCredentialsPath(), 0o000);
    await expect(writeOAuthTokens(tokens, authBaseUrl)).rejects.toThrow(
      /EACCES|EPERM/
    );
    expect(await readdir(path.dirname(getCredentialsPath()))).toEqual([
      'credentials.json',
    ]);
  });
  it('keeps the old file and cleans the temporary file if atomic rename fails', async () => {
    await writeOAuthTokens(tokens, authBaseUrl);
    vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('rename failed'));
    await expect(
      writeOAuthTokens({ ...tokens, refreshToken: 'rotated' }, authBaseUrl)
    ).rejects.toThrow('rename failed');
    expect(await readOAuthTokens(authBaseUrl)).toEqual(tokens);
    expect(await readdir(path.dirname(getCredentialsPath()))).toEqual([
      'credentials.json',
    ]);
  });
});

describe('discovery and browser authorization', () => {
  it('requests the seeded client identity, refresh and gt:* scopes', () => {
    expect(OAUTH_SCOPE).toBe('openid profile offline_access gt:*');
  });
  it('uses seeded public client, S256, exact redirect/resource/scope and validates a signed subject', async () => {
    const fetcher = provider();
    let authorize!: URL;
    const result = await browserLogin({
      fetch: fetcher,
      openBrowser: async (url) => {
        authorize = new URL(url);
        await callback(url);
      },
    });
    expect(result.subject).toBe('user-1');
    expect(await readOAuthTokens(authBaseUrl)).toEqual(result);
    expect(authorize.searchParams.get('client_id')).toBe('gt-cli');
    expect(authorize.searchParams.get('resource')).toBe(apiResource);
    expect(authorize.searchParams.get('scope')).toBe(OAUTH_SCOPE);
    expect(authorize.searchParams.get('code_challenge_method')).toBe('S256');
    const [form] = forms(fetcher);
    expect(Object.fromEntries(form)).toMatchObject({
      client_id: 'gt-cli',
      grant_type: 'authorization_code',
      code: 'code-1',
      redirect_uri: authorize.searchParams.get('redirect_uri'),
      resource: apiResource,
    });
    expect(form.has('client_secret')).toBe(false);
    expect(
      Buffer.from(
        await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(form.get('code_verifier')!)
        )
      ).toString('base64url')
    ).toBe(authorize.searchParams.get('code_challenge'));
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      `${authBaseUrl}/.well-known/openid-configuration`,
      `${authBaseUrl}/oauth2/token`,
      `${authBaseUrl}/jwks`,
    ]);
    expect(
      fetcher.mock.calls.every(([, init]) => init?.redirect === 'manual')
    ).toBe(true);
  });
  it('serializes the resource as a URL href', () => {
    vi.stubEnv('GT_API_URL', 'https://api.example');
    expect(getApiResource()).toBe(apiResource);
  });
  it.each(['state', 'code', 'iss'])(
    'rejects missing and duplicate %s before exchange',
    async (name) => {
      for (const mode of ['missing', 'duplicate']) {
        const fetcher = provider();
        await expect(
          browserLogin({
            fetch: fetcher,
            openBrowser: (url) =>
              callback(url, (params) => {
                if (mode === 'missing') params.delete(name);
                else params.append(name, params.get(name)!);
              }),
          })
        ).rejects.toThrow();
        expect(forms(fetcher)).toHaveLength(0);
        expect(await readOAuthTokens(authBaseUrl)).toBeUndefined();
      }
    }
  );
  it.each(['state', 'iss'])('rejects mismatched %s', async (name) => {
    await expect(
      browserLogin({
        openBrowser: (url) =>
          callback(url, (params) => params.set(name, 'forged')),
      })
    ).rejects.toThrow();
    expect(await readOAuthTokens(authBaseUrl)).toBeUndefined();
  });
  it('reports validated consent denial', async () => {
    await expect(
      browserLogin({
        openBrowser: (url) =>
          callback(url, (params) => {
            params.delete('code');
            params.set('error', 'access_denied');
          }),
      })
    ).rejects.toThrow('Sign in was denied');
  });
  it.each([
    { aud: apiResource },
    { iss: 'https://wrong.example' },
    { sub: '' },
    { sub: undefined },
    { exp: 1 },
  ])('rejects invalid signed claims %j', async (claims) => {
    const fetcher = provider({
      token: async () => json(tokenResponse(await idToken(claims))),
    });
    await expect(browserLogin({ fetch: fetcher })).rejects.toThrow();
    expect(await readOAuthTokens(authBaseUrl)).toBeUndefined();
  });
  it('rejects a bad signature and an absent ID token', async () => {
    const other = await crypto.subtle.generateKey('Ed25519', true, [
      'sign',
      'verify',
    ]);
    for (const id of [undefined, await idToken({}, other.privateKey)]) {
      await expect(
        browserLogin({
          fetch: provider({ token: async () => json(tokenResponse(id)) }),
        })
      ).rejects.toThrow();
      expect(await readOAuthTokens(authBaseUrl)).toBeUndefined();
    }
  });
  it('accepts omitted scope/refresh token but not a missing lifetime or non-bearer token', async () => {
    const value = tokenResponse(await idToken());
    delete value.scope;
    delete value.refresh_token;
    const result = await browserLogin({
      fetch: provider({ token: async () => json(value) }),
    });
    expect(result).toMatchObject({ scope: OAUTH_SCOPE, refreshToken: '' });
    for (const invalid of [
      { ...value, expires_in: undefined },
      { ...value, token_type: 'DPoP' },
    ]) {
      await expect(
        browserLogin({ fetch: provider({ token: async () => json(invalid) }) })
      ).rejects.toThrow();
      expect(await readOAuthTokens(authBaseUrl)).toEqual(result);
    }
  });
  it('keeps a callback arriving before a launcher finishes and does not wait for a hanging launcher', async () => {
    await browserLogin({
      openBrowser: async (url) => {
        await callback(url);
        await new Promise(() => {});
      },
    });
  });
  it('times out even if browser opening fails', async () => {
    await expect(
      browserLogin({
        openBrowser: async () => {
          throw new Error('no browser');
        },
        timeoutMs: 20,
      })
    ).rejects.toThrow('Timed out');
  });
  it('closes the listener when publishing fails', async () => {
    let redirect = '';
    await expect(
      browserLogin({
        onAuthorizationUrl: (url) => {
          redirect = new URL(url).searchParams.get('redirect_uri')!;
          throw new Error('cannot print');
        },
      })
    ).rejects.toThrow('cannot print');
    await expect(networkFetch(redirect)).rejects.toThrow();
  });
  it.each([
    'http://remote.example/api/auth',
    'http://localhost.evil/api/auth',
    'https://user:secret@auth.example/api/auth',
    `${authBaseUrl}?x=1`,
    `${authBaseUrl}#x`,
  ])('rejects untrusted issuer %s without requests', async (issuer) => {
    const fetcher = provider();
    await expect(
      browserLogin({ authBaseUrl: issuer, fetch: fetcher })
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('validates discovered issuer and signing metadata', async () => {
    for (const data of [
      { ...metadata(), issuer: 'https://wrong.example' },
      { ...metadata(), id_token_signing_alg_values_supported: undefined },
    ]) {
      await expect(
        browserLogin({ fetch: provider({ metadata: data }) })
      ).rejects.toThrow();
      expect(await readOAuthTokens(authBaseUrl)).toBeUndefined();
    }
  });
  it('allows local HTTP but rejects cross-origin HTTP endpoints and redirects', async () => {
    const issuer = 'http://dashboard.test.localhost:1355/api/auth';
    await browserLogin({ authBaseUrl: issuer, fetch: provider({ issuer }) });
    for (const endpoint of [
      'authorization_endpoint',
      'token_endpoint',
      'jwks_uri',
    ]) {
      const fetcher = provider({
        issuer,
        metadata: {
          ...metadata(issuer),
          [endpoint]: 'http://remote.example/unsafe',
        },
      });
      await expect(
        browserLogin({ authBaseUrl: issuer, fetch: fetcher })
      ).rejects.toThrow();
      expect(
        fetcher.mock.calls.some(([url]) =>
          String(url).includes('remote.example')
        )
      ).toBe(false);
    }
    await expect(
      browserLogin({
        fetch: provider({
          token: async () =>
            new Response(null, {
              status: 302,
              headers: { location: 'https://elsewhere.example' },
            }),
        }),
      })
    ).rejects.toThrow();
  });
});

function deviceResponse(): Record<string, unknown> {
  return {
    device_code: 'device-1',
    user_code: 'ABCD-EFGH',
    verification_uri: 'https://auth.example/device',
    verification_uri_complete:
      'https://auth.example/device?user_code=ABCD-EFGH',
    expires_in: 900,
  };
}
function deviceLogin(options: LoginOptions = {}) {
  return login({
    authBaseUrl,
    apiResource,
    noBrowser: true,
    onDeviceCode: () => undefined,
    fetch: provider(),
    ...options,
  });
}
async function startDevice(
  fetcher: ReturnType<typeof provider>,
  options: LoginOptions = {}
) {
  const onDeviceCode = vi.fn();
  const pending = deviceLogin({ fetch: fetcher, onDeviceCode, ...options });
  pending.catch(() => undefined);
  await vi.waitFor(() => expect(onDeviceCode).toHaveBeenCalled());
  return { pending, onDeviceCode };
}

describe('requested scope contract', () => {
  it.each([
    'browser callback',
    'browser exchange',
    'device initiation',
    'device exchange',
  ])(
    'reports invalid_scope at %s without a false-success session',
    async (stage) => {
      const detail = 'The gt-cli client does not allow the requested scope';
      const scopeError = async () =>
        json({ error: 'invalid_scope', error_description: detail }, 400);
      const fetcher = provider({
        ...(stage.endsWith('exchange') ? { token: scopeError } : {}),
        ...(stage === 'device initiation' ? { device: scopeError } : {}),
      });
      let pending: Promise<OAuthTokens>;
      if (stage === 'device exchange') {
        vi.useFakeTimers();
        ({ pending } = await startDevice(fetcher));
      } else if (stage === 'device initiation') {
        pending = deviceLogin({ fetch: fetcher });
      } else {
        pending = browserLogin({
          fetch: fetcher,
          ...(stage === 'browser callback'
            ? {
                openBrowser: (url: string) =>
                  callback(url, (params) => {
                    params.delete('code');
                    params.set('error', 'invalid_scope');
                    params.set('error_description', detail);
                  }),
              }
            : {}),
        });
      }
      const rejected = expect(pending).rejects.toThrow(`requested scopes`);
      const contextual = expect(pending).rejects.toThrow(detail);
      if (stage === 'device exchange') await vi.advanceTimersByTimeAsync(5000);
      await rejected;
      await contextual;
      expect(await readOAuthTokens(authBaseUrl)).toBeUndefined();
      await expect(stat(getCredentialsPath())).rejects.toMatchObject({
        code: 'ENOENT',
      });
    }
  );
});

describe('library-managed device authorization', () => {
  it('requires a display channel before any request for no-browser login', async () => {
    const fetcher = provider();
    const openBrowser = vi.fn();
    await expect(
      deviceLogin({ fetch: fetcher, onDeviceCode: undefined, openBrowser })
    ).rejects.toThrow('display');
    expect(fetcher).not.toHaveBeenCalled();
    expect(openBrowser).not.toHaveBeenCalled();
    expect(await readOAuthTokens(authBaseUrl)).toBeUndefined();
  });
  it('displays the code, defaults omitted interval to five seconds, and sends client/scope/resource on both requests', async () => {
    vi.useFakeTimers();
    const fetcher = provider();
    const openBrowser = vi.fn();
    const { pending, onDeviceCode } = await startDevice(fetcher, {
      openBrowser,
    });
    expect(forms(fetcher)).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(4900);
    expect(forms(fetcher)).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(100);
    const result = await pending;
    expect(result.subject).toBe('user-1');
    expect(await readOAuthTokens(authBaseUrl)).toEqual(result);
    expect(openBrowser).not.toHaveBeenCalled();
    expect(onDeviceCode).toHaveBeenCalledWith({
      userCode: 'ABCD-EFGH',
      verificationUri: 'https://auth.example/device',
      verificationUriComplete:
        'https://auth.example/device?user_code=ABCD-EFGH',
    });
    const [, init] = fetcher.mock.calls.find(([url]) =>
      String(url).endsWith('/device/code')
    )!;
    expect(Object.fromEntries(new URLSearchParams(String(init?.body)))).toEqual(
      { client_id: OAUTH_CLIENT_ID, scope: OAUTH_SCOPE, resource: apiResource }
    );
    expect(Object.fromEntries(forms(fetcher)[0])).toEqual({
      client_id: OAUTH_CLIENT_ID,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      device_code: 'device-1',
      resource: apiResource,
    });
  });
  it('falls back on bind failure, opens the complete verification URI without waiting for the launcher', async () => {
    const loopback = await import('./loopback.js');
    vi.spyOn(loopback, 'startLoopbackServer').mockRejectedValueOnce(
      new Error('EADDRINUSE')
    );
    vi.useFakeTimers();
    const openBrowser = vi.fn(async () => new Promise(() => {}));
    const { pending } = await startDevice(provider(), {
      noBrowser: false,
      openBrowser,
    });
    await vi.advanceTimersByTimeAsync(5000);
    await pending;
    expect(openBrowser).toHaveBeenCalledWith(
      'https://auth.example/device?user_code=ABCD-EFGH'
    );
  });
  it('honors pending and permanent slow_down without a custom retry loop', async () => {
    vi.useFakeTimers();
    const times: number[] = [];
    const id = await idToken();
    const fetcher = provider({
      token: async () => {
        times.push(Date.now());
        return times.length < 4
          ? json(
              {
                error:
                  times.length === 2 ? 'slow_down' : 'authorization_pending',
              },
              400
            )
          : json(tokenResponse(id));
      },
    });
    const { pending } = await startDevice(fetcher);
    await vi.advanceTimersByTimeAsync(30_000);
    await pending;
    expect(times.slice(1).map((time, i) => time - times[i])).toEqual([
      5000, 10000, 10000,
    ]);
  });
  it.each(['network', '500', '503'])(
    'stops after one %s failure instead of blanket retries',
    async (kind) => {
      vi.useFakeTimers();
      const fetcher = provider({
        token: async () => {
          if (kind === 'network') throw new Error('offline');
          return new Response('<html>', { status: Number(kind) });
        },
      });
      const { pending } = await startDevice(fetcher);
      const rejected = expect(pending).rejects.toThrow('device sign in');
      await vi.advanceTimersByTimeAsync(5000);
      await rejected;
      expect(forms(fetcher)).toHaveLength(1);
      expect(await readOAuthTokens(authBaseUrl)).toBeUndefined();
    }
  );
  it.each(['access_denied', 'expired_token'])(
    'stops on terminal %s',
    async (error) => {
      vi.useFakeTimers();
      const fetcher = provider({ token: async () => json({ error }, 400) });
      const { pending } = await startDevice(fetcher);
      const rejected = expect(pending).rejects.toThrow(
        error === 'access_denied' ? 'denied' : 'expired'
      );
      await vi.advanceTimersByTimeAsync(5000);
      await rejected;
      expect(forms(fetcher)).toHaveLength(1);
      expect(await readOAuthTokens(authBaseUrl)).toBeUndefined();
    }
  );
  it.each(['seconds', 'date', 'invalid'])(
    'follows the library 503 Retry-After policy (%s)',
    async (kind) => {
      vi.useFakeTimers();
      let attempts = 0;
      const id = await idToken();
      const fetcher = provider({
        token: async () =>
          ++attempts === 1
            ? new Response(null, {
                status: 503,
                headers: {
                  'Retry-After':
                    kind === 'seconds'
                      ? '2'
                      : kind === 'date'
                        ? new Date(Date.now() + 2000).toUTCString()
                        : 'invalid',
                },
              })
            : json(tokenResponse(id)),
      });
      const { pending } = await startDevice(fetcher);
      const expectation =
        kind === 'invalid'
          ? expect(pending).rejects.toThrow()
          : expect(pending).resolves.toMatchObject({ subject: 'user-1' });
      await vi.advanceTimersByTimeAsync(12000);
      await expectation;
      expect(attempts).toBe(kind === 'invalid' ? 1 : 2);
    }
  );
  it('requires a validated subject even though the library allows device responses without ID tokens', async () => {
    vi.useFakeTimers();
    const { pending } = await startDevice(
      provider({ token: async () => json(tokenResponse()) })
    );
    const rejected = expect(pending).rejects.toThrow(
      'expected account identity'
    );
    await vi.advanceTimersByTimeAsync(5000);
    await rejected;
    expect(await readOAuthTokens(authBaseUrl)).toBeUndefined();
  });
  it('includes time spent displaying approval in the deadline', async () => {
    vi.useFakeTimers();
    const fetcher = provider({
      device: async () => json({ ...deviceResponse(), expires_in: 1 }),
    });
    await expect(
      deviceLogin({
        fetch: fetcher,
        onDeviceCode: () => vi.setSystemTime(Date.now() + 2000),
      })
    ).rejects.toThrow('timed out');
    expect(forms(fetcher)).toHaveLength(0);
    expect(await readOAuthTokens(authBaseUrl)).toBeUndefined();
  });
  it('aborts expired pending grants and never stores a session', async () => {
    vi.useFakeTimers();
    const fetcher = provider({
      device: async () => json({ ...deviceResponse(), expires_in: 6 }),
      token: async () => json({ error: 'authorization_pending' }, 400),
    });
    const { pending } = await startDevice(fetcher);
    const rejected = expect(pending).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(10000);
    await rejected;
    expect(forms(fetcher)).toHaveLength(1);
    expect(await readOAuthTokens(authBaseUrl)).toBeUndefined();
  });
  it.each(['before', 'wait', 'token', 'jwks'])(
    'cancels %s without persisting (including JWKS signature verification)',
    async (stage) => {
      vi.useFakeTimers();
      const controller = new AbortController();
      const abortingResponse = async (init?: RequestInit) => {
        controller.abort();
        expect(init?.signal?.aborted).toBe(true);
        init?.signal?.throwIfAborted();
        return json({});
      };
      const fetcher = provider({
        ...(stage === 'token' ? { token: abortingResponse } : {}),
        ...(stage === 'jwks' ? { jwks: abortingResponse } : {}),
      });
      if (stage === 'before') controller.abort();
      const pending = deviceLogin({
        fetch: fetcher,
        signal: controller.signal,
      });
      const rejected = expect(pending).rejects.toThrow();
      if (stage !== 'before') {
        await vi.waitFor(() =>
          expect(
            fetcher.mock.calls.some(([url]) =>
              String(url).endsWith('/device/code')
            )
          ).toBe(true)
        );
        if (stage === 'wait') controller.abort();
        await vi.advanceTimersByTimeAsync(5000);
      }
      await rejected;
      expect(await readOAuthTokens(authBaseUrl)).toBeUndefined();
      if (stage === 'before' || stage === 'wait')
        expect(forms(fetcher)).toHaveLength(0);
    }
  );
});

describe('OAuth session operations', () => {
  it.each(['invalid_grant', 'invalid_client'])(
    'diagnoses %s without deleting credentials',
    async (error) => {
      await writeOAuthTokens(tokens, authBaseUrl);
      await expect(
        refreshOAuthTokens({
          authBaseUrl,
          fetch: provider({
            token: async () =>
              json({ error }, error === 'invalid_client' ? 401 : 400),
          }),
        })
      ).rejects.toThrow(
        error === 'invalid_client' ? 'does not recognize' : 'expired'
      );
      expect(await readOAuthTokens(authBaseUrl)).toEqual(tokens);
    }
  );
  it('reports HTTP outage status without resetting credentials', async () => {
    await writeOAuthTokens(tokens, authBaseUrl);
    await expect(
      refreshOAuthTokens({
        authBaseUrl,
        fetch: provider({
          token: async () => new Response('<html>', { status: 503 }),
        }),
      })
    ).rejects.toThrow('HTTP 503');
    expect(await readOAuthTokens(authBaseUrl)).toEqual(tokens);
  });
  it('shares refresh in process, clears failed work and persists rotation before returning', async () => {
    await writeOAuthTokens({ ...tokens, expiresAt: 0 }, authBaseUrl);
    await expect(
      refreshOAuthTokens({
        authBaseUrl,
        fetch: provider({
          token: async () => {
            throw new Error('offline');
          },
        }),
      })
    ).rejects.toThrow();
    let release!: (value: Response) => void;
    const fetcher = provider({
      token: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    });
    const pending = Promise.all([
      getValidAccessToken({ authBaseUrl, fetch: fetcher }),
      refreshOAuthTokens({ authBaseUrl, fetch: fetcher }),
      getValidAccessToken({ authBaseUrl, fetch: fetcher }),
    ]);
    await vi.waitFor(() => expect(forms(fetcher)).toHaveLength(1));
    expect((await readOAuthTokens(authBaseUrl))?.refreshToken).toBe(
      'refresh-1'
    );
    release(json(tokenResponse()));
    expect(
      (await pending).map((value) =>
        typeof value === 'string' ? value : value?.accessToken
      )
    ).toEqual(['access-2', 'access-2', 'access-2']);
    expect((await readOAuthTokens(authBaseUrl))?.refreshToken).toBe(
      'refresh-2'
    );
    expect(Object.fromEntries(forms(fetcher)[0])).toEqual({
      client_id: 'gt-cli',
      grant_type: 'refresh_token',
      refresh_token: 'refresh-1',
    });
  });
  it('retains validated subject, refresh token and scope when refresh omits them', async () => {
    await writeOAuthTokens(tokens, authBaseUrl);
    const value = tokenResponse();
    delete value.refresh_token;
    delete value.scope;
    await refreshOAuthTokens({
      authBaseUrl,
      fetch: provider({ token: async () => json(value) }),
    });
    expect(await readOAuthTokens(authBaseUrl)).toMatchObject({
      subject: tokens.subject,
      refreshToken: tokens.refreshToken,
      scope: tokens.scope,
    });
  });
  it('checks a newly signed refresh subject before writing rotation', async () => {
    await writeOAuthTokens(tokens, authBaseUrl);
    await expect(
      refreshOAuthTokens({
        authBaseUrl,
        fetch: provider({
          token: async () =>
            json(tokenResponse(await idToken({ sub: 'other' }))),
        }),
      })
    ).rejects.toThrow('expected account identity');
    expect(await readOAuthTokens(authBaseUrl)).toEqual(tokens);
    await refreshOAuthTokens({ authBaseUrl, fetch: provider() });
    expect((await readOAuthTokens(authBaseUrl))?.subject).toBe(tokens.subject);
  });
  it('constructs the provider lazily and returns fresh tokens without discovery', async () => {
    vi.stubEnv('GT_AUTH_URL', authBaseUrl);
    const tokenProvider = createUserTokenProvider();
    await expect(tokenProvider.getAccessToken()).rejects.toThrow('gt login');
    await writeOAuthTokens(tokens, authBaseUrl);
    expect(await tokenProvider.getAccessToken()).toBe('access-1');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it('refreshes within the 30-second buffer', async () => {
    await writeOAuthTokens(
      { ...tokens, expiresAt: Date.now() + 29_000 },
      authBaseUrl
    );
    expect(
      await getValidAccessToken({
        authBaseUrl,
        fetch: provider({ token: async () => json(tokenResponse()) }),
      })
    ).toBe('access-2');
  });
  it('revokes as a public client and always deletes locally on discovery/revoke/network failures', async () => {
    const fetcher = provider();
    await writeOAuthTokens(tokens, authBaseUrl);
    await logout({ authBaseUrl, fetch: fetcher });
    const [, init] = fetcher.mock.calls.find(([url]) =>
      String(url).endsWith('/revoke')
    )!;
    expect(Object.fromEntries(new URLSearchParams(String(init?.body)))).toEqual(
      {
        client_id: 'gt-cli',
        token: 'refresh-1',
        token_type_hint: 'refresh_token',
      }
    );
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    for (const badFetch of [
      vi.fn<typeof fetch>().mockRejectedValue(new Error('offline')),
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('<html>', { status: 500 })),
    ]) {
      await writeOAuthTokens(tokens, authBaseUrl);
      await logout({ authBaseUrl, fetch: badFetch });
      expect(await readOAuthTokens(authBaseUrl)).toBeUndefined();
    }
    expect(warn).toHaveBeenCalledTimes(2);
  });
  it('uses refreshed identity for userinfo and rejects mismatched subjects', async () => {
    await writeOAuthTokens({ ...tokens, expiresAt: 0 }, authBaseUrl);
    expect(await whoAmI({ authBaseUrl, fetch: provider() })).toEqual({
      sub: 'user-1',
      name: 'Dev',
      email: 'dev@example.com',
    });
    await expect(
      whoAmI({ authBaseUrl, fetch: provider({ user: 'other' }) })
    ).rejects.toThrow('account identity');
  });
});
