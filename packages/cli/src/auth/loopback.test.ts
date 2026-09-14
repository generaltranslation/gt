import { describe, expect, it } from 'vitest';
import {
  LOOPBACK_CALLBACK_PATH,
  parseAuthorizationCallback,
  startLoopbackServer,
} from './loopback.js';

describe('loopback authorization server', () => {
  it('binds an ephemeral 127.0.0.1 port and resolves the first callback', async () => {
    const server = await startLoopbackServer();
    const url = new URL(server.redirectUri);
    expect(url.hostname).toBe('127.0.0.1');
    expect(url.pathname).toBe(LOOPBACK_CALLBACK_PATH);
    expect(Number(url.port)).toBeGreaterThan(0);

    const pending = server.waitForCallback(5_000);
    const response = await fetch(`${server.redirectUri}?code=abc&state=xyz`);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).toContain('signed in');
    await expect(pending).resolves.toEqual({
      code: 'abc',
      error: undefined,
      errorDescription: undefined,
      state: 'xyz',
    });
  });

  it('returns the provider error to the caller and renders a failure page', async () => {
    const server = await startLoopbackServer();
    const pending = server.waitForCallback(5_000);
    const response = await fetch(
      `${server.redirectUri}?error=access_denied&error_description=User%20denied&state=xyz`
    );

    expect(response.status).toBe(400);
    await expect(pending).resolves.toMatchObject({
      error: 'access_denied',
      errorDescription: 'User denied',
      state: 'xyz',
    });
  });

  it('ignores requests to other paths and keeps waiting', async () => {
    const server = await startLoopbackServer();
    const pending = server.waitForCallback(5_000);
    const origin = new URL(server.redirectUri).origin;

    const stray = await fetch(`${origin}/favicon.ico`);
    expect(stray.status).toBe(404);

    await fetch(`${server.redirectUri}?code=real&state=s`);
    await expect(pending).resolves.toMatchObject({ code: 'real' });
  });

  it('rejects when no callback arrives before the timeout', async () => {
    const server = await startLoopbackServer();
    await expect(server.waitForCallback(20)).rejects.toThrow(
      'Timed out waiting for the browser to sign in'
    );
  });
});

describe('parseAuthorizationCallback', () => {
  it('reads code, state, and error fields from a redirect URL', () => {
    expect(
      parseAuthorizationCallback(
        'http://127.0.0.1:1234/callback?code=c&state=s&error=e&error_description=d'
      )
    ).toEqual({ code: 'c', state: 's', error: 'e', errorDescription: 'd' });
  });
});
