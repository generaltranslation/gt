import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  expandWildcardExports,
  filterAttwProblems,
  formatAttwProblem,
  getCheckOptions,
  run,
} from '../check-package.mjs';

const temporaryRoots = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true }))
  );
});

// A CommonJS package whose ./utils/* subpaths are only reachable through a
// wildcard export. `files` replaces or adds files; `manifest` extends
// package.json.
async function createPackage(files, manifest = {}) {
  const packageDir = await mkdtemp(path.join(tmpdir(), 'check-package-'));
  temporaryRoots.push(packageDir);
  const allFiles = {
    'package.json': JSON.stringify({
      name: 'check-package-fixture',
      version: '1.0.0',
      files: ['dist'],
      exports: {
        '.': { types: './dist/index.d.ts', default: './dist/index.js' },
        './utils/*': {
          types: './dist/utils/*.d.ts',
          default: './dist/utils/*.js',
        },
      },
      ...manifest,
    }),
    'dist/index.js': 'exports.a = 1;\n',
    'dist/index.d.ts': 'export declare const a: number;\n',
    'dist/utils/b.js': 'exports.b = 1;\n',
    'dist/utils/b.d.ts': 'export declare const b: number;\n',
    ...files,
  };
  for (const [file, content] of Object.entries(allFiles)) {
    await mkdir(path.dirname(path.join(packageDir, file)), {
      recursive: true,
    });
    await writeFile(path.join(packageDir, file), content);
  }
  return packageDir;
}

function silenceOutput() {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
}

const problems = [
  // An internal resolution error has a resolutionOption, not a resolutionKind.
  {
    kind: 'InternalResolutionError',
    resolutionOption: 'node10',
    fileName: '/node_modules/p/dist/index.d.ts',
    moduleSpecifier: 'p/sub',
  },
  { kind: 'CJSResolvesToESM', resolutionKind: 'node16-cjs', entrypoint: '.' },
  { kind: 'NoResolution', resolutionKind: 'bundler', entrypoint: './types' },
  {
    kind: 'FalseCJS',
    typesFileName: 'a.d.ts',
    implementationFileName: 'a.mjs',
  },
];

// attw records which problems are visible under each resolution kind.
const analysis = {
  problems,
  entrypoints: {
    '.': {
      resolutions: {
        node10: { visibleProblems: [0] },
        'node16-cjs': { visibleProblems: [1, 3] },
        'node16-esm': { visibleProblems: [3] },
        bundler: { visibleProblems: [2, 3] },
      },
    },
  },
};

describe('check-package', () => {
  test('defaults unlisted packages to the node16 profile', () => {
    expect(getCheckOptions('generaltranslation')).toEqual({
      profile: 'node16',
    });
  });

  test('node16 ignores only problems visible under node10', () => {
    expect(filterAttwProblems(analysis, { profile: 'node16' })).toEqual(
      problems.slice(1)
    );
  });

  test('esm-only also ignores problems visible only under node16-cjs', () => {
    expect(filterAttwProblems(analysis, { profile: 'esm-only' })).toEqual(
      problems.slice(2)
    );
  });

  test('ignores listed problem kinds in every resolution mode', () => {
    expect(
      filterAttwProblems(analysis, {
        profile: 'node16',
        ignoreProblems: ['FalseCJS'],
      })
    ).toEqual(problems.slice(1, 3));
  });

  test('formats a problem on one line', () => {
    expect(formatAttwProblem(problems[2])).toBe(
      'NoResolution (bundler) at ./types'
    );
    expect(formatAttwProblem(problems[3])).toBe(
      'FalseCJS types a.d.ts implementation a.mjs'
    );
  });

  test('expands wildcard exports against packed files', () => {
    const files = [
      'package.json',
      'dist/index.js',
      'dist/index.d.ts',
      'dist/fs/copy.js',
      'dist/fs/copy.d.ts',
      'dist/fs/copy.js.map',
      'dist/fs/deep/read.js',
    ];
    expect(
      expandWildcardExports(
        {
          '.': { types: './dist/index.d.ts', import: './dist/index.js' },
          './fs/*': { types: './dist/fs/*.d.ts', import: './dist/fs/*.js' },
          './jsx/*': { types: './dist/jsx/*.d.ts', import: './dist/jsx/*.js' },
        },
        files
      )
    ).toEqual({
      entrypoints: ['./fs/copy', './fs/deep/read'],
      unmatched: ['./jsx/*'],
    });
  });

  test('ignores exports without subpath wildcards', () => {
    expect(expandWildcardExports('./dist/index.js', ['dist/index.js'])).toEqual(
      { entrypoints: [], unmatched: [] }
    );
    expect(expandWildcardExports(undefined, [])).toEqual({
      entrypoints: [],
      unmatched: [],
    });
  });

  test('run passes a valid packed package', async () => {
    silenceOutput();
    expect(await run(await createPackage({}))).toBe(0);
  });

  test('run fails on broken types reachable only through a wildcard export', async () => {
    silenceOutput();
    const packageDir = await createPackage({
      'dist/utils/b.d.ts':
        "export declare const b: number;\nexport * from './missing';\n",
    });
    expect(await run(packageDir)).toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('InternalResolutionError')
    );
  });

  test('node16 passes a self-reference that only node10 cannot resolve', async () => {
    silenceOutput();
    // node10 reads the top-level types field but not exports, so the
    // self-referenced subpath fails only there (InternalResolutionError).
    const packageDir = await createPackage(
      {
        'dist/index.js':
          "exports.a = 1;\nexports.b = require('./utils/b.js').b;\n",
        'dist/index.d.ts':
          "export declare const a: number;\nexport * from 'check-package-fixture/utils/b';\n",
      },
      { main: './dist/index.js', types: './dist/index.d.ts' }
    );
    expect(await run(packageDir)).toBe(0);
  });

  test('esm-only passes a problem visible only under node16-cjs', async () => {
    silenceOutput();
    const packageDir = await createPackage(
      {
        'dist/index.mjs': 'export const a = 1;\n',
        'dist/index.d.mts': 'export declare const a: number;\n',
        'dist/index.d.ts': "export * from './missing';\n",
      },
      {
        exports: {
          '.': {
            import: {
              types: './dist/index.d.mts',
              default: './dist/index.mjs',
            },
            require: { types: './dist/index.d.ts', default: './dist/index.js' },
          },
        },
      }
    );
    expect(await run(packageDir, { profile: 'esm-only' })).toBe(0);
    expect(await run(packageDir, { profile: 'node16' })).toBe(1);
  });
});
