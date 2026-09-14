import { createServer, type Server } from 'node:http';

export const LOOPBACK_CALLBACK_PATH = '/callback';
const DEFAULT_CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;

export type AuthorizationCallback = {
  code?: string;
  error?: string;
  errorDescription?: string;
  state?: string;
};

export type LoopbackServer = {
  /** Loopback redirect URI bound to an ephemeral port, e.g. http://127.0.0.1:53211/callback */
  redirectUri: string;
  /** Resolves with the raw callback parameters of the first request to the callback path. */
  waitForCallback: (timeoutMs?: number) => Promise<AuthorizationCallback>;
  close: () => void;
};

export function parseAuthorizationCallback(
  url: URL | string
): AuthorizationCallback {
  const parsed = typeof url === 'string' ? new URL(url) : url;
  return {
    code: parsed.searchParams.get('code') ?? undefined,
    error: parsed.searchParams.get('error') ?? undefined,
    errorDescription: parsed.searchParams.get('error_description') ?? undefined,
    state: parsed.searchParams.get('state') ?? undefined,
  };
}

function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    // RFC 8252 §7.3: bind the loopback interface on an ephemeral port; the
    // authorization server matches loopback redirect URIs ignoring the port.
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not resolve the loopback callback address'));
        return;
      }
      resolve(address.port);
    });
  });
}

export async function startLoopbackServer(): Promise<LoopbackServer> {
  const server = createServer();
  const port = await listen(server);
  const origin = `http://127.0.0.1:${port}`;

  return {
    redirectUri: `${origin}${LOOPBACK_CALLBACK_PATH}`,
    waitForCallback(timeoutMs = DEFAULT_CALLBACK_TIMEOUT_MS) {
      return new Promise((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => {
          settled = true;
          server.close();
          reject(new Error('Timed out waiting for the browser to sign in'));
        }, timeoutMs);

        server.on('request', (request, response) => {
          const url = new URL(request.url ?? '/', origin);
          if (
            settled ||
            request.method !== 'GET' ||
            url.pathname !== LOOPBACK_CALLBACK_PATH
          ) {
            response.writeHead(404, {
              'cache-control': 'no-store',
              'content-type': 'text/plain; charset=utf-8',
            });
            response.end('Not found');
            return;
          }

          settled = true;
          clearTimeout(timeout);
          const callback = parseAuthorizationCallback(url);
          const succeeded = Boolean(callback.code) && !callback.error;
          response.writeHead(succeeded ? 200 : 400, {
            'cache-control': 'no-store',
            'content-security-policy': "default-src 'none'",
            'content-type': 'text/html; charset=utf-8',
            'x-content-type-options': 'nosniff',
          });
          response.end(
            succeeded
              ? '<!doctype html><title>Signed in</title><p>You are signed in to the General Translation CLI. You can close this tab and return to your terminal.</p>'
              : '<!doctype html><title>Sign in failed</title><p>Sign in did not complete. Return to your terminal for details.</p>'
          );
          server.close();
          resolve(callback);
        });
      });
    },
    close() {
      server.close();
    },
  };
}
