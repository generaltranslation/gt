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
// wildcard export.
async function createPackage(files) {
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
  { kind: 'NoResolution', resolutionKind: 'node10', entrypoint: '.' },
  { kind: 'CJSResolvesToESM', resolutionKind: 'node16-cjs', entrypoint: '.' },
  { kind: 'NoResolution', resolutionKind: 'bundler', entrypoint: './types' },
  {
    kind: 'FalseCJS',
    typesFileName: 'a.d.ts',
    implementationFileName: 'a.mjs',
  },
];

describe('check-package', () => {
  test('defaults unlisted packages to the node16 profile', () => {
    expect(getCheckOptions('generaltranslation')).toEqual({
      profile: 'node16',
    });
  });

  test('node16 ignores only node10 problems', () => {
    expect(filterAttwProblems(problems, { profile: 'node16' })).toEqual(
      problems.slice(1)
    );
  });

  test('esm-only also ignores node16-cjs problems', () => {
    expect(filterAttwProblems(problems, { profile: 'esm-only' })).toEqual(
      problems.slice(2)
    );
  });

  test('ignores listed problem kinds in every resolution mode', () => {
    expect(
      filterAttwProblems(problems, {
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
});
