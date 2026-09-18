import { createServer } from 'node:http';

const callbackPath = '/cli/callback';
const callbackTimeoutMs = 15 * 60 * 1000;
const authorizationCodePattern = /^[A-Za-z0-9_-]{43}$/;

export async function createCliAuthorizationCallback() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Could not resolve the CLI callback address');
  }

  return {
    callbackUrl: `http://127.0.0.1:${address.port}${callbackPath}`,
    waitForCode(state: string, timeoutMs = callbackTimeoutMs) {
      return new Promise<string>((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => {
          settled = true;
          server.close();
          reject(new Error('CLI authorization timed out'));
        }, timeoutMs);

        server.on('request', (request, response) => {
          const url = new URL(request.url ?? '/', 'http://127.0.0.1');
          const code = url.searchParams.get('code');
          const returnedState = url.searchParams.get('state');
          if (
            request.method !== 'GET' ||
            url.pathname !== callbackPath ||
            !code ||
            !authorizationCodePattern.test(code) ||
            returnedState !== state ||
            settled
          ) {
            response.writeHead(400, {
              'cache-control': 'no-store',
              'content-type': 'text/plain; charset=utf-8',
            });
            response.end('Invalid CLI authorization callback.');
            return;
          }

          settled = true;
          clearTimeout(timeout);
          response.writeHead(200, {
            'cache-control': 'no-store',
            'content-security-policy': "default-src 'none'",
            'content-type': 'text/html; charset=utf-8',
            'x-content-type-options': 'nosniff',
          });
          response.end(
            '<!doctype html><title>CLI authorized</title><p>CLI authorization complete. Return to your terminal.</p>'
          );
          server.close();
          resolve(code);
        });
      });
    },
    close() {
      server.close();
    },
  };
}
