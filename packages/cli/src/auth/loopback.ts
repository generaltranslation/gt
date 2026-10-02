import { createServer, type Server, type ServerResponse } from 'node:http';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import {
  renderCallbackPage,
  type CallbackPageDetails,
} from './callbackPage.js';

export const LOOPBACK_CALLBACK_PATH = '/callback';
const DEFAULT_CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;
/**
 * How long a settled callback's page stays available to a browser that
 * repeats the navigation after the exchange (a first request it aborted, a
 * refresh), so the repeat gets the page instead of a refused connection.
 */
export const CALLBACK_REPEAT_WINDOW_MS = 10_000;

export type CallbackWaitOptions<T> = {
  /** What the page says about a success, such as the signed-in account. */
  describe?: (result: T) => CallbackPageDetails;
  /**
   * Whether a failed exchange was the user's own denial; the page reads the
   * exchange's error, so it agrees with the terminal. Without it every
   * failure is shown as failed.
   */
  failure?: (error: unknown) => 'denied' | 'failed';
};

export type LoopbackServer = {
  /** Loopback redirect URI bound to an ephemeral port, e.g. http://127.0.0.1:53211/callback */
  redirectUri: string;
  /**
   * Shows the result page only after the callback has been validated and
   * saved. `describe` adds what the page says about a success, such as the
   * signed-in account, and `failure` says whether a failure was a denial.
   */
  waitForCallback: <T>(
    onCallback: (url: URL) => Promise<T>,
    timeoutMs?: number,
    options?: CallbackWaitOptions<T>
  ) => Promise<T>;
  /**
   * Stops the server. Once a callback has settled, repeats of that callback
   * are still answered for CALLBACK_REPEAT_WINDOW_MS, on a listener that
   * never holds the process open.
   */
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
  let repeatWindow: NodeJS.Timeout | undefined;
  // After a callback settles, the listener answers its repeats for a short
  // while and then closes. It is unref'd, so a CLI that has finished exits
  // without waiting for the window to end.
  const closeAfterRepeats = () => {
    if (repeatWindow) return;
    server.unref();
    repeatWindow = setTimeout(() => server.close(), CALLBACK_REPEAT_WINDOW_MS);
    repeatWindow.unref();
  };

  return {
    redirectUri: `${origin}${LOOPBACK_CALLBACK_PATH}`,
    waitForCallback<T>(
      onCallback: (url: URL) => Promise<T>,
      timeoutMs = DEFAULT_CALLBACK_TIMEOUT_MS,
      options?: CallbackWaitOptions<T>
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

        // Every response closes its connection. A repeat of the callback can
        // be answered after the login has finished, and Node leaves a
        // keep-alive socket open after a response until the keep-alive
        // timeout, which would hold the process open.
        const respond = (response: ServerResponse, page: string) => {
          response.writeHead(200, {
            'cache-control': 'no-store',
            connection: 'close',
            'content-security-policy':
              "default-src 'none'; style-src 'unsafe-inline'",
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
              connection: 'close',
              'content-type': 'text/plain; charset=utf-8',
            });
            response.end('Not found');
            return;
          }

          // Browsers abort and repeat a navigation (a redirect issued twice,
          // a refresh while the exchange runs or just after it), so a repeat
          // of the same callback gets the same page instead of a 404.
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
                // The exchange's error decides, not the callback's own error
                // parameter, which a callback with a bad state also carries.
                const reason = options?.failure?.(error) ?? 'failed';
                page = renderCallbackPage({ ok: false, reason });
                respond(response, page);
                reject(error);
              } finally {
                closeAfterRepeats();
              }
              return page;
            })(),
          };
        });
      });
    },
    close() {
      clearTimeout(timeout);
      // a settled callback's repeat window closes the server on its own
      if (!repeatWindow) server.close();
    },
  };
}
