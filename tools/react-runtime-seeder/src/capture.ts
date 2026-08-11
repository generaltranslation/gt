import { build, type Plugin } from 'esbuild';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, extname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import { createSeederError, createUnexpectedSeederError } from './diagnostics';
import { instrumentSource } from './instrumentSource';
import { createRuntimeHarness } from './runtimeHarness';
import type {
  CaptureRuntimeSeedsOptions,
  RuntimeSeed,
  RuntimeSeedCandidate,
} from './types';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

export async function captureRuntimeSeeds(
  options: CaptureRuntimeSeedsOptions
): Promise<RuntimeSeedCandidate> {
  const cwd = resolve(options.cwd ?? process.cwd());
  validateInput(options);
  const temporaryDirectory = await mkdtemp(
    resolve(tmpdir(), 'gt-react-runtime-seed-')
  );

  try {
    const inputFile = options.file
      ? resolve(cwd, options.file)
      : resolve(temporaryDirectory, 'inline.tsx');
    const inputLabel = options.file
      ? normalizePath(relativeToCwd(cwd, inputFile))
      : '<inline>';
    if (options.code != null) {
      await writeFile(inputFile, createInlineModule(options.code), 'utf8');
    } else {
      await readFile(inputFile, 'utf8');
    }

    const resultFile = resolve(temporaryDirectory, 'result.json');
    const harnessFile = resolve(temporaryDirectory, 'harness.ts');
    const bundleFile = resolve(temporaryDirectory, 'harness.cjs');
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
      format: 'cjs',
      target: 'node20',
      jsx: 'automatic',
      logLevel: 'silent',
      plugins: [runtimeResolutionPlugin(), instrumentationPlugin(cwd)],
    });
    await execFileAsync(process.execPath, [bundleFile], {
      cwd,
      maxBuffer: 10 * 1024 * 1024,
    });
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
}

function instrumentationPlugin(cwd: string): Plugin {
  return {
    name: 'gt-react-runtime-seed-source',
    setup(build) {
      build.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, async ({ path }) => {
        if (path.includes('/node_modules/')) return;
        const code = await readFile(path, 'utf8');
        return {
          contents: instrumentSource({ code, file: path, cwd }),
          loader: loaderFor(path),
        };
      });
    },
  };
}

function runtimeResolutionPlugin(): Plugin {
  const gtReact = require.resolve('gt-react');
  const aliases = new Map([
    ['react', require.resolve('react')],
    ['react/jsx-runtime', require.resolve('react/jsx-runtime')],
    ['react/jsx-dev-runtime', require.resolve('react/jsx-dev-runtime')],
    ['react-dom/server', require.resolve('react-dom/server')],
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
            /^(react|react\/jsx(-dev)?-runtime|react-dom\/server|gt-react|gt-next|@generaltranslation\/react-core\/(components|pure)|gt-i18n\/internal)$/,
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

function relativeToCwd(cwd: string, file: string): string {
  const prefix = `${cwd}/`;
  return file.startsWith(prefix) ? file.slice(prefix.length) : basename(file);
}

function normalizePath(pathname: string): string {
  return pathname.replaceAll('\\', '/');
}

function isSeederError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith('gt-react-seed');
}
