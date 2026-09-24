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
    const pending = server.waitForCallback(5000);
    const callback = `${server.redirectUri}?code=abc&code=other&state=xyz&iss=https%3A%2F%2Fissuer.example`;
    const response = await fetch(callback);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-security-policy')).toContain(
      "default-src 'none'"
    );
    expect(await response.text()).toContain('check whether sign in completed');
    expect((await pending).href).toBe(callback);
  });
  it('uses the same neutral received page for provider errors', async () => {
    const server = await startLoopbackServer();
    const pending = server.waitForCallback(5000);
    const response = await fetch(
      `${server.redirectUri}?error=access_denied&state=xyz`
    );
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain("You're signed in");
    expect((await pending).searchParams.get('error')).toBe('access_denied');
  });
  it('ignores unrelated paths, methods and absolute targets with another origin', async () => {
    const server = await startLoopbackServer();
    const pending = server.waitForCallback(5000);
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
    await expect(server.waitForCallback(20)).rejects.toThrow(
      'Timed out waiting for the browser to sign in'
    );
    await expect(fetch(server.redirectUri)).rejects.toThrow();
  });
});
