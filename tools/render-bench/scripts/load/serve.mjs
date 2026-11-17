// Serves a built app as a static host does: precompressed with brotli, over
// HTTP/2, hashed assets cached forever and the HTML revalidated.
import { execFileSync } from 'node:child_process';
import { X509Certificate, createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createSecureServer } from 'node:http2';
import { tmpdir } from 'node:os';
import { extname, join, relative, sep } from 'node:path';
import { promisify } from 'node:util';
import { brotliCompress, constants, gzipSync } from 'node:zlib';

const compress = promisify(brotliCompress);

export const GZIP_LEVEL = 6;
const NOTHING = { bytes: 0, rawBytes: 0, gzipBytes: 0 };

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * A certificate for localhost that lives as long as a run. Browsers offer
 * brotli and HTTP/2 only over TLS; Chromium trusts the certificate by the
 * hash of its key (`spki`), and keeps its HTTP cache only for a certificate
 * it trusts.
 */
function createCertificate() {
  const directory = mkdtempSync(join(tmpdir(), 'gt-load-bench-'));
  const key = join(directory, 'key.pem');
  const certificate = join(directory, 'cert.pem');
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      key,
      '-out',
      certificate,
      '-days',
      '2',
      '-subj',
      '/CN=localhost',
      '-addext',
      'subjectAltName=DNS:localhost,IP:127.0.0.1',
    ],
    { stdio: 'ignore' }
  );
  const cert = readFileSync(certificate);
  const spki = createHash('sha256')
    .update(
      new X509Certificate(cert).publicKey.export({
        type: 'spki',
        format: 'der',
      })
    )
    .digest('base64');
  const created = { key: readFileSync(key), cert, spki };
  rmSync(directory, { recursive: true });
  return created;
}

/**
 * Serves `directory`. Every file is compressed before the server listens, so
 * no request waits for it. A path without an extension gets `index.html`, as
 * a single-page app's host is set up to do.
 * @param options.protocol `h2`, or `http1` for HTTP/1.1 over TLS.
 * @param options.quality The brotli quality, 0 to 11.
 * @param options.immutable The paths a browser may cache without asking again.
 */
export async function serve(
  directory,
  { protocol = 'h2', quality = 11, immutable = /^\/assets\// } = {}
) {
  const files = new Map();
  const entries = readdirSync(directory, {
    recursive: true,
    withFileTypes: true,
  }).filter((entry) => entry.isFile());
  await Promise.all(
    entries.map(async (entry) => {
      const file = join(entry.parentPath, entry.name);
      const raw = readFileSync(file);
      const type = TYPES[extname(file)];
      const body = type
        ? await compress(raw, {
            params: {
              [constants.BROTLI_PARAM_QUALITY]: quality,
              [constants.BROTLI_PARAM_SIZE_HINT]: raw.length,
            },
          })
        : raw;
      files.set(`/${relative(directory, file).split(sep).join('/')}`, {
        body,
        rawBytes: raw.length,
        // Not served: the size other tools report, gzip at its default level.
        gzipBytes: type
          ? gzipSync(raw, { level: GZIP_LEVEL }).length
          : raw.length,
        compressed: Boolean(type),
        type: type ?? 'application/octet-stream',
        etag: `"${createHash('sha1').update(raw).digest('hex')}"`,
      });
    })
  );

  /** Every response sent, in order: what a page transferred. */
  const log = [];
  const { key, cert, spki } = createCertificate();
  const server = createSecureServer(
    {
      key,
      cert,
      allowHTTP1: true,
      ALPNProtocols: protocol === 'h2' ? ['h2'] : ['http/1.1'],
    },
    (request, response) => {
      const requested = decodeURIComponent(
        new URL(request.url, 'https://localhost').pathname
      );
      const path =
        files.has(requested) || extname(requested) ? requested : '/index.html';
      const file = files.get(path);
      if (!file) {
        log.push({ path: requested, status: 404, ...NOTHING });
        response.writeHead(404).end();
        return;
      }
      const headers = {
        etag: file.etag,
        'cache-control': immutable.test(path)
          ? 'public, max-age=31536000, immutable'
          : 'no-cache',
      };
      if (request.headers['if-none-match'] === file.etag) {
        log.push({ path, status: 304, ...NOTHING });
        response.writeHead(304, headers).end();
        return;
      }
      log.push({
        path,
        status: 200,
        bytes: file.body.length,
        rawBytes: file.rawBytes,
        gzipBytes: file.gzipBytes,
      });
      response
        .writeHead(200, {
          ...headers,
          'content-type': file.type,
          'content-length': file.body.length,
          ...(file.compressed ? { 'content-encoding': 'br' } : {}),
        })
        .end(file.body);
    }
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    origin: `https://127.0.0.1:${server.address().port}`,
    spki,
    log,
    files,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
