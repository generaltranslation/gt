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
    expect(response.headers.get('content-security-policy')).toContain(
      "default-src 'none'"
    );
    const page = await response.text();
    expect(page).toContain('<h1>Successfully authenticated gt CLI</h1>');
    expect(page).toContain(
      'You may now close this tab and return to the terminal.'
    );
    expect((await pending).href).toBe(callback);
  });
  it('shows failure without exposing callback errors', async () => {
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
    expect(page).toContain('<h1>Authentication failed</h1>');
    expect(page).toContain('class="error"');
    expect(page).not.toContain('Successfully authenticated');
    expect(page).not.toContain(error.message);
    await rejected;
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
