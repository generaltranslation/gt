import { createServer, type Server, type ServerResponse } from 'node:http';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import {
  CALLBACK_PAGE_CSP,
  renderCallbackPage,
  type CallbackPageDetails,
} from './callbackPage.js';

export const LOOPBACK_CALLBACK_PATH = '/callback';
const DEFAULT_CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;
/**
 * How long a settled callback's page stays available to a browser that
 * repeats the navigation after the exchange (a first request it aborted, a
 * refresh), while the process is still running.
 */
export const CALLBACK_REPEAT_WINDOW_MS = 10_000;
/**
 * How long the process stays open for the browser's repeat when the first
 * request was abandoned before its page was sent, so the page the browser
 * never received can still reach it.
 */
export const CALLBACK_RETRY_HOLD_MS = 5_000;

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
   * are still answered for CALLBACK_REPEAT_WINDOW_MS while the process runs;
   * the listener holds the process open only for CALLBACK_RETRY_HOLD_MS, and
   * only when the first page was never sent. A command that exits on its own
   * (a failed `gt login` exits at once) ends the window early.
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
  let hold: NodeJS.Timeout | undefined;
  // Lets the process exit without waiting for the repeat window.
  const release = () => {
    clearTimeout(hold);
    server.unref();
  };
  // After a callback settles, the listener answers its repeats for a short
  // while and then closes. A first page the browser received needs no
  // repeat, so the listener is unref'd at once and a finished CLI exits
  // without waiting. A first page the browser abandoned before it was sent
  // keeps the process open until the repeat is answered or the hold ends.
  const closeAfterRepeats = (firstPageSent: boolean) => {
    if (repeatWindow) return;
    repeatWindow = setTimeout(() => server.close(), CALLBACK_REPEAT_WINDOW_MS);
    repeatWindow.unref();
    if (firstPageSent) release();
    else hold = setTimeout(release, CALLBACK_RETRY_HOLD_MS);
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
            'content-security-policy': CALLBACK_PAGE_CSP,
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
            const page = await outcome.page;
            // A repeat the browser abandoned too gets nothing, and the hold
            // stays for the next one.
            if (response.destroyed) return;
            respond(response, page);
            release();
            return;
          }

          clearTimeout(timeout);
          outcome = {
            href: url.href,
            page: (async () => {
              let page: string;
              // Read when the exchange settles: a browser that aborted this
              // navigation has closed the connection by then.
              let firstPageSent = false;
              try {
                const result = await onCallback(url);
                page = renderCallbackPage({
                  ok: true,
                  ...options?.describe?.(result),
                });
                firstPageSent = !response.destroyed;
                respond(response, page);
                resolve(result);
              } catch (error) {
                // The page says why in the coarsest terms: a denial is the
                // user's own choice, anything else is reported in the terminal.
                // The exchange's error decides, not the callback's own error
                // parameter, which a callback with a bad state also carries.
                const reason = options?.failure?.(error) ?? 'failed';
                page = renderCallbackPage({ ok: false, reason });
                firstPageSent = !response.destroyed;
                respond(response, page);
                reject(error);
              } finally {
                closeAfterRepeats(firstPageSent);
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
