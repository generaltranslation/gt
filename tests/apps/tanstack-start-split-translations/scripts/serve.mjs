// Serves a production build of the app: the files of <build>/client, and
// everything else through the fetch handler of <build>/server/server.js.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

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
 * Starts a server for the build in `directory`. `deploy()` replaces its files
 * and its server with those of another build, as a host that keeps no file
 * of the build before does. `base` is Vite's, when not `/`.
 *
 * `pages` says what answers a request for a page: `'server'` the build's
 * server, `'prerendered'` the page's prerendered HTML when the build wrote
 * one, and `'shell'` the prerendered shell of an app built with `spa`, as a
 * static host that rewrites every path to it.
 */
export async function serve(directory, { base = '/', pages = 'server' } = {}) {
  let files;
  let handler;
  const deploy = async (build) => {
    files = readFiles(join(build, 'client'), base);
    // Each build is its own directory, so Node loads each one's server. No
    // query on the URL: server chunks import ../server.js back, and would
    // then load a second copy of it.
    handler = (
      await import(pathToFileURL(join(build, 'server', 'server.js')).href)
    ).default;
  };
  await deploy(directory);
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const page =
      pages === 'shell'
        ? `${base}_shell.html`
        : `${url.pathname.replace(/\/$/, '')}/index.html`;
    const name = files.has(url.pathname)
      ? url.pathname
      : pages !== 'server' && files.has(page)
        ? page
        : undefined;
    if (name !== undefined) {
      response.writeHead(200, {
        'content-type': TYPES[extname(name)] ?? 'text/plain',
      });
      response.end(files.get(name));
      return;
    }
    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) {
      if (typeof value === 'string') headers.set(name, value);
    }
    const answer = await handler.fetch(
      new Request(url, { method: request.method, headers })
    );
    const sent = {};
    answer.headers.forEach((value, name) => {
      if (name !== 'set-cookie') sent[name] = value;
    });
    const cookies = answer.headers.getSetCookie();
    if (cookies.length) sent['set-cookie'] = cookies;
    response.writeHead(answer.status, sent);
    response.end(Buffer.from(await answer.arrayBuffer()));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    deploy,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
