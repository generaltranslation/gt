import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, statfs, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createFixtureError } from '../diagnostics.mjs';
import { loadApps } from './catalog';
import { drivers, scaffold, type Driver } from './scaffold';
import { states } from './types';
import type { BrowserRun } from '../../../../../../tests/apps/test-apps-e2e/auto-jsx-browser';

type Run = Partial<BrowserRun> & {
  proof: Awaited<ReturnType<typeof scaffold>>;
  started: string;
  finished?: string;
  freeBytesBefore: number;
  freeBytesAfter?: number;
  buildExit?: number | null;
};
type Comparison = {
  app: string;
  mode: string;
  reference: string;
  driver: string;
  differences: string[];
  valid: boolean;
};
function progress(message: string) {
  process.stdout.write(`${message}\n`);
}

async function compilerLogErrors(filename: string): Promise<string[]> {
  const log = (await readFile(filename, 'utf8')).replace(
    /\u001b\[[0-9;]*m/g,
    ''
  );
  // A compiler can catch an exception and still serve HTTP200. Such a no-op
  // must not be mistaken for successful insertion, even if DOM output agrees.
  return log
    .split('\n')
    .filter((line) =>
      /\[gt-compiler\]\s+ERROR:|(?:gt-next|@generaltranslation\/compiler)[^\n]*\bError:/i.test(
        line
      )
    );
}

const repository = fileURLToPath(
  new URL('../../../../../../', import.meta.url)
).replace(/\/$/, '');
const { values } = parseArgs({
  options: {
    apps: { type: 'string' },
    drivers: { type: 'string', default: drivers.join(',') },
    modes: { type: 'string', default: 'dev,production' },
    output: { type: 'string' },
    'source-app': { type: 'string' },
    'min-free-gib': { type: 'string', default: '5' },
    'generate-only': { type: 'boolean' },
  },
});
const apps = (await loadApps()).filter(
  (app) =>
    !values.apps ||
    values.apps.split(',').some((prefix) => app.name.startsWith(prefix))
);
const selectedDrivers = values.drivers!.split(',') as Driver[];
const modes = values.modes!.split(',');
if (
  !apps.length ||
  selectedDrivers.some((driver) => !drivers.includes(driver)) ||
  modes.some((mode) => !['dev', 'production'].includes(mode))
)
  throw createFixtureError({
    whatHappened:
      'Select existing app prefixes, drivers (swc,compiler,cli), and modes (dev,production)',
  });
const directory = values.output
  ? path.resolve(values.output)
  : await mkdtemp(path.join(tmpdir(), 'gt-auto-jsx-apps-'));
if (values.output) {
  await mkdir(path.dirname(directory), { recursive: true });
  try {
    await mkdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    throw createFixtureError({
      whatHappened: 'The parity output directory already exists',
      details: directory,
      fix: 'Choose a new output directory to preserve previous evidence',
    });
  }
}
const sourceApp = path.resolve(
  values['source-app'] || path.join(repository, 'tests/apps/next-app-router')
);
const reserve = Number(values['min-free-gib']) * 1024 ** 3;
if (!Number.isFinite(reserve) || reserve < 0)
  throw createFixtureError({
    whatHappened: 'The storage reserve must be a nonnegative GiB value',
  });
async function storage() {
  const stats = await statfs(directory);
  const available = stats.bavail * stats.bsize;
  if (available < reserve)
    throw createFixtureError({
      whatHappened: 'The parity app run reached its storage reserve',
      details: `${(available / 1024 ** 3).toFixed(2)} GiB free; all artifacts retained at ${directory}`,
      fix: 'Choose a volume with more space before continuing',
    });
  return available;
}
const report: {
  [key: string]: unknown;
  runs: Record<string, Run>;
  comparisons: Comparison[];
} = {
  head: execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repository,
    encoding: 'utf8',
  }).trim(),
  directory,
  started: new Date().toISOString(),
  sourceApp,
  wasmSha256: createHash('sha256')
    .update(
      await readFile(
        path.join(repository, 'packages/next/dist/gt_swc_plugin.wasm')
      )
    )
    .digest('hex'),
  apps: apps.map(({ name, cases, files }) => ({
    name,
    cases,
    sources: Object.fromEntries(
      Object.entries(files).map(([name, source]) => [
        name,
        createHash('sha256').update(source).digest('hex'),
      ])
    ),
  })),
  runs: {},
  comparisons: [],
};
async function save() {
  await writeFile(
    path.join(directory, 'report.json'),
    `${JSON.stringify(report, null, 2)}\n`
  );
}
const environment = Object.fromEntries(
  Object.entries(process.env).filter(
    ([name]) =>
      !name.startsWith('GT_') &&
      !name.startsWith('NEXT_PUBLIC_GT_') &&
      name !== 'NODE_OPTIONS'
  )
);
Object.assign(environment, {
  NEXT_TELEMETRY_DISABLED: '1',
  NEXT_IGNORE_INCORRECT_LOCKFILE: '1',
});
const ownedStops = new Set<() => Promise<void>>();
function command(args: string[], cwd: string, logPath: string, dist: string) {
  const output = createWriteStream(logPath, { flags: 'a' });
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...environment, GT_PARITY_DIST: dist },
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.pipe(output, { end: false });
  child.stderr.pipe(output, { end: false });
  const done = new Promise<number | null>((resolve, reject) => {
    output.once('error', reject);
    child.once('error', (error) => {
      output.end();
      reject(error);
    });
    child.once('close', (code) => {
      output.end(() => resolve(code));
    });
  });
  async function stop() {
    if (child.exitCode !== null || child.signalCode !== null) return;
    if (process.platform === 'win32') child.kill('SIGTERM');
    else
      try {
        process.kill(-child.pid!, 'SIGTERM');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
      }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const exited = await Promise.race([
      done.then(() => true),
      new Promise<false>((resolve) => {
        timer = setTimeout(() => resolve(false), 10_000);
      }),
    ]).finally(() => clearTimeout(timer));
    if (!exited) {
      if (process.platform === 'win32') child.kill('SIGKILL');
      else
        try {
          process.kill(-child.pid!, 'SIGKILL');
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
        }
      await done;
    }
  }
  ownedStops.add(stop);
  void done.then(
    () => ownedStops.delete(stop),
    () => ownedStops.delete(stop)
  );
  return { child, done, stop };
}
async function freePort() {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = (server.address() as net.AddressInfo).port;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
  return port;
}
async function ready(url: string, process: ReturnType<typeof command>) {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    if (process.child.exitCode !== null || process.child.signalCode !== null)
      throw createFixtureError({
        whatHappened: 'The parity app server exited before readiness',
      });
    try {
      // Wait for a listener without treating a failed compilation as a readiness timeout.
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      await response.arrayBuffer();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw createFixtureError({
    whatHappened:
      'The parity app server did not become ready within three minutes',
  });
}
// This is the repository workspace that declares and owns @playwright/test.
const { openParityBrowser, inspectParityApp } =
  await import('../../../../../../tests/apps/test-apps-e2e/auto-jsx-browser');
let browser: Awaited<ReturnType<typeof openParityBrowser>> | undefined;
let stopping = false;
async function interrupt(signal: 'SIGINT' | 'SIGTERM') {
  if (stopping) return;
  stopping = true;
  report.error = `Interrupted by ${signal}; artifacts retained`;
  await Promise.allSettled([...ownedStops].map((stop) => stop()));
  await browser?.close();
  report.finished = new Date().toISOString();
  await save();
  process.exit(signal === 'SIGINT' ? 130 : 143);
}
process.once('SIGINT', () => void interrupt('SIGINT'));
process.once('SIGTERM', () => void interrupt('SIGTERM'));
progress(
  `Retaining ${apps.length} apps / ${apps.reduce((total, app) => total + app.cases.length, 0)} cases at ${directory}`
);
try {
  await storage();
  if (!values['generate-only']) browser = await openParityBrowser();
  for (const app of apps) {
    for (const driver of selectedDrivers) {
      const appDirectory = path.join(directory, app.name, driver);
      const proof = await scaffold(
        appDirectory,
        app,
        driver,
        repository,
        sourceApp
      );
      await writeFile(
        path.join(appDirectory, 'resolution.json'),
        JSON.stringify(proof, null, 2)
      );
      if (values['generate-only']) continue;
      for (const mode of modes) {
        const key = `${app.name}/${driver}/${mode}`;
        const artifacts = path.join(appDirectory, 'artifacts', mode);
        await mkdir(artifacts, { recursive: true });
        const free = await storage();
        progress(`${key} (${(free / 1024 ** 3).toFixed(1)} GiB free)`);
        const dist = `.next-${mode}`;
        const bundler = driver === 'swc' ? '--turbopack' : '--webpack';
        const run: Run = {
          proof,
          freeBytesBefore: free,
          started: new Date().toISOString(),
        };
        report.runs[key] = run;
        await save();
        if (mode === 'production') {
          const build = command(
            [proof.nextBinary, 'build', bundler],
            appDirectory,
            path.join(artifacts, 'build.log'),
            dist
          );
          const timer = setTimeout(() => void build.stop(), 300_000);
          try {
            run.buildExit = await build.done;
          } finally {
            clearTimeout(timer);
            await build.stop();
          }
          if (run.buildExit !== 0) {
            run.failures = ['Production build failed; inspect build.log'];
            await save();
            continue;
          }
          const errors = await compilerLogErrors(
            path.join(artifacts, 'build.log')
          );
          if (errors.length) {
            run.failures = errors;
            await save();
            continue;
          }
        }
        const port = await freePort();
        const url = `http://127.0.0.1:${port}`;
        const server = command(
          [
            proof.nextBinary,
            mode === 'dev' ? 'dev' : 'start',
            ...(mode === 'dev' ? [bundler] : []),
            '--hostname',
            '127.0.0.1',
            '--port',
            String(port),
          ],
          appDirectory,
          path.join(artifacts, 'server.log'),
          dist
        );
        try {
          await ready(url, server);
          Object.assign(
            run,
            await inspectParityApp(browser!, {
              url,
              cases: app.cases,
              states,
              directory: artifacts,
              expectations: states.map((state) => app.expected?.(state) || {}),
              expectedConsoleErrors: app.expectedConsoleErrors,
            })
          );
        } catch (error) {
          run.failures = [String(error)];
        } finally {
          await server.stop();
        }
        run.failures ??= [];
        run.failures.push(
          ...(await compilerLogErrors(path.join(artifacts, 'server.log')))
        );
        run.finished = new Date().toISOString();
        run.freeBytesAfter = await storage();
        await writeFile(
          path.join(artifacts, 'result.json'),
          `${JSON.stringify(run, null, 2)}\n`
        );
        await save();
        progress(
          `${key}: ${run.failures?.length ? `${run.failures.length} failures` : 'rendered'}`
        );
      }
    }
    for (const mode of modes) {
      const reference = report.runs[`${app.name}/compiler/${mode}`];
      for (const driver of selectedDrivers.filter(
        (driver) => driver !== 'compiler'
      )) {
        const actual = report.runs[`${app.name}/${driver}/${mode}`];
        if (!reference || !actual) continue;
        const differences: string[] = [];
        for (const stage of new Set([
          ...Object.keys(reference.snapshots || {}),
          ...Object.keys(actual.snapshots || {}),
        ])) {
          if (
            reference.snapshots?.[stage]?.title !==
            actual.snapshots?.[stage]?.title
          )
            differences.push(`${stage}/document-title`);
          for (const id of app.cases) {
            const expected = reference.snapshots?.[stage]?.cases?.[id];
            const received = actual.snapshots?.[stage]?.cases?.[id];
            if (
              expected === undefined ||
              received === undefined ||
              JSON.stringify(expected) !== JSON.stringify(received)
            )
              differences.push(`${stage}/${id}`);
          }
        }
        report.comparisons.push({
          app: app.name,
          mode,
          reference: 'compiler',
          driver,
          differences,
          valid:
            !reference.failures?.length &&
            !actual.failures?.length &&
            Object.keys(reference.snapshots || {}).length === 7 &&
            Object.keys(actual.snapshots || {}).length === 7,
        });
      }
    }
    await save();
  }
} catch (error) {
  report.error = String(error);
  process.exitCode = 1;
} finally {
  await Promise.allSettled([...ownedStops].map((stop) => stop()));
  await browser?.close();
  report.finished = new Date().toISOString();
  await save();
}
const failures = Object.values(report.runs).filter(
  (run) => run.failures?.length
).length;
const differences = report.comparisons.filter(
  (comparison) => !comparison.valid || comparison.differences.length
).length;
progress(
  `${Object.keys(report.runs).length} runs, ${failures} failed runs, ${differences} differing comparisons. Report: ${path.join(directory, 'report.json')}`
);
if (failures || differences || report.error) process.exitCode = 1;
