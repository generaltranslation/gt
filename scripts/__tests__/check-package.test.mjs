import { describe, expect, test } from 'vitest';
import {
  expandWildcardExports,
  filterAttwProblems,
  formatAttwProblem,
  getCheckOptions,
} from '../check-package.mjs';

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
});
