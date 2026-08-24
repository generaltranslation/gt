// Static server for the e2e: maps the harness, the built dist, the @rrweb
// browser builds, and the fixture under one origin.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const E2E_DIR = dirname(fileURLToPath(import.meta.url));
const PKG_DIR = join(E2E_DIR, '..');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

// URL prefix → filesystem root. Everything else 404s.
const ROUTES = [
  ['/dist/', join(PKG_DIR, 'dist')],
  ['/rrweb-replay/', join(PKG_DIR, 'node_modules/@rrweb/replay/dist')],
  ['/rrweb-record/', join(PKG_DIR, 'node_modules/@rrweb/record/dist')],
  ['/', E2E_DIR],
];

export function startServer(port) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://x');
      let p = decodeURIComponent(url.pathname);
      if (p === '/') p = '/harness/index.html';
      const route = ROUTES.find(([prefix]) => p.startsWith(prefix));
      if (!route) throw new Error('no route');
      const rel = normalize(p.slice(route[0].length)).replace(
        /^(\.\.[/\\])+/,
        ''
      );
      const body = await readFile(join(route[1], rel));
      res.writeHead(200, {
        'content-type': TYPES[extname(rel)] || 'application/octet-stream',
      });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  return new Promise((resolvePromise) => {
    server.listen(port, () => resolvePromise(server));
  });
}
