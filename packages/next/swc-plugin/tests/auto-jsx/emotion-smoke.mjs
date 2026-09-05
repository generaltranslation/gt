/**
 * Exercise real Next.js graph and loader options with the built gt-next package.
 * Run after `pnpm --filter gt-next build`:
 *   node packages/next/swc-plugin/tests/auto-jsx/emotion-smoke.mjs [profile-filter]
 * Uses local packages and a tiny Emotion runtime proxy; no translation services.
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
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { parse } from 'parse5';
import { createFixtureError } from './diagnostics.mjs';

const repository = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../..'
);
const sourceApp = path.join(repository, 'tests/apps/next-app-router');
const appRequire = createRequire(path.join(sourceApp, 'package.json'));
const nextBin = appRequire.resolve('next/dist/bin/next');
const nextVersion = appRequire('next/package.json').version;
const nextRoot = path.dirname(
  await realpath(appRequire.resolve('next/package.json'))
);
const gtConfig = await realpath(appRequire.resolve('gt-next/config'));
assert.ok(gtConfig.startsWith(path.join(repository, 'packages/next/dist/')));
const wasm = path.join(repository, 'packages/next/dist/gt_swc_plugin.wasm');
const wasmSha256 = createHash('sha256')
  .update(await readFile(wasm))
  .digest('hex');
const app = await mkdtemp(path.join(tmpdir(), 'gt-auto-jsx-emotion-'));
const rootParts = repository.split(path.sep);
while (
  [nextRoot, app].some(
    (directory) =>
      !directory.startsWith(`${rootParts.join(path.sep)}${path.sep}`)
  )
)
  rootParts.pop();
const turbopackRoot = rootParts.join(path.sep) || path.parse(repository).root;
await mkdir(path.join(app, 'node_modules'));
const linked = new Set();
for (const source of [
  path.join(sourceApp, 'node_modules'),
  path.dirname(nextRoot),
]) {
  for (const name of await readdir(source)) {
    if (name.startsWith('.') || linked.has(name)) continue;
    await symlink(
      await realpath(path.join(source, name)),
      path.join(app, 'node_modules', name)
    );
    linked.add(name);
  }
}
// Only this package is synthetic. If an installed @emotion scope exists, retain
// its other packages without writing through that scope's symlink.
if (linked.has('@emotion')) {
  const existingScope = await realpath(path.join(app, 'node_modules/@emotion'));
  await rm(path.join(app, 'node_modules/@emotion'));
  await mkdir(path.join(app, 'node_modules/@emotion'));
  for (const name of await readdir(existingScope)) {
    if (name !== 'react')
      await symlink(
        path.join(existingScope, name),
        path.join(app, 'node_modules/@emotion', name)
      );
  }
}
const firstLoader = path.join(app, 'first.cjs');
const secondLoader = path.join(app, 'second.cjs');
const generateLoader = path.join(app, 'generate.cjs');
const pattern = '*.{js,jsx,ts,tsx,mjs,cjs,mts,cts,md,mdx}';
const files = {
  'package.json': JSON.stringify({
    name: 'gt-auto-jsx-emotion',
    private: true,
  }),
  'next.config.js': `const { withGTConfig } = require('gt-next/config');
module.exports = withGTConfig({
  compiler: { emotion: true },
  distDir: process.env.GT_EMOTION_DIST,
  turbopack: { root: ${JSON.stringify(turbopackRoot)}, rules: {
    ${JSON.stringify(pattern)}: { loaders: [${JSON.stringify(firstLoader)}] },
    '*.jsx': { loaders: [${JSON.stringify(secondLoader)}] },
    '*.raw': { loaders: [${JSON.stringify(generateLoader)}], as: '*.jsx' },
  } },
  webpack(config, { defaultLoaders }) {
    config.module.rules.push({ test: /\\.jsx$/, use: [${JSON.stringify(secondLoader)}, ${JSON.stringify(firstLoader)}] });
    config.module.rules.push({ test: /\\.raw$/, use: [defaultLoaders.babel, ${JSON.stringify(generateLoader)}] });
    return config;
  },
}, {
  defaultLocale: 'en', locales: ['en'], getLocalePath: './getLocale.js',
  runtimeUrl: null, cacheUrl: null, _tagIds: true,
  experimentalCompilerOptions: { type: 'swc', enableAutoJsxInjection: process.env.GT_EMOTION_AUTO === 'true' },
});`,
  'getLocale.js': `export async function getLocale() { return 'en'; }`,
  'first.cjs': `module.exports = (source) => source.replaceAll('FIRST shared', 'SECOND shared');`,
  'second.cjs': `module.exports = (source) => source.replaceAll('SECOND shared', 'FINAL shared');`,
  'generate.cjs': `module.exports = () => ${JSON.stringify('export function Generated({ scope }) { return <p data-case={"generated-" + scope}>Generated JSX {scope}</p>; }')};`,
  'generated.raw': 'This is source input for a custom loader, not JavaScript.',
  'app/layout.jsx': `import { GTProvider } from 'gt-next';
export default function Layout({ children }) { return <html><body><GTProvider>{children}</GTProvider></body></html>; }`,
  'app/page.jsx': `import { Shared } from './shared';
import { ReactShared } from './react-shared';
import { CustomShared } from './custom-shared';
import { Generated } from '../generated.raw';
import Client from './client';
import { T } from 'gt-next';
export default function Page() {
  return <main><Shared scope="rsc" /><ReactShared scope="rsc" /><CustomShared scope="rsc" /><Generated scope="rsc" /><Client /><p data-case="manual"><T id="manual-emotion">Manual text</T></p></main>;
}`,
  'app/client.jsx': `'use client';
import { Shared } from './shared';
import { ReactShared } from './react-shared';
import { CustomShared } from './custom-shared';
import { Generated } from '../generated.raw';
export default function Client() { return <><Shared scope="ssr" /><ReactShared scope="ssr" /><CustomShared scope="ssr" /><Generated scope="ssr" /></>; }`,
  'app/shared.jsx': `export function Shared({ scope }) { return <p data-case={'shared-' + scope}>FIRST shared {scope}</p>; }`,
  'app/react-shared.jsx': `/** @jsxImportSource react */
export function ReactShared({ scope }) { return <p data-case={'react-' + scope}>React pragma {scope}</p>; }`,
  'app/custom-shared.jsx': `/** @jsxImportSource @emotion/react */
export function CustomShared({ scope }) { return <p data-case={'custom-' + scope}>Custom pragma {scope}</p>; }`,
  'node_modules/@emotion/react/package.json': JSON.stringify({
    name: '@emotion/react',
    exports: {
      './jsx-runtime': './jsx-runtime.js',
      './jsx-dev-runtime': './jsx-dev-runtime.js',
    },
  }),
};
for (const [file, names] of [
  ['jsx-runtime', ['jsx', 'jsxs']],
  ['jsx-dev-runtime', ['jsxDEV']],
]) {
  files[`node_modules/@emotion/react/${file}.js`] =
    `const r = require('react/${file}'); exports.Fragment = r.Fragment;` +
    names
      .map(
        (name) =>
          `exports.${name} = (type, props, ...args) => r.${name}(type, typeof type === 'string' ? { ...props, 'data-emotion-runtime': 'yes' } : props, ...args);`
      )
      .join('\n');
}
for (const [filename, source] of Object.entries(files)) {
  const destination = path.join(app, filename);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, `${source}\n`);
}

const profiles = ['turbopack', 'webpack']
  .flatMap((bundler) => [
    { name: `${bundler}-dev-enabled`, bundler, mode: 'dev', enabled: true },
    { name: `${bundler}-dev-disabled`, bundler, mode: 'dev', enabled: false },
    {
      name: `${bundler}-production`,
      bundler,
      mode: 'production',
      enabled: true,
    },
  ])
  .filter(
    (profile) => !process.argv[2] || profile.name.includes(process.argv[2])
  );
assert.ok(profiles.length, 'No smoke profiles matched');
const baseEnv = { ...process.env, NEXT_TELEMETRY_DISABLED: '1' };
for (const key of Object.keys(baseEnv)) {
  if (key.startsWith('GT_') || key.startsWith('NEXT_PUBLIC_GT_'))
    delete baseEnv[key];
}
const pendingLogs = [];
function start(args, profile, logName) {
  const env = {
    ...baseEnv,
    NODE_ENV: profile.mode === 'dev' ? 'development' : 'production',
    GT_EMOTION_AUTO: String(profile.enabled),
    GT_EMOTION_DIST: `.next-${profile.name}`,
  };
  if (profile.bundler === 'turbopack') env.TURBOPACK = '1';
  else delete env.TURBOPACK;
  const child = spawn(process.execPath, [nextBin, ...args], {
    cwd: app,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (const stream of [child.stdout, child.stderr])
    stream.on('data', (chunk) =>
      pendingLogs.push(
        appendFile(path.join(app, `${profile.name}-${logName}.log`), chunk)
      )
    );
  return child;
}
async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([once(child, 'exit'), delay(5000)]);
  if (child.exitCode === null && child.signalCode === null)
    child.kill('SIGKILL');
}
async function availablePort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
function evidence(html) {
  const result = {};
  function text(node) {
    return node.nodeName === '#text'
      ? node.value
      : (node.childNodes ?? []).map(text).join('');
  }
  function hashes(node) {
    return [
      ...(node.attrs ?? [])
        .filter((a) => a.name === 'data-_gt-hash')
        .map((a) => a.value),
      ...(node.childNodes ?? []).flatMap(hashes),
    ];
  }
  function visit(node) {
    const attributes = Object.fromEntries(
      (node.attrs ?? []).map((a) => [a.name, a.value])
    );
    if (attributes['data-case'])
      result[attributes['data-case']] = {
        text: text(node),
        hashes: hashes(node),
        emotion: attributes['data-emotion-runtime'] === 'yes',
      };
    (node.childNodes ?? []).forEach(visit);
  }
  visit(parse(html));
  return result;
}
const results = [];
for (const profile of profiles) {
  let server;
  const buildDirectory = path.join(app, `.next-${profile.name}`);
  try {
    const bundlerArgs = profile.bundler === 'webpack' ? ['--webpack'] : [];
    if (profile.mode === 'production') {
      const build = start(['build', ...bundlerArgs], profile, 'build');
      const [exitCode] = await once(build, 'exit');
      if (exitCode !== 0)
        throw createFixtureError({
          whatHappened: 'The Emotion smoke production build failed',
          details: await readFile(
            path.join(app, `${profile.name}-build.log`),
            'utf8'
          ),
        });
    }
    const port = await availablePort();
    server = start(
      profile.mode === 'dev'
        ? ['dev', ...bundlerArgs, '--port', String(port)]
        : ['start', '--port', String(port)],
      profile,
      'server'
    );
    let response;
    for (let attempt = 0; attempt < 180; attempt++) {
      if (server.exitCode !== null || server.signalCode !== null) break;
      try {
        response = await fetch(`http://127.0.0.1:${port}`, {
          signal: AbortSignal.timeout(2000),
        });
      } catch {
        await delay(500);
        continue;
      }
      break;
    }
    if (!response)
      throw createFixtureError({
        whatHappened: 'The Emotion smoke server did not become ready',
        details: app,
      });
    const html = await response.text();
    await writeFile(path.join(app, `${profile.name}.html`), html);
    assert.equal(response.status, 200, `${profile.name}: ${app}`);
    const observed = evidence(html);
    results.push({ ...profile, observed });
    await writeFile(
      path.join(app, 'report.json'),
      JSON.stringify({ app, nextVersion, wasmSha256, results }, null, 2)
    );
    const expected = [
      ['shared-rsc', 'FINAL shared rsc', profile.enabled, false],
      ['shared-ssr', 'FINAL shared ssr', false, true],
      ['react-rsc', 'React pragma rsc', profile.enabled, false],
      ['react-ssr', 'React pragma ssr', profile.enabled, false],
      ['custom-rsc', 'Custom pragma rsc', false, true],
      ['custom-ssr', 'Custom pragma ssr', false, true],
      // Next's defaultLoaders.babel has no RSC bundleLayer. Its generated JSX
      // therefore uses Emotion even when this custom module is in the RSC graph.
      [
        'generated-rsc',
        'Generated JSX rsc',
        profile.bundler === 'turbopack' && profile.enabled,
        profile.bundler === 'webpack',
      ],
      ['generated-ssr', 'Generated JSX ssr', false, true],
      ['manual', 'Manual text', true, false],
    ];
    for (const [name, text, hashed, emotion] of expected) {
      assert.ok(observed[name], `${profile.name}: missing ${name}`);
      assert.equal(observed[name].text, text, `${profile.name}: ${name} text`);
      assert.equal(
        observed[name].hashes.length > 0,
        hashed,
        `${profile.name}: ${name} wrapping`
      );
      assert.equal(
        observed[name].emotion,
        emotion,
        `${profile.name}: ${name} host runtime`
      );
    }
    process.stdout.write(
      `PASS ${profile.name}: ${expected.length} runtime cases\n`
    );
  } finally {
    if (server) await stop(server);
    await Promise.all(pendingLogs);
    await rm(buildDirectory, { recursive: true, force: true });
  }
}
process.stdout.write(
  JSON.stringify(
    {
      nextVersion,
      wasmSha256,
      cases: results.length * 9,
      report: path.join(app, 'report.json'),
    },
    null,
    2
  ) + '\n'
);
