import { request } from 'node:http';
import { describe, expect, it } from 'vitest';
import { LOOPBACK_CALLBACK_PATH, startLoopbackServer } from './loopback.js';

describe('loopback authorization server', () => {
  it('binds 127.0.0.1 and preserves the entire callback, including duplicate security parameters', async () => {
    const server = await startLoopbackServer();
    const url = new URL(server.redirectUri);
    expect(url.hostname).toBe('127.0.0.1');
    expect(url.pathname).toBe(LOOPBACK_CALLBACK_PATH);
    expect(Number(url.port)).toBeGreaterThan(0);
    const pending = server.waitForCallback(async (url) => url, 5000);
    const callback = `${server.redirectUri}?code=abc&code=other&state=xyz&iss=https%3A%2F%2Fissuer.example`;
    const response = await fetch(callback);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-security-policy')).toBe(
      "default-src 'none'; style-src 'unsafe-inline'; img-src data:"
    );
    const page = await response.text();
    expect(page).toContain('Signed in to the gt CLI');
    expect(page).toContain(
      'You can close this tab and return to your terminal.'
    );
    expect(page).not.toContain('class="note"');
    expect((await pending).href).toBe(callback);
  });
  it('names the signed-in account when the callback describes it', async () => {
    const server = await startLoopbackServer();
    const pending = server.waitForCallback(
      async (url) => ({ url, email: 'dev@example.com' }),
      5000,
      { describe: (outcome) => ({ email: outcome.email }) }
    );
    const response = await fetch(`${server.redirectUri}?code=abc&state=xyz`);
    const page = await response.text();
    expect(page).toContain(
      'Signed in as <span class="ink">dev@example.com</span>.'
    );
    expect((await pending).email).toBe('dev@example.com');
  });
  it('shows a denied request as denied, without exposing callback errors', async () => {
    const server = await startLoopbackServer();
    const error = new Error('Sensitive callback details');
    const pending = server.waitForCallback(async (url) => {
      expect(url.searchParams.get('error')).toBe('access_denied');
      throw error;
    }, 5000);
    const rejected = expect(pending).rejects.toBe(error);
    const response = await fetch(
      `${server.redirectUri}?error=access_denied&state=xyz`
    );
    expect(response.status).toBe(200);
    const page = await response.text();
    expect(page).toContain('Request denied');
    expect(page).toContain('class="glyph error"');
    expect(page).not.toContain('Signed in to the gt CLI');
    expect(page).not.toContain(error.message);
    await rejected;
  });
  it('shows any other callback failure as a failed sign-in', async () => {
    const server = await startLoopbackServer();
    const error = new Error('Sensitive exchange details');
    const pending = server.waitForCallback(async () => {
      throw error;
    }, 5000);
    const rejected = expect(pending).rejects.toBe(error);
    const page = await (
      await fetch(`${server.redirectUri}?code=abc&state=xyz`)
    ).text();
    expect(page).toContain('Sign-in failed');
    expect(page).toContain('npx gt login');
    expect(page).not.toContain(error.message);
    await rejected;
  });
  it('serves the same page to a repeated request for the same callback', async () => {
    const server = await startLoopbackServer();
    let release!: () => void;
    const exchange = new Promise<void>((resolve) => (release = resolve));
    const pending = server.waitForCallback(async (url) => {
      await exchange;
      return url;
    }, 5000);
    const callback = `${server.redirectUri}?code=abc&state=xyz`;
    // A browser that aborts and repeats the navigation while the exchange
    // runs, then a repeat with another code, which is not this login.
    const first = fetch(callback);
    const second = fetch(callback);
    const other = fetch(`${server.redirectUri}?code=other&state=xyz`);
    expect((await other).status).toBe(404);
    release();
    const pages = await Promise.all([first, second]);
    expect(pages.map((r) => r.status)).toEqual([200, 200]);
    for (const response of pages) {
      expect(await response.text()).toContain('Signed in to the gt CLI');
    }
    expect((await pending).href).toBe(callback);
  });
  it('ignores unrelated paths, methods and absolute targets with another origin', async () => {
    const server = await startLoopbackServer();
    const pending = server.waitForCallback(async (url) => url, 5000);
    const url = new URL(server.redirectUri);
    expect((await fetch(`${url.origin}/favicon.ico`)).status).toBe(404);
    expect((await fetch(server.redirectUri, { method: 'POST' })).status).toBe(
      404
    );
    const status = await new Promise((resolve, reject) => {
      const req = request(
        {
          hostname: url.hostname,
          port: url.port,
          path: 'http://evil.example/callback?code=x',
          headers: { Host: 'evil.example' },
        },
        (res) => {
          res.resume();
          resolve(res.statusCode);
        }
      );
      req.on('error', reject);
      req.end();
    });
    expect(status).toBe(404);
    await fetch(`${server.redirectUri}?code=real&state=s`);
    expect((await pending).searchParams.get('code')).toBe('real');
  });
  it('rejects and closes when the callback times out', async () => {
    const server = await startLoopbackServer();
    await expect(
      server.waitForCallback(async (url) => url, 20)
    ).rejects.toThrow('Timed out waiting for authentication');
    await expect(fetch(server.redirectUri)).rejects.toThrow();
  });
});
