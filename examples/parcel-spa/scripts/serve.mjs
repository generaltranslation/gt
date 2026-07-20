// Minimal dependency-free static server for previewing the production build in
// ./dist. Run `pnpm run build` first, or use `pnpm run preview` which does both.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const distDir = join(
  fileURLToPath(new URL('.', import.meta.url)),
  '..',
  'dist'
);
const port = Number(process.env.PORT) || 4321;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
};

async function resolveFile(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split('?')[0])).replace(
    /^(\.\.[/\\])+/,
    ''
  );
  let candidate = join(distDir, clean);
  try {
    const info = await stat(candidate);
    if (info.isDirectory()) candidate = join(candidate, 'index.html');
    await stat(candidate);
    return candidate;
  } catch {
    // A request for a path with a file extension (e.g. /main.js,
    // /favicon.ico) that does not exist is a genuine 404, not a client route.
    // Only extension-less paths fall back to index.html, which is how a SPA
    // serves its client-side routes.
    if (extname(clean)) return null;
    return join(distDir, 'index.html');
  }
}

const server = createServer(async (req, res) => {
  try {
    const file = await resolveFile(req.url || '/');
    if (!file) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] || 'application/octet-stream',
    });
    res.end(body);
  } catch {
    res.writeHead(500);
    res.end('Build not found. Run `pnpm run build` first.');
  }
});

server.listen(port, () => {
  console.log(`Serving ./dist at http://localhost:${port}`);
});
