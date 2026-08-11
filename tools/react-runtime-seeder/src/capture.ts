import { build, type Plugin } from 'esbuild';
import { execFile, fork, type ForkOptions } from 'node:child_process';
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
    await runHarness(bundleFile, cwd);
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

async function runHarness(bundleFile: string, cwd: string): Promise<void> {
  const child = fork(bundleFile, [], {
    cwd,
    detached: true,
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
      await terminateProcessTree(child.pid);
      await closed;
      if (error) rejectRun(error);
      else resolveRun();
    }
  });
}

async function terminateProcessTree(pid: number | undefined): Promise<void> {
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
    // Freeze the harness group before taking the process snapshot so it cannot
    // race cleanup by spawning another child. Detached descendants have their
    // own process groups, so enumerate and kill them explicitly as well.
    try {
      process.kill(-pid, 'SIGSTOP');
    } catch {
      // The harness may already have exited.
    }
    for (const descendantPid of await findPosixDescendantPids(pid)) {
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

async function findPosixDescendantPids(rootPid: number): Promise<number[]> {
  try {
    const { stdout } = await execFileAsync('ps', ['-ax', '-o', 'pid=,ppid='], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    const childrenByParent = new Map<number, number[]>();
    for (const line of stdout.split('\n')) {
      const [pidText, parentPidText] = line.trim().split(/\s+/);
      const processPid = Number(pidText);
      const parentPid = Number(parentPidText);
      if (!Number.isInteger(processPid) || !Number.isInteger(parentPid)) {
        continue;
      }
      const children = childrenByParent.get(parentPid) ?? [];
      children.push(processPid);
      childrenByParent.set(parentPid, children);
    }

    const descendants: number[] = [];
    const pending = [...(childrenByParent.get(rootPid) ?? [])];
    const seen = new Set<number>();
    while (pending.length > 0) {
      const processPid = pending.shift();
      if (processPid == null || seen.has(processPid)) continue;
      seen.add(processPid);
      descendants.push(processPid);
      pending.push(...(childrenByParent.get(processPid) ?? []));
    }
    return descendants;
  } catch {
    return [];
  }
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
