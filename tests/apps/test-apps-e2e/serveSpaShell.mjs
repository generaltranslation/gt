// Serves a TanStack Start SPA build like a static host: existing files as is,
// every other path with the prerendered _shell.html.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';

const root = path.resolve(process.argv[2]);
const port = Number(process.argv[3]);
/** @type {Record<string, string>} */
const contentTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};

createServer(async (request, response) => {
  const pathname = decodeURIComponent(
    new URL(request.url ?? '/', 'http://x').pathname
  );
  const file = path.join(root, path.normalize(pathname));
  const isFile =
    file.startsWith(root + path.sep) &&
    (await stat(file).then(
      (stats) => stats.isFile(),
      () => false
    ));
  const served = isFile ? file : path.join(root, '_shell.html');
  response.setHeader(
    'content-type',
    contentTypes[path.extname(served)] ?? 'application/octet-stream'
  );
  createReadStream(served).pipe(response);
}).listen(port);
