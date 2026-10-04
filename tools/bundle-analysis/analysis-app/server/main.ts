import { spawn } from 'node:child_process';
import { existsSync, readFileSync, watch } from 'node:fs';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { dirname, extname, join, normalize, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBuildManager } from './builder.ts';
import { examples, findExample } from './examples.ts';
import { agentGuide, apiIndex } from './guide.ts';
import { isJson, refuseRequest } from './guard.ts';
import { bundleDetail, diffBundles, summarizeExample } from './report.ts';
import { packagesDir, readWorkspacePackages } from './workspace.ts';
import { gtBytes } from '../shared/summary.ts';
import {
  BUNDLE_KINDS,
  type BuildSettings,
  type BundleKind,
  type ExampleState,
  type ExampleSummary,
} from '../shared/types.ts';

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const uiDir = join(appDir, 'dist');
const args = new Set(process.argv.slice(2));
const preferredPort = Number(process.env.PORT ?? 4600);
let listenPort = preferredPort;
let baseUrl = `http://localhost:${preferredPort}`;

let packages = readWorkspacePackages();
const subscribers = new Map<string, Set<ServerResponse>>();

const manager = createBuildManager({
  examples,
  packages: () => packages,
  cacheDir: join(appDir, '.cache'),
  onState: (state) => broadcast(state),
});

function broadcast(state: ExampleState) {
  const payload = `data: ${JSON.stringify(state)}\n\n`;
  for (const response of subscribers.get(state.example) ?? []) {
    response.write(payload);
  }
}

/** Examples someone is looking at right now. */
function activeExamples() {
  return [...subscribers].filter(([, set]) => set.size > 0).map(([id]) => id);
}

// Rebuild when `pnpm watch` rewrites any package's dist output. Turbo builds
// packages one after another, so wait for a quiet period first.
let pendingPackages = new Set<string>();
let packageTimer: NodeJS.Timeout | undefined;
watch(packagesDir, { recursive: true }, (_event, filename) => {
  if (!filename) return;
  const parts = filename.split(sep);
  if (parts[1] !== 'dist' || parts.includes('node_modules')) return;
  pendingPackages.add(parts[0]!);
  // Mark measurements stale at once, so a `fresh=1` read during the quiet
  // period rebuilds instead of returning the old size. Only the automatic
  // build waits for turbo to finish.
  manager.markOutdated();
  clearTimeout(packageTimer);
  packageTimer = setTimeout(() => {
    const changed = [...pendingPackages].sort();
    pendingPackages = new Set();
    packages = readWorkspacePackages();
    const names = changed
      .map(
        (dir) =>
          packages.find((pkg) => pkg.dir.endsWith(sep + dir))?.name ?? dir
      )
      .join(', ');
    log(`dist changed: ${names}`);
    manager.invalidate(`Rebuilt ${names}`, activeExamples());
  }, 1200);
});

// Rebuild when an example's own source changes.
const IGNORED =
  /(^|\/)(node_modules|\.next|dist|\.output|\.turbo|\.tanstack|\.vinxi)(\/|$)|routeTree\.gen\.ts$|next-env\.d\.ts$|\.png$/;
for (const example of examples) {
  let timer: NodeJS.Timeout | undefined;
  watch(example.dir, { recursive: true }, (_event, filename) => {
    if (!filename || IGNORED.test(filename.split(sep).join('/'))) return;
    manager.markOutdated(example.id);
    clearTimeout(timer);
    timer = setTimeout(() => {
      log(`${example.id} changed: ${filename}`);
      manager.invalidateExample(example.id, `Edited ${filename}`);
    }, 500);
  });
}

function summaries(): ExampleSummary[] {
  return examples.map((example) => {
    const state = manager.getState(example.id);
    const client = state.current?.bundles.client;
    return {
      id: example.id,
      title: example.title,
      pkg: example.pkg,
      framework: example.framework,
      description: example.description,
      bundles: state.bundles,
      hasPreview: existsSync(join(example.dir, 'preview.png')),
      lastClientBytes: client?.totalBytes ?? null,
      lastClientGtBytes: client ? gtBytes(client) : null,
    };
  });
}

/**
 * Resolves the example's state for an API read. `fresh=1` rebuilds first when
 * a source changed (or nothing was built yet) and waits for the result;
 * `wait=1` only waits for a running build.
 */
async function readState(id: string, url: URL): Promise<ExampleState> {
  if (url.searchParams.get('fresh') === '1') manager.ensureFresh(id);
  if (
    url.searchParams.get('fresh') === '1' ||
    url.searchParams.get('wait') === '1'
  ) {
    return manager.whenIdle(id);
  }
  return manager.getState(id);
}

function sendText(
  response: ServerResponse,
  body: string,
  type = 'text/plain; charset=utf-8'
) {
  response.writeHead(200, { 'content-type': type });
  response.end(body);
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'content-type': MIME['.json'] });
  response.end(JSON.stringify(body));
}

function sendFile(response: ServerResponse, path: string) {
  response.writeHead(200, {
    'content-type': MIME[extname(path)] ?? 'application/octet-stream',
    'cache-control': 'no-cache',
  });
  response.end(readFileSync(path));
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  let body = '';
  for await (const chunk of request) body += chunk;
  return body ? JSON.parse(body) : null;
}

async function handle(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const path = url.pathname;

  const refusal = refuseRequest(
    {
      method: request.method ?? 'GET',
      host: request.headers.host,
      origin: request.headers.origin,
      contentType: request.headers['content-type'],
    },
    listenPort
  );
  if (refusal) return sendJson(response, 403, { error: refusal });

  if (path === '/llms.txt') {
    return sendText(
      response,
      agentGuide(baseUrl, summaries()),
      'text/markdown; charset=utf-8'
    );
  }
  if (path === '/api' || path === '/api/') {
    return sendJson(response, 200, apiIndex(baseUrl));
  }
  if (path === '/api/examples') return sendJson(response, 200, summaries());

  const route =
    /^\/api\/examples\/([\w-]+)(?:\/(events|settings|build|diff|bundles)(?:\/(\w+))?)?\/?$/.exec(
      path
    );
  if (route) {
    const example = findExample(route[1]!);
    if (!example) {
      return sendJson(response, 404, {
        error: `Unknown example. Known: ${examples.map((e) => e.id).join(', ')}`,
      });
    }
    const id = example.id;
    const action = route[2];

    if (!action) {
      const state = await readState(id, url);
      return sendJson(
        response,
        200,
        summarizeExample(state, manager.isStale(id))
      );
    }

    if (action === 'events') {
      response.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      const set = subscribers.get(id) ?? new Set();
      subscribers.set(id, set);
      set.add(response);
      response.write(`data: ${JSON.stringify(manager.getState(id))}\n\n`);
      const heartbeat = setInterval(() => response.write(': ping\n\n'), 15_000);
      // The response, not the request, closes when the browser disconnects.
      response.on('close', () => {
        clearInterval(heartbeat);
        set.delete(response);
      });
      manager.ensureFresh(id);
      return;
    }

    if (action === 'bundles' || action === 'diff') {
      const kind = (route[3] ??
        url.searchParams.get('kind') ??
        'client') as BundleKind;
      if (!BUNDLE_KINDS.includes(kind)) {
        return sendJson(response, 400, {
          error: 'kind must be client, server, or edge',
        });
      }
      const state = await readState(id, url);
      const report = state.current?.bundles[kind];
      if (!report) {
        return sendJson(response, 404, {
          error: state.current
            ? `${id} has no ${kind} bundle. It has: ${state.bundles.join(', ')}.`
            : `${id} has not been built. Add ?fresh=1 to build it and wait.`,
        });
      }
      if (action === 'bundles') {
        const limit = Number(url.searchParams.get('limit') ?? 50);
        return sendJson(response, 200, {
          example: id,
          bundle: kind,
          builtAt: state.current!.builtAt,
          ...bundleDetail(report, {
            pkg: url.searchParams.get('package') ?? undefined,
            query: url.searchParams.get('q') ?? undefined,
            limit: Number.isFinite(limit) && limit > 0 ? limit : 50,
          }),
        });
      }
      const previous = state.previous?.bundles[kind];
      if (!previous) {
        return sendJson(response, 200, {
          example: id,
          bundle: kind,
          message: 'Only one build exists, so there is nothing to compare yet.',
          files: [],
        });
      }
      return sendJson(response, 200, {
        example: id,
        bundle: kind,
        from: state.previous!.builtAt,
        to: state.current!.builtAt,
        ...diffBundles(report, previous),
      });
    }

    if (request.method !== 'POST') {
      return sendJson(response, 405, { error: `Use POST for ${action}` });
    }

    if (action === 'build') {
      manager.rebuild(id, 'Requested through the API');
      const state =
        url.searchParams.get('wait') === '1'
          ? await manager.whenIdle(id)
          : manager.getState(id);
      return sendJson(
        response,
        200,
        summarizeExample(state, manager.isStale(id))
      );
    }

    if (!isJson(request.headers['content-type'])) {
      return sendJson(response, 415, {
        error: 'Send the settings as JSON with content-type application/json.',
      });
    }
    const body = (await readBody(request)) as Partial<BuildSettings> | null;
    const current = manager.getState(id).settings;
    const settings = {
      minify: body?.minify ?? current.minify,
      treeShake: body?.treeShake ?? current.treeShake,
    };
    if (
      typeof settings.minify !== 'boolean' ||
      typeof settings.treeShake !== 'boolean'
    ) {
      return sendJson(response, 400, {
        error: 'minify and treeShake must be booleans',
      });
    }
    manager.setSettings(id, settings);
    if (url.searchParams.get('wait') === '1') {
      const state = await manager.whenIdle(id);
      return sendJson(
        response,
        200,
        summarizeExample(state, manager.isStale(id))
      );
    }
    return sendJson(response, 202, manager.getState(id));
  }

  if (path.startsWith('/api/')) {
    return sendJson(response, 404, {
      error: 'Unknown endpoint. GET /api lists them.',
    });
  }

  const preview = /^\/previews\/([\w-]+)\.png$/.exec(path);
  if (preview) {
    const example = findExample(preview[1]!);
    const file = example && join(example.dir, 'preview.png');
    if (file && existsSync(file)) return sendFile(response, file);
    return sendJson(response, 404, { error: 'No preview' });
  }

  if (!existsSync(uiDir)) {
    response.writeHead(503, { 'content-type': 'text/plain' });
    return response.end(
      'The UI is not built. Run pnpm --filter gt-bundle-analysis build.'
    );
  }
  const file = normalize(join(uiDir, path));
  if (
    !relative(uiDir, file).startsWith('..') &&
    existsSync(file) &&
    extname(file)
  ) {
    return sendFile(response, file);
  }
  // Client-side routes all render index.html.
  return sendFile(response, join(uiDir, 'index.html'));
}

function log(message: string) {
  const time = new Date().toLocaleTimeString();
  process.stdout.write(`[${time}] ${message}\n`);
}

function openBrowser(url: string) {
  const command =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'explorer'
        : 'xdg-open';
  const child = spawn(command, [url], { stdio: 'ignore', detached: true });
  // Opening a browser is optional; a missing opener must not stop the server.
  child.on('error', () => {
    log(`Could not open a browser. Open ${url} manually.`);
  });
  child.unref();
}

function listen(port: number) {
  const server = createServer((request, response) => {
    handle(request, response).catch((error) => {
      log(`request failed: ${error instanceof Error ? error.message : error}`);
      if (!response.headersSent)
        sendJson(response, 500, { error: 'Internal error' });
    });
  });
  server.once('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE' && port < preferredPort + 20) {
      listen(port + 1);
    } else {
      throw error;
    }
  });
  server.listen(port, '127.0.0.1', () => {
    const url = `http://localhost:${port}`;
    listenPort = port;
    baseUrl = url;
    log(`Bundle analysis running at ${url}`);
    log(`Agents: ${url}/llms.txt`);
    log('Watching packages/*/dist and the example apps for changes.');
    if (!args.has('--no-open')) openBrowser(url);
  });
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    manager.stopAll();
    process.exit(0);
  });
}

listen(preferredPort);
