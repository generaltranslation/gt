/**
 * The server only listens on 127.0.0.1, but any website open in the same
 * browser can still send it requests. These checks stop other sites from
 * starting builds or changing settings, and stop DNS-rebinding pages from
 * reading the API through a hostname that resolves to this machine.
 */

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

/** The Vite dev server for the UI (`pnpm dev:ui`) proxies to this server. */
export const UI_DEV_PORT = 4599;

export interface RequestInfo {
  method: string;
  path: string;
  /** The browser's Sec-Fetch-Site header; absent for curl and agents. */
  fetchSite?: string | undefined;
  host: string | undefined;
  origin: string | undefined;
  contentType: string | undefined;
}

/** Returns why a request is refused, or null when it may proceed. */
export function refuseRequest(
  request: RequestInfo,
  port: number
): string | null {
  const allowedHosts = LOCAL_HOSTS.map((host) => `${host}:${port}`);
  if (!request.host || !allowedHosts.includes(request.host)) {
    return 'Requests must use a localhost address.';
  }

  // GET requests can start builds too (`/events`, `?fresh=1`). Other sites
  // cannot read the responses, but a no-cors GET would still run builds, so
  // the API refuses requests a browser marks as coming from another site.
  // Another localhost port counts as same-site.
  if (
    request.path.startsWith('/api/') &&
    (request.fetchSite === 'cross-site' || request.fetchSite === 'same-site')
  ) {
    return 'Other sites cannot use the analysis API.';
  }

  if (request.method === 'GET' || request.method === 'HEAD') return null;

  // Browsers send Origin on every cross-origin POST; curl and agents do not.
  if (request.origin) {
    const allowedOrigins = [port, UI_DEV_PORT].flatMap((allowed) =>
      LOCAL_HOSTS.map((host) => `http://${host}:${allowed}`)
    );
    if (!allowedOrigins.includes(request.origin)) {
      return 'Cross-origin requests cannot start builds or change settings.';
    }
  }
  return null;
}

/**
 * Bodies must be JSON. A cross-origin page can only send JSON after a CORS
 * preflight, which this server never approves.
 */
export function isJson(contentType: string | undefined): boolean {
  return (contentType ?? '').split(';')[0]!.trim() === 'application/json';
}
