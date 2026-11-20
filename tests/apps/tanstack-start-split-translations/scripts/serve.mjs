// Serves a production build of the app: the files of <build>/client, and
// everything else through the fetch handler of <build>/server/server.js.
//
// Each build is served by a process of its own, as a deployed one is: GT
// keeps its server state for the life of a process. Run as a script, this
// file is that process: node scripts/serve.mjs '<options as JSON>'.
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TYPES = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
};

function readFiles(directory, prefix, files = new Map()) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory())
      readFiles(path, `${prefix}${name}/`, files);
    else files.set(`${prefix}${name}`, readFileSync(path));
  }
  return files;
}

/**
 * Starts a server for the build in `directory`, and resolves to its origin.
 * `deploy()` replaces it with the server of another build at the same
 * origin, as a host that keeps no file of the build before does.
 *
 * - `base` is Vite's, when not `/`.
 * - `pages` says what answers a request for a page: `'server'` the build's
 *   server, `'prerendered'` the page's prerendered HTML when the build wrote
 *   one, and `'shell'` the prerendered shell of an app built with `spa`, as
 *   a static host that rewrites every path to it.
 * - `assets: 'only'` serves the build's files alone, to pages of any origin,
 *   as a CDN. `assets: false` serves none of them.
 * - `env` is what the build's server reads from its environment.
 */
export async function serve(directory, options = {}) {
  let child;
  let port = 0;
  const start = (build) =>
    new Promise((resolve, reject) => {
      child = spawn(
        process.execPath,
        [
          fileURLToPath(import.meta.url),
          JSON.stringify({ ...options, directory: build, port }),
        ],
        {
          env: { ...process.env, ...options.env },
          stdio: ['ignore', 'pipe', 'inherit'],
        }
      );
      child.once('exit', () => reject(new Error(`No server for ${build}`)));
      child.stdout.once('data', (line) => {
        port = Number(line);
        resolve();
      });
    });
  const stop = () =>
    new Promise((resolve) => {
      child.removeAllListeners('exit');
      child.once('exit', resolve);
      child.kill();
    });
  await start(directory);
  return {
    origin: `http://127.0.0.1:${port}`,
    deploy: async (build) => {
      await stop();
      await start(build);
    },
    close: stop,
  };
}

async function run({
  directory,
  port,
  base = '/',
  pages = 'server',
  assets = true,
}) {
  const files = assets ? readFiles(join(directory, 'client'), base) : new Map();
  // No query on the URL: server chunks import ../server.js back, and would
  // then load a second copy of it
  const handler =
    assets === 'only'
      ? undefined
      : (
          await import(
            pathToFileURL(join(directory, 'server', 'server.js')).href
          )
        ).default;
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const page =
      pages === 'shell'
        ? `${base}_shell.html`
        : `${url.pathname.replace(/\/$/, '')}/index.html`;
    const name = files.has(url.pathname)
      ? url.pathname
      : handler && pages !== 'server' && files.has(page)
        ? page
        : undefined;
    if (name !== undefined || !handler) {
      response.writeHead(name === undefined ? 404 : 200, {
        'content-type': TYPES[extname(name ?? '')] ?? 'text/plain',
        ...(assets === 'only' && { 'access-control-allow-origin': '*' }),
      });
      response.end(files.get(name));
      return;
    }
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (typeof value === 'string') headers.set(key, value);
    }
    const answer = await handler.fetch(
      new Request(url, { method: request.method, headers })
    );
    const sent = {};
    answer.headers.forEach((value, key) => {
      if (key !== 'set-cookie') sent[key] = value;
    });
    const cookies = answer.headers.getSetCookie();
    if (cookies.length) sent['set-cookie'] = cookies;
    response.writeHead(answer.status, sent);
    response.end(Buffer.from(await answer.arrayBuffer()));
  });
  server.listen(port, '127.0.0.1', () =>
    process.stdout.write(`${server.address().port}\n`)
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await run(JSON.parse(process.argv[2]));
}
