/**
 * Test-only production server for a built locale twin TanStack Start app.
 *
 *   node locale-twins-tanstack-server.mjs --app <appDir> --port <port> [--mismatch-control]
 *
 * Static files come from `<appDir>/dist/client` (`/assets/*` immutable, so a
 * reload after a locale switch takes shared files from the HTTP cache). Every
 * other request goes to the app's server entry (`dist/server/server.js`,
 * `export default { fetch }`), which renders the document for the request
 * locale and points its scripts at that locale's twins.
 *
 * `--mismatch-control` sets `GT_TWINS_TEST_MISMATCH=1` for the app's
 * test-only hydration mismatch control (see the app's `src/server.ts`).
 *
 * `vite preview` is not used: it serves assets without immutable caching.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    app: { type: 'string' },
    port: { type: 'string' },
    'mismatch-control': { type: 'boolean', default: false },
  },
});
if (!values.app || !values.port) {
  throw new Error('Usage: --app <appDir> --port <port> [--mismatch-control]');
}
// Read by the server entry when it loads, so set it before the import.
if (values['mismatch-control']) process.env.GT_TWINS_TEST_MISMATCH = '1';

const appDir = path.resolve(values.app);
const clientDir = path.join(appDir, 'dist/client');
const { default: serverEntry } = await import(
  pathToFileURL(path.join(appDir, 'dist/server/server.js')).href
);
const IMMUTABLE = 'public, max-age=31536000, immutable';
/** @type {Record<string, string>} */
const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(
      request.url ?? '/',
      `http://${request.headers.host ?? '127.0.0.1'}`
    );
    const file = resolveFile(url.pathname);
    if (file) {
      response.writeHead(200, {
        'Content-Type':
          CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream',
        'Cache-Control': url.pathname.startsWith('/assets/')
          ? IMMUTABLE
          : 'no-cache',
      });
      fs.createReadStream(file).pipe(response);
      return;
    }
    await sendFetchResponse(
      response,
      await serverEntry.fetch(toRequest(request, url))
    );
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain' });
    response.end(String(error));
  }
});

/**
 * @param {http.IncomingMessage} request
 * @param {URL} url
 */
function toRequest(request, url) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (typeof value === 'string') headers.set(name, value);
    else if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    }
  }
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  return new Request(url, {
    method: request.method,
    headers,
    body: hasBody ? /** @type {any} */ (Readable.toWeb(request)) : undefined,
    // @ts-expect-error Node's fetch needs `duplex` for a streamed body.
    duplex: hasBody ? 'half' : undefined,
  });
}

/**
 * @param {http.ServerResponse} response
 * @param {Response} result
 */
async function sendFetchResponse(response, result) {
  /** @type {Record<string, string | string[]>} */
  const headers = {};
  for (const [name, value] of result.headers) {
    if (name !== 'set-cookie') headers[name] = value;
  }
  const cookies = result.headers.getSetCookie();
  if (cookies.length > 0) headers['set-cookie'] = cookies;
  response.writeHead(result.status, headers);
  if (!result.body) {
    response.end();
    return;
  }
  Readable.fromWeb(/** @type {any} */ (result.body)).pipe(response);
}

/** A file under the client dir. */
/** @param {string} pathname */
function resolveFile(pathname) {
  if (pathname === '/') return undefined;
  const file = path.join(clientDir, decodeURIComponent(pathname));
  if (!file.startsWith(clientDir + path.sep)) return undefined;
  return fs.statSync(file, { throwIfNoEntry: false })?.isFile()
    ? file
    : undefined;
}

server.listen(Number(values.port), '127.0.0.1', () => {
  process.stdout.write(
    `locale twins TanStack Start server: http://127.0.0.1:${values.port}\n`
  );
});
