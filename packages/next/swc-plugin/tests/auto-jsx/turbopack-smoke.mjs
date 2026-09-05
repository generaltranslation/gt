/**
 * Credential-free Next.js integration smoke test using already installed apps.
 * Run after `pnpm --filter gt-next build`:
 *   node packages/next/swc-plugin/tests/auto-jsx/turbopack-smoke.mjs
 * Add --serve to retain an enabled dev server for manual browser checks.
 * Generated app, HTTP evidence, and logs live in an isolated temporary folder.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import {
  appendFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createFixtureError } from './diagnostics.mjs';
import { readHtmlEvidence } from './html-evidence.mjs';

const pluginDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);
const repository = path.resolve(pluginDirectory, '../../..');
const sourceApp = path.join(repository, 'tests/apps/next-app-router');
const appRequire = createRequire(path.join(sourceApp, 'package.json'));
const nextBin = appRequire.resolve('next/dist/bin/next');
const nextVersion = appRequire('next/package.json').version;
const localGt = await realpath(appRequire.resolve('gt-next/config'));
assert.ok(localGt.startsWith(path.join(repository, 'packages/next/dist/')));
const wasm = path.join(repository, 'packages/next/dist/gt_swc_plugin.wasm');
const wasmSha256 = createHash('sha256')
  .update(await readFile(wasm))
  .digest('hex');
const nextRoot = path.dirname(
  await realpath(appRequire.resolve('next/package.json'))
);
const app = await mkdtemp(path.join(tmpdir(), 'gt-auto-jsx-smoke-'));
const parentParts = repository.split(path.sep);
while (
  [nextRoot, app].some(
    (directory) =>
      !directory.startsWith(`${parentParts.join(path.sep)}${path.sep}`)
  )
) {
  parentParts.pop();
}
const turbopackRoot = parentParts.join(path.sep) || path.parse(repository).root;

const nodeModules = path.join(app, 'node_modules');
await mkdir(nodeModules);
const linked = new Set();
// Next can externalize its runtime through an app-relative path. Include its
// installed direct dependencies for pnpm's non-hoisted global virtual store.
for (const source of [
  path.join(sourceApp, 'node_modules'),
  path.dirname(nextRoot),
]) {
  for (const name of await readdir(source)) {
    if (name.startsWith('.') || linked.has(name)) continue;
    await symlink(
      await realpath(path.join(source, name)),
      path.join(nodeModules, name)
    );
    linked.add(name);
  }
}

const files = {
  'package.json': JSON.stringify({
    name: 'gt-auto-jsx-smoke',
    private: true,
    dependencies: {
      next: nextVersion,
      react: appRequire('react/package.json').version,
      'react-dom': appRequire('react-dom/package.json').version,
      'gt-next': 'workspace:*',
    },
  }),
  'next.config.js': `const { withGTConfig } = require('gt-next/config');
module.exports = withGTConfig({
  turbopack: { root: ${JSON.stringify(turbopackRoot)} },
  distDir: process.env.GT_SMOKE_DIST,
}, {
  defaultLocale: 'en',
  locales: ['en'],
  getLocalePath: './getLocale.js',
  runtimeUrl: null,
  cacheUrl: null,
  _tagIds: true,
  experimentalCompilerOptions: {
    type: 'swc',
    enableAutoJsxInjection: process.env.GT_SMOKE_AUTO === 'true',
  },
});`,
  'getLocale.js': `export async function getLocale() { return 'en'; }`,
  'app/layout.jsx': `import { GTProvider } from 'gt-next';
export default function Layout({ children }) {
  return <html lang="en"><head><link rel="icon" href="data:," /></head><body><GTProvider>{children}</GTProvider></body></html>;
}`,
  'app/page.jsx': `export default function Page() {
  const user = 'Ada';
  return <main>
    <h1>Server auto greeting {user}</h1>
    <p>Server text <strong>Nested copy</strong> after</p>
    <div>{true ? <span>Server conditional content</span> : null}</div>
  </main>;
}`,
  'app/client/page.jsx': `'use client';
import { useState } from 'react';
export default function Page() {
  const [count, setCount] = useState(2);
  return <main>
    <h1>Client auto greeting {count}</h1>
    <button onClick={() => setCount(count + 1)}>Increment {count}</button>
    <p>{count % 2 ? <strong>Odd item count</strong> : <em>Even item count</em>}</p>
  </main>;
}`,
  'app/opaque/page.jsx': `import { Branch, Plural } from 'gt-next';
export default function Page() {
  const name = 'Ada';
  const count = 2;
  return <main>
    <h1>Server opaque components</h1>
    <div><Branch branch="welcome" welcome={<span>Welcome {name}</span>}>Fallback</Branch></div>
    <div><Plural n={count} one="One opaque item" other={<span>Several opaque items {count}</span>}>Fallback</Plural></div>
  </main>;
}`,
  'app/client-opaque/page.jsx': `'use client';
import { useState } from 'react';
import { Branch, Plural } from 'gt-next';
export default function Page() {
  const [count, setCount] = useState(2);
  return <main>
    <h1>Client opaque components</h1>
    <button onClick={() => setCount(count + 1)}>Add item {count}</button>
    <div><Branch branch={count % 2 ? 'odd' : 'even'} odd={<span>Odd branch {count}</span>} even={<span>Even branch {count}</span>} /></div>
    <div><Plural n={count} one="One client item" other={<span>Several client items {count}</span>} /></div>
  </main>;
}`,
  'app/manual/page.jsx': `import { T, Var } from 'gt-next';
export default function Page() {
  const name = 'Ada';
  return <main><T id="manual-greeting">Manual greeting <Var>{name}</Var></T></main>;
}`,
};

for (const [filename, content] of Object.entries(files)) {
  await mkdir(path.dirname(path.join(app, filename)), { recursive: true });
  await writeFile(path.join(app, filename), `${content}\n`);
}

const baseEnv = { ...process.env };
for (const key of Object.keys(baseEnv)) {
  if (key.startsWith('GT_') || key.startsWith('NEXT_PUBLIC_GT_'))
    delete baseEnv[key];
}
baseEnv.NEXT_TELEMETRY_DISABLED = '1';
baseEnv.TURBOPACK = '1';

async function availablePort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function startNext(args, mode, enabled, logfile) {
  const child = spawn(process.execPath, [nextBin, ...args], {
    cwd: app,
    env: {
      ...baseEnv,
      NODE_ENV: mode === 'dev' ? 'development' : 'production',
      GT_SMOKE_DIST: `.next-${mode}-${enabled}`,
      GT_SMOKE_AUTO: String(enabled),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const pending = [];
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', (chunk) => pending.push(appendFile(logfile, chunk)));
  }
  child.on('close', () => Promise.all(pending));
  return child;
}

async function stop(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([once(child, 'exit'), delay(5000)]);
  if (child.exitCode === null && child.signalCode === null)
    child.kill('SIGKILL');
}

async function requestWhenReady(child, url, logfile) {
  for (let attempt = 0; attempt < 180; attempt++) {
    if (child.exitCode !== null || child.signalCode !== null)
      throw createFixtureError({
        whatHappened: 'The Next.js smoke server exited before it was ready',
        details: await readFile(logfile, 'utf8'),
      });
    let response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(1000) });
    } catch {
      /* Compilation and startup can precede readiness. */
      await delay(500);
      continue;
    }
    if (response.ok) return;
    if (response.status >= 500) {
      await writeFile(
        path.join(app, 'startup-error.html'),
        await response.text()
      );
      throw createFixtureError({
        whatHappened: 'Next.js failed to render a smoke-test page',
        details: await readFile(logfile, 'utf8'),
      });
    }
    await delay(500);
  }
  throw createFixtureError({
    whatHappened: 'The Next.js smoke server did not become ready in time',
    details: await readFile(logfile, 'utf8'),
  });
}

const routes = {
  '/': ['Server auto greeting Ada', 'Server conditional content'],
  '/client': ['Client auto greeting 2', 'Increment 2', 'Even item count'],
  '/opaque': [
    'Server opaque components',
    'Welcome Ada',
    'Several opaque items 2',
  ],
  '/client-opaque': [
    'Client opaque components',
    'Even branch 2',
    'Several client items 2',
  ],
  '/manual': ['Manual greeting Ada'],
};
const report = { app, nextVersion, localGt, wasmSha256, checks: [] };
process.stdout.write(
  `${JSON.stringify({ app, nextVersion, localGt, wasmSha256 })}\n`
);

for (const enabled of process.argv.includes('--serve')
  ? [true]
  : [true, false]) {
  for (const mode of process.argv.includes('--serve')
    ? ['dev']
    : ['dev', 'production']) {
    if (mode === 'production') {
      const logfile = path.join(app, `build-${enabled}.log`);
      const build = startNext(['build', '--turbopack'], mode, enabled, logfile);
      const [code] = await once(build, 'exit');
      assert.equal(
        code,
        0,
        `Production build failed: ${await readFile(logfile, 'utf8')}`
      );
    }
    const port = await availablePort();
    const url = `http://127.0.0.1:${port}`;
    const logfile = path.join(app, `${mode}-${enabled}.log`);
    const server = startNext(
      [
        mode === 'dev' ? 'dev' : 'start',
        '--hostname',
        '127.0.0.1',
        '--port',
        String(port),
      ],
      mode,
      enabled,
      logfile
    );
    try {
      await requestWhenReady(server, url, logfile);
      for (const [route, expected] of Object.entries(routes)) {
        const response = await fetch(`${url}${route}`);
        const html = await response.text();
        await writeFile(
          path.join(
            app,
            `${mode}-${enabled}-${route.replaceAll('/', '') || 'root'}.html`
          ),
          html
        );
        assert.equal(
          response.status,
          200,
          `${mode}/${enabled}${route}: HTTP ${response.status}`
        );
        const { text: visible, hashes } = readHtmlEvidence(html);
        for (const text of expected)
          assert.ok(
            visible.includes(text),
            `${mode}/${enabled}${route}: missing ${text}; saw ${visible}`
          );
        if (enabled || route === '/manual')
          assert.ok(
            hashes.length > 0,
            `${mode}/${enabled}${route}: no GT hash markers`
          );
        if (!enabled && route !== '/manual') assert.equal(hashes.length, 0);
        const previous = report.checks.find(
          (check) =>
            check.route === route &&
            (enabled ? check.enabled : route === '/manual')
        );
        if (previous && (enabled || route === '/manual'))
          assert.deepEqual(
            hashes,
            previous.hashes,
            `${route}: hashes must agree across build modes`
          );
        report.checks.push({
          mode,
          enabled,
          route,
          status: response.status,
          hashes,
        });
      }
      await writeFile(
        path.join(app, 'report.json'),
        JSON.stringify(report, null, 2)
      );
      process.stdout.write(
        `${mode} auto=${enabled}: ${Object.keys(routes).length} routes passed at ${url}\n`
      );
      if (process.argv.includes('--serve')) {
        process.stdout.write(`Manual browser URL: ${url}\n`);
        await once(server, 'exit');
      }
    } finally {
      await stop(server);
    }
  }
}
process.stdout.write(`Smoke report: ${path.join(app, 'report.json')}\n`);
