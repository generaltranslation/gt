import { build, type Plugin } from 'esbuild';
import { execFile, fork, type ForkOptions } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import { createSeederError, createUnexpectedSeederError } from './diagnostics';
import { instrumentSource } from './instrumentSource';
import { isNodeModulesPath, normalizePath, relativeToCwd } from './paths';
import { createRuntimeHarness } from './runtimeHarness';
import type {
  CaptureRuntimeSeedsOptions,
  RuntimeSeed,
  RuntimeSeedCandidate,
} from './types';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const harnessCompleteMessage = 'gt-react-runtime-seed-complete';
const maxHarnessOutputBytes = 10 * 1024 * 1024;
const processTokenEnvironmentName = 'GT_REACT_RUNTIME_SEED_PROCESS_TOKEN';
const processPidFileEnvironmentName = 'GT_REACT_RUNTIME_SEED_PID_FILE';

export async function captureRuntimeSeeds(
  options: CaptureRuntimeSeedsOptions
): Promise<RuntimeSeedCandidate> {
  const cwd = resolve(options.cwd ?? process.cwd());
  validateInput(options);
  const temporaryDirectory = await mkdtemp(
    resolve(tmpdir(), 'gt-react-runtime-seed-')
  );

  try {
    const inputFile =
      options.file != null
        ? resolve(cwd, options.file)
        : resolve(temporaryDirectory, 'inline.tsx');
    const inputLabel =
      options.file != null
        ? normalizePath(relativeToCwd(cwd, inputFile))
        : '<inline>';
    if (options.code != null) {
      await writeFile(inputFile, createInlineModule(options.code), 'utf8');
    } else {
      await readFile(inputFile, 'utf8');
    }

    const resultFile = resolve(temporaryDirectory, 'result.json');
    const harnessFile = resolve(temporaryDirectory, 'harness.ts');
    const bundleFile = resolve(temporaryDirectory, 'harness.mjs');
    const processTrackerFile = resolve(
      temporaryDirectory,
      'process-tracker.cjs'
    );
    const processPidFile = resolve(temporaryDirectory, 'processes.pid');
    await writeFile(processTrackerFile, createProcessTracker(), 'utf8');
    await writeFile(processPidFile, '', 'utf8');
    await writeFile(
      harnessFile,
      createRuntimeHarness({
        inputFile,
        resultFile,
        locale: options.locale ?? libraryDefaultLocale,
      }),
      'utf8'
    );

    await build({
      entryPoints: [harnessFile],
      outfile: bundleFile,
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node20',
      jsx: 'automatic',
      logLevel: 'silent',
      banner: {
        js: "import { createRequire as __gtCreateRequire } from 'node:module'; const require = __gtCreateRequire(import.meta.url);",
      },
      plugins: [runtimeResolutionPlugin(), instrumentationPlugin(cwd)],
    });
    await runHarness(bundleFile, cwd, processTrackerFile, processPidFile);
    const seeds = JSON.parse(
      await readFile(resultFile, 'utf8')
    ) as RuntimeSeed[];
    if (options.code != null) {
      for (const seed of seeds) {
        seed.source.file = '<inline>';
        seed.source.line = Math.max(1, seed.source.line - 3);
      }
    }
    if (seeds.length === 0) {
      throw createSeederError({
        whatHappened: 'The render completed without capturing a <T> component',
        why: 'Only <T> bindings imported directly from gt-react or gt-next are instrumented.',
        fix: 'Import <T> from gt-react or gt-next in the rendered module and make sure the default export renders it.',
      });
    }
    return { schemaVersion: 1, input: inputLabel, seeds };
  } catch (error) {
    if (isSeederError(error)) throw error;
    throw createUnexpectedSeederError(error);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

function validateInput(options: CaptureRuntimeSeedsOptions): void {
  if ((options.file == null) === (options.code == null)) {
    throw createSeederError({
      whatHappened: 'Exactly one React seed input is required',
      fix: 'Pass either file or code, but not both.',
    });
  }
  if (options.file != null && options.file.trim() === '') {
    throw createSeederError({
      whatHappened: 'The React seed file path is empty',
      fix: 'Pass a path to a React module as file.',
    });
  }
}

function instrumentationPlugin(cwd: string): Plugin {
  return {
    name: 'gt-react-runtime-seed-source',
    setup(build) {
      build.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, async ({ path }) => {
        if (isNodeModulesPath(path)) return;
        const code = await readFile(path, 'utf8');
        return {
          contents: instrumentSource({ code, file: path, cwd }),
          loader: loaderFor(path),
        };
      });
    },
  };
}

async function runHarness(
  bundleFile: string,
  cwd: string,
  processTrackerFile: string,
  processPidFile: string
): Promise<void> {
  const processToken = randomUUID();
  const processTrackerOption = `--require=${JSON.stringify(processTrackerFile)}`;
  const child = fork(bundleFile, [], {
    cwd,
    detached: true,
    env: {
      ...process.env,
      [processTokenEnvironmentName]: processToken,
      [processPidFileEnvironmentName]: processPidFile,
      NODE_OPTIONS: appendNodeOption(
        process.env.NODE_OPTIONS,
        processTrackerOption
      ),
    },
    silent: true,
    windowsHide: true,
  } as ForkOptions & { windowsHide: boolean });
  let output = '';
  let outputBytes = 0;
  let settled = false;
  const closed = new Promise<void>((resolveClosed) => {
    child.once('close', () => resolveClosed());
  });

  await new Promise<void>((resolveRun, rejectRun) => {
    const timeout = setTimeout(() => {
      void finish(
        createSeederError({
          whatHappened: 'The React runtime seed render timed out',
          fix: 'Make sure the rendered component and its asynchronous work finish within 30 seconds.',
        })
      );
    }, 30_000);

    const appendOutput = (chunk: Buffer): void => {
      outputBytes += chunk.byteLength;
      if (outputBytes > maxHarnessOutputBytes) {
        void finish(
          createSeederError({
            whatHappened:
              'The React runtime seed render produced too much output',
            fix: 'Remove excessive logging from the rendered module and try again.',
          })
        );
        return;
      }
      output += chunk.toString('utf8');
    };

    child.stdout?.on('data', appendOutput);
    child.stderr?.on('data', appendOutput);
    child.once('error', (error) => void finish(error));
    child.once('exit', (code, signal) => {
      if (settled) return;
      const detail = output.trim();
      void finish(
        new Error(
          `The runtime harness exited before completing (code ${String(code)}, signal ${String(signal)}).${detail ? `\n${detail}` : ''}`
        )
      );
    });
    child.on('message', (message) => {
      if (
        typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message.type === harnessCompleteMessage
      ) {
        void finish();
      }
    });

    async function finish(error?: Error): Promise<void> {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      await terminateProcessTree(child.pid, processToken, processPidFile);
      await closed;
      if (error) rejectRun(error);
      else resolveRun();
    }
  });
}

function appendNodeOption(
  currentOptions: string | undefined,
  option: string
): string {
  return currentOptions ? `${currentOptions} ${option}` : option;
}

async function terminateProcessTree(
  pid: number | undefined,
  processToken: string,
  processPidFile: string
): Promise<void> {
  if (pid == null) return;
  if (process.platform === 'win32') {
    try {
      await execFileAsync('taskkill', ['/PID', String(pid), '/T', '/F'], {
        windowsHide: true,
      });
      return;
    } catch {
      // Fall through to the direct child as a best-effort fallback.
    }
  } else {
    // Freeze the harness group first. Detached and reparented descendants keep
    // the unique inherited environment marker, so repeated process snapshots
    // can freeze the complete stable set before anything is killed.
    try {
      process.kill(-pid, 'SIGSTOP');
    } catch {
      // The harness may already have exited.
    }
    for (const descendantPid of await freezePosixProcessTree(
      pid,
      processToken,
      processPidFile
    )) {
      try {
        process.kill(descendantPid, 'SIGKILL');
      } catch {
        // The descendant may have exited since the process snapshot.
      }
    }
    try {
      process.kill(-pid, 'SIGKILL');
      return;
    } catch {
      // Fall through when process groups are unavailable.
    }
  }
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // The process may already have exited.
  }
}

type PosixProcess = {
  pid: number;
  parentPid: number;
  state: string;
  command: string;
};

async function freezePosixProcessTree(
  rootPid: number,
  processToken: string,
  processPidFile: string
): Promise<number[]> {
  const frozenPids = new Set<number>();
  const environmentMarker = `${processTokenEnvironmentName}=${processToken}`;

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const processes = await listPosixProcesses();
    const descendants = findDescendantPids(processes, rootPid);
    const trackedPids = await readTrackedProcessPids(processPidFile);
    let allFrozen = true;
    for (const trackedPid of trackedPids) {
      if (trackedPid === rootPid || frozenPids.has(trackedPid)) continue;
      allFrozen = false;
      frozenPids.add(trackedPid);
      try {
        process.kill(trackedPid, 'SIGSTOP');
      } catch {
        // The tracked process may already have exited.
      }
    }
    const targets = processes.filter(
      (process) =>
        process.pid !== rootPid &&
        (descendants.has(process.pid) ||
          trackedPids.has(process.pid) ||
          process.command.includes(environmentMarker))
    );
    for (const target of targets) {
      frozenPids.add(target.pid);
      if (target.state.includes('T') || target.state.includes('Z')) continue;
      allFrozen = false;
      try {
        process.kill(target.pid, 'SIGSTOP');
      } catch {
        // The process may have exited since the process snapshot.
      }
    }
    if (allFrozen) break;
  }

  return [...frozenPids];
}

async function readTrackedProcessPids(pathname: string): Promise<Set<number>> {
  try {
    const contents = await readFile(pathname, 'utf8');
    return new Set(
      contents
        .split('\n')
        .map(Number)
        .filter((pid) => Number.isInteger(pid) && pid > 0)
    );
  } catch {
    return new Set();
  }
}

async function listPosixProcesses(): Promise<PosixProcess[]> {
  try {
    const { stdout } = await execFileAsync(
      'ps',
      ['eww', '-ax', '-o', 'pid=,ppid=,stat=,command='],
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    );
    const processes: PosixProcess[] = [];
    for (const line of stdout.split('\n')) {
      const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/);
      if (!match) continue;
      processes.push({
        pid: Number(match[1]),
        parentPid: Number(match[2]),
        state: match[3],
        command: match[4],
      });
    }
    return processes;
  } catch {
    return [];
  }
}

function findDescendantPids(
  processes: PosixProcess[],
  rootPid: number
): Set<number> {
  const childrenByParent = new Map<number, number[]>();
  for (const process of processes) {
    const children = childrenByParent.get(process.parentPid) ?? [];
    children.push(process.pid);
    childrenByParent.set(process.parentPid, children);
  }

  const descendants = new Set<number>();
  const pending = [...(childrenByParent.get(rootPid) ?? [])];
  while (pending.length > 0) {
    const processPid = pending.shift();
    if (processPid == null || descendants.has(processPid)) continue;
    descendants.add(processPid);
    pending.push(...(childrenByParent.get(processPid) ?? []));
  }
  return descendants;
}

function createProcessTracker(): string {
  return `const childProcess = require('node:child_process');
const fs = require('node:fs');
const tokenName = ${JSON.stringify(processTokenEnvironmentName)};
const pidFileName = ${JSON.stringify(processPidFileEnvironmentName)};
const token = process.env[tokenName];
const pidFile = process.env[pidFileName];
const preloadOption = '--require=' + JSON.stringify(__filename);

function setEnvironmentPair(pairs, name, value) {
  const prefix = name.toUpperCase() + '=';
  const filtered = pairs.filter(
    (pair) => !pair.toUpperCase().startsWith(prefix)
  );
  filtered.push(name + '=' + value);
  return filtered;
}

function getEnvironmentPair(pairs, name) {
  const prefix = name.toUpperCase() + '=';
  const pair = pairs.find((value) => value.toUpperCase().startsWith(prefix));
  return pair ? pair.slice(pair.indexOf('=') + 1) : '';
}

function withTrackedEnvironment(options) {
  const originalOptions = options ?? {};
  const environment = { ...(originalOptions.env ?? process.env) };
  if (token) environment[tokenName] = token;
  if (pidFile) environment[pidFileName] = pidFile;
  const nodeOptions = environment.NODE_OPTIONS ?? '';
  if (!nodeOptions.includes(preloadOption)) {
    environment.NODE_OPTIONS = nodeOptions
      ? nodeOptions + ' ' + preloadOption
      : preloadOption;
  }
  return { ...originalOptions, env: environment };
}

const originalSpawn = childProcess.ChildProcess.prototype.spawn;
childProcess.ChildProcess.prototype.spawn = function trackedSpawn(options) {
  let environmentPairs = [...(options.envPairs ?? [])];
  if (token) {
    environmentPairs = setEnvironmentPair(
      environmentPairs,
      tokenName,
      token
    );
  }
  if (pidFile) {
    environmentPairs = setEnvironmentPair(
      environmentPairs,
      pidFileName,
      pidFile
    );
  }
  const nodeOptions = getEnvironmentPair(environmentPairs, 'NODE_OPTIONS');
  if (!nodeOptions.includes(preloadOption)) {
    environmentPairs = setEnvironmentPair(
      environmentPairs,
      'NODE_OPTIONS',
      nodeOptions ? nodeOptions + ' ' + preloadOption : preloadOption
    );
  }
  const result = originalSpawn.call(this, {
    ...options,
    envPairs: environmentPairs,
  });
  if (pidFile && this.pid) {
    try {
      fs.appendFileSync(pidFile, this.pid + '\\n');
    } catch {}
  }
  return result;
};

const originalSpawnSync = childProcess.spawnSync;
childProcess.spawnSync = function trackedSpawnSync(command, args, options) {
  if (Array.isArray(args)) {
    return originalSpawnSync.call(
      this,
      command,
      args,
      withTrackedEnvironment(options)
    );
  }
  return originalSpawnSync.call(this, command, withTrackedEnvironment(args));
};

const originalExecFileSync = childProcess.execFileSync;
childProcess.execFileSync = function trackedExecFileSync(file, args, options) {
  if (Array.isArray(args)) {
    return originalExecFileSync.call(
      this,
      file,
      args,
      withTrackedEnvironment(options)
    );
  }
  return originalExecFileSync.call(this, file, withTrackedEnvironment(args));
};

const originalExecSync = childProcess.execSync;
childProcess.execSync = function trackedExecSync(command, options) {
  return originalExecSync.call(this, command, withTrackedEnvironment(options));
};

require('node:module').syncBuiltinESMExports();
`;
}

function runtimeResolutionPlugin(): Plugin {
  const gtReact = require.resolve('gt-react');
  const aliases = new Map([
    ['react', require.resolve('react')],
    ['react/jsx-runtime', require.resolve('react/jsx-runtime')],
    ['react/jsx-dev-runtime', require.resolve('react/jsx-dev-runtime')],
    ['react-dom/server', require.resolve('react-dom/server')],
    ['react-dom/static', require.resolve('react-dom/static')],
    ['gt-react', gtReact],
    ['gt-next', gtReact],
    [
      '@generaltranslation/react-core/components',
      require.resolve('@generaltranslation/react-core/components'),
    ],
    [
      '@generaltranslation/react-core/pure',
      require.resolve('@generaltranslation/react-core/pure'),
    ],
    ['gt-i18n/internal', require.resolve('gt-i18n/internal')],
  ]);
  return {
    name: 'gt-react-runtime-seed-resolution',
    setup(build) {
      build.onResolve({ filter: /^next\/link$/ }, () => ({
        path: 'next/link',
        namespace: 'gt-react-runtime-seed-stub',
      }));
      build.onLoad(
        { filter: /^next\/link$/, namespace: 'gt-react-runtime-seed-stub' },
        () => ({
          contents: `import React from 'react';
const Link = React.forwardRef(function Link(props, ref) {
  return React.createElement('a', { ...props, ref }, props.children);
});
export default Link;`,
          loader: 'js',
        })
      );
      build.onResolve(
        {
          filter:
            /^(react|react\/jsx(-dev)?-runtime|react-dom\/(server|static)|gt-react|gt-next|@generaltranslation\/react-core\/(components|pure)|gt-i18n\/internal)$/,
        },
        ({ path }) => ({
          path: aliases.get(path),
        })
      );
    },
  };
}

function createInlineModule(code: string): string {
  return `import { Branch, Currency, DateTime, Derive, Num, Plural, RelativeTime, T, Var } from 'gt-react';
export default function Seed() {
  return (
${code}
  );
}
`;
}

function loaderFor(pathname: string): 'js' | 'jsx' | 'ts' | 'tsx' {
  const extension = extname(pathname);
  if (extension === '.tsx') return 'tsx';
  if (extension === '.ts' || extension === '.mts' || extension === '.cts') {
    return 'ts';
  }
  if (extension === '.jsx') return 'jsx';
  return 'js';
}

function isSeederError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith('gt-react-seed');
}
