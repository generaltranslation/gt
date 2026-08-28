import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteOAuthTokens,
  getCredentialsPath,
  getValidAccessToken,
  login,
  logout,
  pollDeviceToken,
  readOAuthTokens,
  refreshOAuthTokens,
  requestDeviceCode,
  whoAmI,
  writeOAuthTokens,
  type DeviceCode,
  type OAuthTokens,
} from './oauth.js';

const tokens: OAuthTokens = {
  accessToken: 'access-1',
  expiresAt: Date.now() + 3_600_000,
  refreshToken: 'refresh-1',
  scope: 'openid api:read',
  tokenType: 'Bearer',
};

const deviceCode: DeviceCode = {
  deviceCode: 'device-code',
  expiresIn: 600,
  interval: 2,
  userCode: 'ABCD-EFGH',
  verificationUri: 'https://dash.example/device',
  verificationUriComplete: 'https://dash.example/device?user_code=ABCD-EFGH',
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
    scope: 'openid api:read',
    token_type: 'Bearer',
  };
}

describe('OAuth credential storage', () => {
  let configHome: string;

  beforeEach(async () => {
    configHome = await mkdtemp(path.join(tmpdir(), 'gt-oauth-test-'));
    process.env.XDG_CONFIG_HOME = configHome;
  });

  afterEach(async () => {
    await deleteOAuthTokens();
    delete process.env.XDG_CONFIG_HOME;
  });

  it('writes a versioned credential file with owner-only permissions', async () => {
    await writeOAuthTokens(tokens);

    expect(await readOAuthTokens()).toEqual(tokens);
    expect(JSON.parse(await readFile(getCredentialsPath(), 'utf8'))).toEqual({
      version: 1,
      tokens,
    });
    if (process.platform !== 'win32') {
      expect((await stat(getCredentialsPath())).mode & 0o777).toBe(0o600);
    }
  });

  it('atomically replaces rotated refresh tokens', async () => {
    await writeOAuthTokens(tokens);
    await writeOAuthTokens({ ...tokens, refreshToken: 'refresh-2' });

    expect((await readOAuthTokens())?.refreshToken).toBe('refresh-2');
  });
});

describe('OAuth device flow', () => {
  it('requests codes with the public client, resource, and scopes', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        device_code: deviceCode.deviceCode,
        expires_in: deviceCode.expiresIn,
        interval: deviceCode.interval,
        user_code: deviceCode.userCode,
        verification_uri: deviceCode.verificationUri,
        verification_uri_complete: deviceCode.verificationUriComplete,
      })
    );

    await expect(
      requestDeviceCode({
        apiResource: 'https://api.example',
        authBaseUrl: 'https://auth.example',
        fetch: fetchImplementation,
      })
    ).resolves.toEqual(deviceCode);
    const request = fetchImplementation.mock.calls[0][1];
    expect(String(request?.body)).toContain('client_id=gt-cli');
    expect(String(request?.body)).toContain(
      'resource=https%3A%2F%2Fapi.example'
    );
    expect(String(request?.body)).toContain('offline_access');
  });

  it('honors authorization_pending and slow_down polling responses', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({ error: 'authorization_pending' }, 400)
      )
      .mockResolvedValueOnce(jsonResponse({ error: 'slow_down' }, 400))
      .mockResolvedValueOnce(
        jsonResponse(tokenResponse('access-2', 'refresh-2'))
      );
    const sleep = vi
      .fn<(milliseconds: number) => Promise<void>>()
      .mockResolvedValue();

    const result = await pollDeviceToken({
      authBaseUrl: 'https://auth.example',
      deviceCode,
      fetch: fetchImplementation,
      now: () => 1_000,
      sleep,
    });

    expect(result.accessToken).toBe('access-2');
    expect(sleep.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([
      2_000, 2_000, 7_000,
    ]);
  });

  it('opens verification_uri_complete and persists the result', async () => {
    const configHome = await mkdtemp(path.join(tmpdir(), 'gt-login-test-'));
    process.env.XDG_CONFIG_HOME = configHome;
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          device_code: deviceCode.deviceCode,
          expires_in: deviceCode.expiresIn,
          interval: 0,
          user_code: deviceCode.userCode,
          verification_uri: deviceCode.verificationUri,
          verification_uri_complete: deviceCode.verificationUriComplete,
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(tokenResponse('access-2', 'refresh-2'))
      );
    const openBrowser = vi.fn().mockResolvedValue(undefined);

    await login({
      authBaseUrl: 'https://auth.example',
      fetch: fetchImplementation,
      openBrowser,
      sleep: async () => undefined,
    });

    expect(openBrowser).toHaveBeenCalledWith(
      deviceCode.verificationUriComplete
    );
    expect((await readOAuthTokens())?.accessToken).toBe('access-2');
    await deleteOAuthTokens();
    delete process.env.XDG_CONFIG_HOME;
  });
});

describe('OAuth session operations', () => {
  let configHome: string;

  beforeEach(async () => {
    configHome = await mkdtemp(path.join(tmpdir(), 'gt-oauth-session-test-'));
    process.env.XDG_CONFIG_HOME = configHome;
  });

  afterEach(async () => {
    await deleteOAuthTokens();
    delete process.env.XDG_CONFIG_HOME;
  });

  it('persists refresh-token rotation before returning the new access token', async () => {
    await writeOAuthTokens({ ...tokens, expiresAt: 0 });
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(tokenResponse('access-2', 'refresh-2')));

    await expect(
      getValidAccessToken({
        authBaseUrl: 'https://auth.example',
        fetch: fetchImplementation,
      })
    ).resolves.toBe('access-2');
    expect((await readOAuthTokens())?.refreshToken).toBe('refresh-2');
  });

  it('preserves the refresh token when a provider does not rotate it', async () => {
    await writeOAuthTokens(tokens);
    const response = tokenResponse('access-2', 'unused');
    delete response.refresh_token;

    await refreshOAuthTokens({
      authBaseUrl: 'https://auth.example',
      fetch: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(response)),
    });

    expect(await readOAuthTokens()).toMatchObject({
      refreshToken: 'refresh-1',
      scope: tokens.scope,
    });
  });

  it('revokes the refresh token and removes local credentials on logout', async () => {
    await writeOAuthTokens(tokens);
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 200 }));

    await logout({
      authBaseUrl: 'https://auth.example',
      fetch: fetchImplementation,
    });

    expect(await readOAuthTokens()).toBeUndefined();
    expect(String(fetchImplementation.mock.calls[0][1]?.body)).toContain(
      'token=refresh-1'
    );
  });

  it('refreshes and returns userinfo for whoami', async () => {
    await writeOAuthTokens({ ...tokens, expiresAt: 0 });
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(tokenResponse('access-2', 'refresh-2'))
      )
      .mockResolvedValueOnce(
        jsonResponse({ sub: 'user-1', email: 'dev@example.com', name: 'Dev' })
      );

    await expect(
      whoAmI({
        authBaseUrl: 'https://auth.example',
        fetch: fetchImplementation,
      })
    ).resolves.toEqual({
      sub: 'user-1',
      email: 'dev@example.com',
      name: 'Dev',
    });
    expect(fetchImplementation.mock.calls[1][1]?.headers).toEqual({
      Authorization: 'Bearer access-2',
    });
  });
});
