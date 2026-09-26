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
import * as os from 'node:os';
import { tmpdir } from 'node:os';
import path from 'node:path';
import chalk from 'chalk';
import { Command } from 'commander';
import open from 'open';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { BaseCLI } from '../../cli/base.js';
import * as config from '../../config/resolveConfig.js';
import { logger } from '../../console/logger.js';
import * as logging from '../../console/logging.js';
import {
  deleteOAuthTokens,
  getCredentialsPath,
  readOAuthTokens,
  writeOAuthTokens,
  type OAuthTokens,
} from '../credentialStore.js';
import {
  ACCOUNT_LOOKUP_TIMEOUT_MS,
  createUserTokenProvider,
  hasLogin,
  login,
  logout,
  whoAmI,
  type LoginOptions,
  type UserTokenProviderOptions,
} from '../oauth.js';

vi.mock('node:fs/promises', { spy: true });
vi.mock('node:os', { spy: true });
vi.mock('open', () => ({ default: vi.fn() }));

const OAUTH_CLIENT_ID = 'gt-cli';
const OAUTH_SCOPE = 'openid profile offline_access gt:*';
const authBaseUrl = 'https://auth.example/api/auth';
const apiBaseUrl = 'https://api.example';
const apiResource = 'https://api.example/';
const tokens: OAuthTokens = {
  accessToken: 'access-1',
  expiresAt: Date.now() + 3_600_000,
  refreshToken: 'refresh-1',
  resource: apiResource,
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
    userinfo?: () => Promise<Response>;
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
      return options.userinfo
        ? options.userinfo()
        : json({
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
): Promise<string> {
  const authorize = new URL(url);
  const redirect = new URL(authorize.searchParams.get('redirect_uri')!);
  redirect.searchParams.set('code', 'code-1');
  redirect.searchParams.set('state', authorize.searchParams.get('state')!);
  redirect.searchParams.set('iss', authorize.origin + '/api/auth');
  change?.(redirect.searchParams);
  const response = await networkFetch(redirect);
  return response.text();
}
function browserLogin(options: LoginOptions = {}) {
  return login({
    authBaseUrl,
    baseUrl: apiBaseUrl,
    fetch: provider(),
    openBrowser: callback,
    timeoutMs: 1000,
    ...options,
  });
}
/** Exercises stored tokens through the provider the API client uses. */
function session(options: Partial<UserTokenProviderOptions> = {}) {
  return createUserTokenProvider({
    baseUrl: apiBaseUrl,
    authBaseUrl,
    ...options,
  });
}
function forms(fetcher: ReturnType<typeof provider>) {
  return fetcher.mock.calls
    .filter(([url]) => String(url).endsWith('/oauth2/token'))
    .map(([, init]) => new URLSearchParams(String(init?.body)));
}
let stateHome: string;
beforeEach(async () => {
  stateHome = await mkdtemp(path.join(tmpdir(), 'gt-oauth-test-'));
  vi.stubEnv('SSH_CONNECTION', '');
  vi.stubEnv('SSH_CLIENT', '');
  vi.stubEnv('SSH_TTY', '');
  vi.stubEnv('XDG_STATE_HOME', stateHome);
  vi.stubEnv('XDG_CONFIG_HOME', path.join(stateHome, 'config'));
  vi.spyOn(os, 'homedir').mockReturnValue(path.join(stateHome, 'home'));
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
  await rm(stateHome, { recursive: true, force: true });
});
async function rawFile(servers: Record<string, unknown>) {
  await writeOAuthTokens(tokens, authBaseUrl);
  await writeFile(
    getCredentialsPath(),
    JSON.stringify({ version: 2, servers })
  );
}

describe('OAuth credential storage', () => {
  it('stores credentials under an absolute XDG_STATE_HOME', () => {
    expect(getCredentialsPath()).toBe(
      path.join(stateHome, 'gt', 'credentials.json')
    );
  });
  it.each([undefined, '', 'relative/state'])(
    'defaults to ~/.local/state when XDG_STATE_HOME is %j',
    (value) => {
      vi.stubEnv('XDG_STATE_HOME', value);
      expect(getCredentialsPath()).toBe(
        path.join(
          stateHome,
          'home',
          '.local',
          'state',
          'gt',
          'credentials.json'
        )
      );
    }
  );
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
        session({ fetch: fetcher }).getAccessToken()
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
  it.each(['success', 'denied', 'invalid token', 'storage failure'])(
    'shows the confirmed browser result for %s',
    async (outcome) => {
      if (outcome === 'storage failure') {
        vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('Disk full'));
      }
      let page!: Promise<string>;
      const pending = browserLogin({
        fetch:
          outcome === 'invalid token'
            ? provider({ token: async () => json(tokenResponse()) })
            : provider(),
        openBrowser: (url) => {
          page = callback(url, (params) => {
            if (outcome === 'denied') {
              params.delete('code');
              params.set('error', 'access_denied');
            }
          }).then(async (html) => {
            if (outcome === 'success') {
              expect(await readOAuthTokens(authBaseUrl)).toMatchObject({
                subject: 'user-1',
              });
            }
            return html;
          });
          return page;
        },
      });
      if (outcome === 'success') {
        await expect(pending).resolves.toMatchObject({ subject: 'user-1' });
      } else {
        await expect(pending).rejects.toThrow();
      }
      const html = await page;
      expect(html).toContain(
        outcome === 'success'
          ? 'Signed in to the gt CLI'
          : outcome === 'denied'
            ? 'Request denied'
            : 'Sign-in failed'
      );
      if (outcome === 'success') {
        expect(html).toContain(
          'You can close this tab and return to your terminal.'
        );
        expect(html).toContain(
          'Signed in as <span class="ink">dev@example.com</span>.'
        );
      } else {
        expect(html).toContain('npx gt login');
        expect(html).not.toContain('Signed in to the gt CLI');
        expect(html).not.toContain('Disk full');
      }
    }
  );
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
    // The userinfo call only names the account on the browser page; the
    // login is stored before it and does not depend on it.
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      `${authBaseUrl}/.well-known/openid-configuration`,
      `${authBaseUrl}/oauth2/token`,
      `${authBaseUrl}/jwks`,
      `${authBaseUrl}/oauth2/userinfo`,
    ]);
    expect(
      fetcher.mock.calls.every(([, init]) => init?.redirect === 'manual')
    ).toBe(true);
  });
  it.each([
    ['a malformed email', async () => json({ sub: 'user-1', email: {} })],
    ['a stalled userinfo endpoint', () => new Promise<Response>(() => {})],
    ['a failing userinfo endpoint', async () => json({ error: 'nope' }, 500)],
  ])(
    'keeps the stored login and shows success without the note for %s',
    async (_case, userinfo) => {
      let page!: Promise<string>;
      const started = Date.now();
      const result = await browserLogin({
        fetch: provider({ userinfo }),
        openBrowser: (url) => {
          page = callback(url);
          return page;
        },
      });
      expect(result.subject).toBe('user-1');
      expect(await readOAuthTokens(authBaseUrl)).toEqual(result);
      // Well inside openid-client's 30 second request timeout.
      expect(Date.now() - started).toBeLessThan(
        ACCOUNT_LOOKUP_TIMEOUT_MS + 2000
      );
      const html = await page;
      expect(html).toContain('Signed in to the gt CLI');
      expect(html).not.toContain('class="note"');
    },
    10_000
  );
  it('requests a token for the configured API, letting GT_API_URL override it', async () => {
    const resources: (string | null)[] = [];
    const record = async (url: string) => {
      resources.push(new URL(url).searchParams.get('resource'));
      await callback(url);
    };
    await browserLogin({
      baseUrl: 'https://other.example/',
      openBrowser: record,
    });
    vi.stubEnv('GT_API_URL', apiBaseUrl);
    await browserLogin({
      baseUrl: 'https://other.example/',
      openBrowser: record,
    });
    expect(resources).toEqual(['https://other.example/', apiResource]);
    expect((await readOAuthTokens(authBaseUrl))?.resource).toBe(apiResource);
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
    baseUrl: apiBaseUrl,
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
  it.each(['SSH_CONNECTION', 'SSH_CLIENT', 'SSH_TTY'])(
    'gt login prints device instructions without a listener or browser when %s is set',
    async (variable) => {
      vi.stubEnv(variable, 'ssh-session');
      vi.stubEnv('GT_AUTH_URL', authBaseUrl);
      vi.stubEnv('GT_API_URL', apiBaseUrl);
      vi.stubGlobal('fetch', provider());
      vi.spyOn(config, 'resolveConfig').mockReturnValue(null);
      vi.spyOn(logging, 'displayHeader').mockImplementation(() => {});
      vi.spyOn(logging, 'logErrorAndExit').mockImplementation((message) => {
        throw new Error(message);
      });
      vi.spyOn(logger, 'setConsoleOutput').mockImplementation(() => {});
      vi.spyOn(logger, 'setQuiet').mockImplementation(() => {});
      const message = vi.spyOn(logger, 'message').mockImplementation(() => {});
      const endCommand = vi
        .spyOn(logger, 'endCommand')
        .mockImplementation(() => {});
      const loopback = await import('../loopback.js');
      const startLoopback = vi
        .spyOn(loopback, 'startLoopbackServer')
        .mockRejectedValueOnce(new Error('Unexpected loopback listener'));
      const openBrowser = vi
        .mocked(open)
        .mockReset()
        .mockRejectedValue(new Error('Unexpected browser launch'));
      vi.useFakeTimers();
      const program = new Command().exitOverride();
      new BaseCLI(program, 'base');
      const pending = program.parseAsync(['login'], { from: 'user' });
      pending.catch(() => undefined);
      await vi.waitFor(() => expect(message).toHaveBeenCalled());
      await vi.advanceTimersByTimeAsync(5000);
      await pending;
      const instructions = String(message.mock.calls[0][0]);
      expect(instructions.split('\n')).toContain(
        chalk.cyan(String(deviceResponse().verification_uri_complete))
      );
      expect(instructions).toContain('confirm the code');
      expect(instructions).toContain('ABCD-EFGH');
      expect(instructions).toContain('Waiting for authentication...');
      expect(message).not.toHaveBeenCalledWith(
        expect.stringContaining('Opening your browser')
      );
      expect(endCommand).toHaveBeenCalledWith('You are now signed in.');
      expect(await readOAuthTokens(authBaseUrl)).toMatchObject({
        subject: 'user-1',
      });
      expect(startLoopback).not.toHaveBeenCalled();
      expect(openBrowser).not.toHaveBeenCalled();
    }
  );
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
    const loopback = await import('../loopback.js');
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
        session({
          fetch: provider({
            token: async () =>
              json({ error }, error === 'invalid_client' ? 401 : 400),
          }),
        }).refreshAccessToken()
      ).rejects.toThrow(
        error === 'invalid_client' ? 'does not recognize' : 'expired'
      );
      expect(await readOAuthTokens(authBaseUrl)).toEqual(tokens);
    }
  );
  it('reports HTTP outage status without resetting credentials', async () => {
    await writeOAuthTokens(tokens, authBaseUrl);
    await expect(
      session({
        fetch: provider({
          token: async () => new Response('<html>', { status: 503 }),
        }),
      }).refreshAccessToken()
    ).rejects.toThrow('HTTP 503');
    expect(await readOAuthTokens(authBaseUrl)).toEqual(tokens);
  });
  it('shares refresh in process, clears failed work and persists rotation before returning', async () => {
    await writeOAuthTokens({ ...tokens, expiresAt: 0 }, authBaseUrl);
    await expect(
      session({
        fetch: provider({
          token: async () => {
            throw new Error('offline');
          },
        }),
      }).refreshAccessToken()
    ).rejects.toThrow();
    let release!: (value: Response) => void;
    const fetcher = provider({
      token: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    });
    const pending = Promise.all([
      session({ fetch: fetcher }).getAccessToken(),
      session({ fetch: fetcher }).refreshAccessToken(),
      session({ fetch: fetcher }).getAccessToken(),
    ]);
    await vi.waitFor(() => expect(forms(fetcher)).toHaveLength(1));
    expect((await readOAuthTokens(authBaseUrl))?.refreshToken).toBe(
      'refresh-1'
    );
    release(json(tokenResponse()));
    expect(await pending).toEqual(['access-2', 'access-2', 'access-2']);
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
    await session({
      fetch: provider({ token: async () => json(value) }),
    }).refreshAccessToken();
    expect(await readOAuthTokens(authBaseUrl)).toMatchObject({
      subject: tokens.subject,
      refreshToken: tokens.refreshToken,
      scope: tokens.scope,
    });
  });
  it('checks a newly signed refresh subject before writing rotation', async () => {
    await writeOAuthTokens(tokens, authBaseUrl);
    await expect(
      session({
        fetch: provider({
          token: async () =>
            json(tokenResponse(await idToken({ sub: 'other' }))),
        }),
      }).refreshAccessToken()
    ).rejects.toThrow('expected account identity');
    expect(await readOAuthTokens(authBaseUrl)).toEqual(tokens);
    await session({ fetch: provider() }).refreshAccessToken();
    expect((await readOAuthTokens(authBaseUrl))?.subject).toBe(tokens.subject);
  });
  it('constructs the provider lazily and returns fresh tokens without discovery', async () => {
    vi.stubEnv('GT_AUTH_URL', authBaseUrl);
    const tokenProvider = createUserTokenProvider({ baseUrl: apiBaseUrl });
    await expect(tokenProvider.getAccessToken()).rejects.toThrow('gt login');
    await writeOAuthTokens(tokens, authBaseUrl);
    expect(await tokenProvider.getAccessToken()).toBe('access-1');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it('reports a stored login only for the API it was issued for, without network', async () => {
    expect(await hasLogin({ baseUrl: apiBaseUrl, authBaseUrl })).toBe(false);
    await writeOAuthTokens({ ...tokens, expiresAt: 0 }, authBaseUrl);
    expect(await hasLogin({ baseUrl: apiBaseUrl, authBaseUrl })).toBe(true);
    expect(
      await hasLogin({ baseUrl: 'https://other.example', authBaseUrl })
    ).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it('refuses a login issued for a different API without refreshing it', async () => {
    await writeOAuthTokens({ ...tokens, expiresAt: 0 }, authBaseUrl);
    const fetcher = provider();
    await expect(
      session({
        baseUrl: 'https://other.example',
        fetch: fetcher,
      }).getAccessToken()
    ).rejects.toThrow(
      'signed in to https://api.example/, but this project uses https://other.example/'
    );
    expect(fetcher).not.toHaveBeenCalled();
    expect(await readOAuthTokens(authBaseUrl)).toEqual({
      ...tokens,
      expiresAt: 0,
    });
  });
  it('refreshes within the 30-second buffer', async () => {
    await writeOAuthTokens(
      { ...tokens, expiresAt: Date.now() + 29_000 },
      authBaseUrl
    );
    expect(
      await session({
        fetch: provider({ token: async () => json(tokenResponse()) }),
      }).getAccessToken()
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
