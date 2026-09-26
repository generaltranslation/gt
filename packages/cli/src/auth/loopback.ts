import { createServer, type Server, type ServerResponse } from 'node:http';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import {
  renderCallbackPage,
  type CallbackPageDetails,
} from './callbackPage.js';

export const LOOPBACK_CALLBACK_PATH = '/callback';
const DEFAULT_CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;

export type LoopbackServer = {
  /** Loopback redirect URI bound to an ephemeral port, e.g. http://127.0.0.1:53211/callback */
  redirectUri: string;
  /**
   * Shows the result page only after the callback has been validated and
   * saved. `describe` adds what the page says about a success, such as the
   * signed-in account.
   */
  waitForCallback: <T>(
    onCallback: (url: URL) => Promise<T>,
    timeoutMs?: number,
    options?: { describe?: (result: T) => CallbackPageDetails }
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
      timeoutMs = DEFAULT_CALLBACK_TIMEOUT_MS,
      options?: { describe?: (result: T) => CallbackPageDetails }
    ) {
      return new Promise<T>((resolve, reject) => {
        let timedOut = false;
        // Set by the first callback request: the page every request for that
        // same callback receives once the exchange has settled.
        let outcome: { href: string; page: Promise<string> } | undefined;
        timeout = setTimeout(() => {
          timedOut = true;
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

        const respond = (response: ServerResponse, page: string) => {
          response.writeHead(200, {
            'cache-control': 'no-store',
            'content-security-policy':
              "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
            'content-type': 'text/html; charset=utf-8',
            'x-content-type-options': 'nosniff',
          });
          response.end(page);
        };

        server.on('request', async (request, response) => {
          const target = request.url ?? '/';
          const url = URL.canParse(target, origin)
            ? new URL(target, origin)
            : undefined;
          if (
            !url ||
            timedOut ||
            request.method !== 'GET' ||
            url.origin !== origin ||
            url.pathname !== LOOPBACK_CALLBACK_PATH ||
            (outcome && outcome.href !== url.href)
          ) {
            response.writeHead(404, {
              'cache-control': 'no-store',
              'content-type': 'text/plain; charset=utf-8',
            });
            response.end('Not found');
            return;
          }

          // Browsers abort and repeat a navigation (a redirect issued twice,
          // a refresh while the exchange runs), so a repeat of the same
          // callback gets the same page instead of a 404.
          if (outcome) {
            respond(response, await outcome.page);
            return;
          }

          clearTimeout(timeout);
          outcome = {
            href: url.href,
            page: (async () => {
              let page: string;
              try {
                const result = await onCallback(url);
                page = renderCallbackPage({
                  ok: true,
                  ...options?.describe?.(result),
                });
                respond(response, page);
                resolve(result);
              } catch (error) {
                // The page says why in the coarsest terms: a denial is the
                // user's own choice, anything else is reported in the terminal.
                const reason =
                  url.searchParams.get('error') === 'access_denied'
                    ? 'denied'
                    : 'failed';
                page = renderCallbackPage({ ok: false, reason });
                respond(response, page);
                reject(error);
              } finally {
                server.close();
              }
              return page;
            })(),
          };
        });
      });
    },
    close() {
      clearTimeout(timeout);
      server.close();
    },
  };
}
