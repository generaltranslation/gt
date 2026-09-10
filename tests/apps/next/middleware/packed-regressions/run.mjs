import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  openSync,
  closeSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const here = dirname(fileURLToPath(import.meta.url));
const { values } = parseArgs({
  options: {
    manifest: { type: 'string' },
    artifact: { type: 'string', default: 'head' },
    features: { type: 'string', default: 'encoded,ownership,depth' },
    next: { type: 'string', default: '16.3.4' },
    output: { type: 'string' },
    port: { type: 'string', default: '4631' },
    repeat: { type: 'string', default: '3' },
  },
});
assert(values.manifest, 'Provide --manifest with an exact packed artifact.');
const manifestPath = realpathSync(resolve(values.manifest));
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const selected = manifest[values.artifact];
assert(
  selected?.tarball && selected?.sha256,
  'Artifact needs tarball and sha256.'
);
const tarball = realpathSync(resolve(dirname(manifestPath), selected.tarball));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
assert.equal(
  sha256(readFileSync(tarball)),
  selected.sha256,
  'Artifact hash mismatch.'
);
const features = values.features.split(',');
assert(
  features.every((f) =>
    ['encoded', 'ownership', 'depth', 'catchall'].includes(f)
  )
);
assert(/^\d+\.\d+\.\d+$/.test(values.next), 'Pin an exact Next.js version.');
const port = Number(values.port);
const repeat = Number(values.repeat);
assert(Number.isInteger(port) && port > 1024 && port < 65536);
assert(Number.isInteger(repeat) && repeat > 0);
const output = resolve(
  values.output || join(tmpdir(), `gt-routing-${Date.now()}`)
);
assert(
  !existsSync(output),
  'Use a fresh output directory to preserve earlier evidence.'
);
let ancestor = dirname(output);
while (!existsSync(ancestor)) ancestor = dirname(ancestor);
assert.notEqual(
  spawnSync('git', ['-C', ancestor, 'rev-parse', '--is-inside-work-tree'], {
    encoding: 'utf8',
  }).stdout?.trim(),
  'true',
  'Consumer output must be outside Git.'
);
mkdirSync(output, { recursive: true });
const consumer = join(output, 'consumer');
const logs = join(output, 'logs');
mkdirSync(logs);
const overrides = {};
const dependencies = {};
for (const [name, spec] of Object.entries(manifest.dependencies || {})) {
  assert(
    spec.startsWith('file:'),
    'Dependency overrides must be packed file artifacts.'
  );
  const path = realpathSync(resolve(dirname(manifestPath), spec.slice(5)));
  overrides[name] = `file:${path}`;
  dependencies[name] = { path, sha256: sha256(readFileSync(path)) };
}
const settings = {
  features,
  trailingSlash: features.some((f) => f !== 'encoded'),
  port,
  repeat,
};
const result = {
  status: 'preparing',
  // This SHA is supplied by the packer; the runner independently verifies bytes.
  declaredSourceSha: selected.sha,
  tarball,
  sha256: selected.sha256,
  dependencies,
  next: values.next,
  node: process.version,
  settings,
  output,
  runnerSha256: sha256(readFileSync(join(here, 'run.mjs'))),
  testSha256: sha256(readFileSync(join(here, 'routing.spec.ts'))),
  fixtureSha256: Object.fromEntries(
    readdirSync(join(here, 'fixture'), { recursive: true })
      .filter((path) => statSync(join(here, 'fixture', path)).isFile())
      .map((path) => [path, sha256(readFileSync(join(here, 'fixture', path)))])
  ),
};
const json = (path, value) =>
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
function run(stage, args) {
  result.stage = stage;
  process.stdout.write(`${stage}: ${args.join(' ')}\n`);
  const fd = openSync(join(logs, `${stage}.log`), 'w');
  try {
    const child = spawnSync('pnpm', args, {
      cwd: consumer,
      stdio: ['ignore', fd, fd],
      timeout: stage === 'typecheck' ? 120_000 : 300_000,
    });
    assert.equal(
      child.status,
      0,
      `${stage} failed; see ${join(logs, `${stage}.log`)}`
    );
  } finally {
    closeSync(fd);
  }
}

try {
  cpSync(join(here, 'fixture'), consumer, { recursive: true });
  mkdirSync(join(consumer, 'e2e'));
  cpSync(join(here, 'routing.spec.ts'), join(consumer, 'e2e/routing.spec.ts'));
  json(join(consumer, 'regression-config.json'), settings);
  json(join(consumer, 'package.json'), {
    name: 'gt-packed-routing-regressions',
    version: '0.0.0',
    private: true,
    scripts: {
      build: `next build${Number(values.next.split('.')[0]) >= 16 ? ' --webpack' : ''}`,
      start: `next start -p ${port}`,
    },
    dependencies: {
      'gt-next': `file:${tarball}`,
      next: values.next,
      react: '19.2.4',
      'react-dom': '19.2.4',
    },
    devDependencies: {
      '@playwright/test': '1.57.0',
      typescript: '5.9.3',
      '@types/node': '22.19.11',
      '@types/react': '19.2.14',
      '@types/react-dom': '19.2.3',
    },
    pnpm: { overrides },
  });
  writeFileSync(
    join(consumer, 'playwright.config.ts'),
    `
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', workers: 1, retries: 0, repeatEach: ${repeat},
  timeout: 30000, globalTimeout: ${repeat * 180_000}, outputDir: ${JSON.stringify(join(output, 'test-results'))},
  reporter: [['list'], ['json', {outputFile: ${JSON.stringify(join(output, 'playwright.json'))}}]],
  use: {baseURL: 'http://localhost:${port}', browserName: 'chromium', headless: true, trace: 'retain-on-failure'},
  webServer: {command: 'pnpm start', url: 'http://localhost:${port}/fr/', reuseExistingServer: false, timeout: 60000},
});
`
  );
  run('install', ['install']);
  result.installedNext = JSON.parse(
    readFileSync(join(consumer, 'node_modules/next/package.json'), 'utf8')
  ).version;
  assert.equal(result.installedNext, values.next);
  result.pnpm = execFileSync('pnpm', ['--version'], {
    cwd: consumer,
    encoding: 'utf8',
  }).trim();
  result.resolvedEntry = execFileSync(
    'node',
    [
      '--input-type=module',
      '-e',
      "console.log(import.meta.resolve('gt-next/middleware'))",
    ],
    { cwd: consumer, encoding: 'utf8' }
  ).trim();
  const packageRoot = realpathSync(join(consumer, 'node_modules/gt-next'));
  const entryRelative = relative(
    packageRoot,
    fileURLToPath(result.resolvedEntry)
  );
  assert(!entryRelative.startsWith('..') && !isAbsolute(entryRelative));
  const members = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' })
    .trim()
    .split('\n');
  result.middlewareModules = {};
  for (const member of members.filter((name) =>
    /^package\/dist\/(middleware-dir\/.*|middleware)\.mjs$/.test(name)
  )) {
    const path = member.slice('package/'.length);
    const packed = execFileSync('tar', ['-xOf', tarball, member]);
    assert.deepEqual(
      readFileSync(join(packageRoot, path)),
      packed,
      `Installed module differs: ${path}`
    );
    result.middlewareModules[path] = sha256(packed);
  }
  assert(
    result.middlewareModules[entryRelative],
    'Resolved entry must match the packed middleware.'
  );
  run('build', ['build']);
  run('typecheck', ['exec', 'tsc', '--noEmit']);
  run('browser-install', [
    'exec',
    'playwright',
    'install',
    'chromium-headless-shell',
  ]);
  result.stage = 'tests';
  const fd = openSync(join(logs, 'tests.log'), 'w');
  let tests;
  try {
    tests = spawnSync('pnpm', ['exec', 'playwright', 'test'], {
      cwd: consumer,
      stdio: ['ignore', fd, fd],
      timeout: repeat * 180_000 + 120_000,
      killSignal: 'SIGINT',
    });
  } finally {
    closeSync(fd);
  }
  const report = JSON.parse(
    readFileSync(join(output, 'playwright.json'), 'utf8')
  );
  result.stats = report.stats;
  const specs = (suite) => [
    ...(suite.specs || []),
    ...(suite.suites || []).flatMap(specs),
  ];
  const active = specs(report).filter((spec) =>
    spec.tests.some((entry) =>
      entry.results.some((r) => r.status !== 'skipped')
    )
  );
  const runs = active
    .flatMap((spec) => spec.tests)
    .filter((entry) => entry.results.some((r) => r.status !== 'skipped'));
  result.activeCases = new Set(
    active.map((spec) => `${spec.file}:${spec.line}:${spec.title}`)
  ).size;
  result.activeTestRuns = runs.length;
  result.passedTestRuns = runs.filter(
    (entry) => entry.results.at(-1)?.status === 'passed'
  ).length;
  result.skippedTestRuns = report.stats.skipped;
  assert(!tests.error, String(tests.error));
  assert(!report.errors?.length, JSON.stringify(report.errors));
  const errors = runs.flatMap((entry) =>
    entry.results.flatMap((r) => r.errors || [])
  );
  assert(
    !errors.some((error) =>
      /browserType\.launch|Executable doesn't exist/.test(error.message)
    ),
    'Browser launch failed; this is not a routing regression reproduction.'
  );
  result.status = tests.status === 0 ? 'passed' : 'test-failures';
  process.exitCode = tests.status === 0 ? 0 : 1;
} catch (error) {
  result.status = 'harness-error';
  result.error = String(error);
  process.exitCode = 1;
} finally {
  json(join(output, 'result.json'), result);
  process.stdout.write(`${result.status}: ${output}\n`);
}
