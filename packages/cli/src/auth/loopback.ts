import { createServer, type Server } from 'node:http';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { renderCallbackPage } from './callbackPage.js';

export const LOOPBACK_CALLBACK_PATH = '/callback';
const DEFAULT_CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;

export type LoopbackServer = {
  /** Loopback redirect URI bound to an ephemeral port, e.g. http://127.0.0.1:53211/callback */
  redirectUri: string;
  /** Shows the result page only after the callback has been validated and saved. */
  waitForCallback: <T>(
    onCallback: (url: URL) => Promise<T>,
    timeoutMs?: number
  ) => Promise<T>;
  close: () => void;
};

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
        reject(
          new Error(
            createDiagnosticMessage({
              whatHappened: 'Could not resolve the loopback callback address',
            })
          )
        );
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
  let timeout: NodeJS.Timeout | undefined;

  return {
    redirectUri: `${origin}${LOOPBACK_CALLBACK_PATH}`,
    waitForCallback<T>(
      onCallback: (url: URL) => Promise<T>,
      timeoutMs = DEFAULT_CALLBACK_TIMEOUT_MS
    ) {
      return new Promise<T>((resolve, reject) => {
        let settled = false;
        timeout = setTimeout(() => {
          settled = true;
          server.close();
          reject(
            new Error(
              createDiagnosticMessage({
                whatHappened: 'Timed out waiting for authentication',
                fix: 'Run `gt login` again',
              })
            )
          );
        }, timeoutMs);

        server.on('request', async (request, response) => {
          const target = request.url ?? '/';
          const url = URL.canParse(target, origin)
            ? new URL(target, origin)
            : undefined;
          if (
            !url ||
            settled ||
            request.method !== 'GET' ||
            url.origin !== origin ||
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
          response.writeHead(200, {
            'cache-control': 'no-store',
            'content-security-policy':
              "default-src 'none'; style-src 'unsafe-inline'",
            'content-type': 'text/html; charset=utf-8',
            'x-content-type-options': 'nosniff',
          });
          try {
            const result = await onCallback(url);
            response.end(renderCallbackPage(true));
            resolve(result);
          } catch (error) {
            response.end(renderCallbackPage(false));
            reject(error);
          } finally {
            server.close();
          }
        });
      });
    },
    close() {
      clearTimeout(timeout);
      server.close();
    },
  };
}
