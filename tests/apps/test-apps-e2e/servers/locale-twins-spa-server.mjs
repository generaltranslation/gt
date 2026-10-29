/**
 * Test-only production server for a built locale twin SPA.
 *
 *   node locale-twins-spa-server.mjs --app <appDir> --port <port> [--mode static|server-helper]
 *
 * - `static`: plain static hosting. Files from `<appDir>/dist`, unknown paths
 *   fall back to `index.html` (the document the build rewrote with the locale
 *   bootstrap). Documents are `no-cache`; `/assets/*` is immutable, so a
 *   reload after a locale switch takes shared files from the HTTP cache.
 * - `server-helper`: documents come from `gt-react/locale-twins`
 *   (`createLocaleTwinDocument(...).respond(request)`), resolved from the app,
 *   so the locale is chosen per request; assets get
 *   `getLocaleTwinAssetHeaders()`.
 *
 * `vite preview` is not used: it serves files without immutable caching.
 */
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    app: { type: 'string' },
    port: { type: 'string' },
    mode: { type: 'string', default: 'static' },
    dist: { type: 'string', default: 'dist' },
  },
});
if (!values.app || !values.port) {
  throw new Error(
    'Usage: --app <appDir> --port <port> [--mode static|server-helper]'
  );
}
if (values.mode !== 'static' && values.mode !== 'server-helper') {
  throw new Error(`Unknown mode ${values.mode}`);
}

const appDir = path.resolve(values.app);
const clientDir = path.join(appDir, values.dist);
const documentHtml = fs.readFileSync(
  path.join(clientDir, 'index.html'),
  'utf8'
);
const IMMUTABLE = 'public, max-age=31536000, immutable';
/** @type {Record<string, string>} */
const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const helper =
  values.mode === 'server-helper'
    ? createRequire(path.join(appDir, 'package.json'))('gt-react/locale-twins')
    : undefined;
const twinDocument = helper?.createLocaleTwinDocument({ html: documentHtml });
const assetHeaders = helper?.getLocaleTwinAssetHeaders() ?? {
  'Cache-Control': IMMUTABLE,
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const file = resolveFile(url.pathname);
    if (file) {
      const headers = {
        'Content-Type':
          CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream',
        ...(url.pathname.startsWith('/assets/')
          ? assetHeaders
          : { 'Cache-Control': 'no-cache' }),
      };
      response.writeHead(200, headers);
      fs.createReadStream(file).pipe(response);
      return;
    }
    if (path.posix.extname(url.pathname) && url.pathname !== '/index.html') {
      response.writeHead(404, { 'Content-Type': 'text/plain' });
      response.end('Not found');
      return;
    }
    await sendDocument(request, response, url);
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain' });
    response.end(String(error));
  }
});

/**
 * @param {http.IncomingMessage} request
 * @param {http.ServerResponse} response
 * @param {URL} url
 */
async function sendDocument(request, response, url) {
  if (!twinDocument) {
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    response.end(documentHtml);
    return;
  }
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (typeof value === 'string') headers.set(name, value);
    else if (Array.isArray(value)) headers.set(name, value.join(', '));
  }
  const result = twinDocument.respond(new Request(url, { headers }));
  response.writeHead(result.status, Object.fromEntries(result.headers));
  response.end(await result.text());
}

/** A file under the client dir (never index.html, which is the document). */
/** @param {string} pathname */
function resolveFile(pathname) {
  if (pathname === '/' || pathname === '/index.html') return undefined;
  const file = path.join(clientDir, decodeURIComponent(pathname));
  if (!file.startsWith(clientDir + path.sep)) return undefined;
  return fs.statSync(file, { throwIfNoEntry: false })?.isFile()
    ? file
    : undefined;
}

server.listen(Number(values.port), '127.0.0.1', () => {
  process.stdout.write(
    `locale twins ${values.mode} server: http://127.0.0.1:${values.port}\n`
  );
});
