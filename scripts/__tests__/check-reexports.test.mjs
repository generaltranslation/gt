import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  entryExceptions,
  findReexports,
  getPackageName,
  readPackageEntries,
  run,
  validateRepository,
} from '../check-reexports.mjs';

const temporaryRoots = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true }))
  );
});

async function createRepository(files) {
  const repositoryRoot = await mkdtemp(path.join(tmpdir(), 'check-reexports-'));
  temporaryRoots.push(repositoryRoot);

  await Promise.all(
    Object.entries(files).map(async ([relativePath, contents]) => {
      const absolutePath = path.join(repositoryRoot, relativePath);
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, contents);
    })
  );

  return repositoryRoot;
}

function manifest(name, exports) {
  return JSON.stringify({ name, exports });
}

describe('getPackageName', () => {
  test.each([
    ['gt-i18n/internal', 'gt-i18n'],
    ['@generaltranslation/react-core/pure', '@generaltranslation/react-core'],
    ['generaltranslation', 'generaltranslation'],
    ['./local', undefined],
    ['../parent', undefined],
  ])('%s -> %s', (specifier, expected) => {
    expect(getPackageName(specifier)).toBe(expected);
  });
});

describe('findReexports', () => {
  test('finds export-from, export * and import-then-export', () => {
    const reexports = findReexports(
      'src/barrel.ts',
      `
        import { a, b as renamed } from './a';
        import type { T } from 'gt-i18n';
        import * as ns from './ns';
        import req = require('./req');
        export { x } from './x';
        export type { Y } from './y';
        export * from './star';
        export * as all from './all';
        export { a, renamed as b2 };
        export type { T };
        export { ns };
        export { req };
        export import external = require('other');
        export import Nested = ns.Nested;
        export default a;
      `
    );

    expect(reexports.map(({ specifier, names }) => [specifier, names])).toEqual(
      [
        ['./x', ['x']],
        ['./y', ['Y']],
        ['./star', ['*']],
        ['./all', ['* as all']],
        ['./a', ['a']],
        ['./a', ['b2']],
        ['gt-i18n', ['T']],
        ['./ns', ['ns']],
        ['./req', ['req']],
        ['other', ['external']],
        ['./ns', ['Nested']],
        ['./a', ['default']],
      ]
    );
    expect(reexports[0].location).toBe('src/barrel.ts:6:9');
  });

  test('ignores locally defined exports and type aliases', () => {
    expect(
      findReexports(
        'src/local.tsx',
        `
          import type { Y } from './y';
          import { helper } from './helper';
          export type X = Y;
          export const value = helper();
          function local() { return <div />; }
          export { local, local as alias };
        `
      )
    ).toEqual([]);
  });
});

describe('readPackageEntries', () => {
  test('maps exports, source conditions and explicit tsdown entries to sources', async () => {
    const repositoryRoot = await createRepository({
      'packages/pkg/package.json': JSON.stringify({
        name: 'pkg',
        main: 'dist/index.cjs',
        exports: {
          '.': {
            source: './src/index.tsx',
            import: {
              types: './dist/index.d.mts',
              default: './dist/index.mjs',
            },
          },
          './client': './dist/client/index.js',
          './data.json': './data.json',
        },
      }),
      'packages/pkg/tsdown.config.mts': `
        const entries = { macros: 'src/macros.ts' };
        createTsdownConfig(['src/rsc.ts'], { neverBundle: ['src/deps.ts'] });
        export default {
          entry: ['src/types.ts', 'src/**/*.ts', 'src/missing.ts'],
          watch: ['src/watched.ts'],
        };
      `,
      'packages/pkg/src/macros.ts': '',
      'packages/pkg/src/rsc.ts': '',
      'packages/pkg/src/deps.ts': '',
      'packages/pkg/src/watched.ts': '',
      'packages/pkg/src/index.tsx': '',
      'packages/pkg/src/client/index.ts': '',
      'packages/pkg/src/types.ts': '',
      'packages/pkg/src/internal.ts': '',
    });

    const { name, entries } = readPackageEntries(repositoryRoot, 'pkg');

    expect(name).toBe('pkg');
    expect(entries.sort()).toEqual([
      'packages/pkg/src/client/index.ts',
      'packages/pkg/src/index.tsx',
      'packages/pkg/src/macros.ts',
      'packages/pkg/src/rsc.ts',
      'packages/pkg/src/types.ts',
    ]);
  });
});

describe('validateRepository', () => {
  const exportsMap = { '.': './dist/index.js' };

  test('allows entries to re-export their own modules and facades their owners', async () => {
    const repositoryRoot = await createRepository({
      'packages/core/package.json': manifest('core', exportsMap),
      'packages/core/src/index.ts': `
        export { a } from './a';
        export { format } from 'format';
      `,
      'packages/core/src/a.ts': 'export const a = 1;',
    });

    const result = validateRepository({
      repositoryRoot,
      facades: { core: ['format'] },
      exceptions: [],
    });

    expect(result.violations).toEqual([]);
    expect(result).toMatchObject({ entryCount: 1, sourceFileCount: 2 });
  });

  test('rejects internal barrels and cross-package re-exports from non-facades', async () => {
    const repositoryRoot = await createRepository({
      'packages/lib/package.json': manifest('lib', exportsMap),
      'packages/lib/src/index.ts': `
        export { other } from 'other';
        export { self } from 'lib/internal';
        export { x } from '../../other/src/index';
      `,
      'packages/lib/src/utils/index.ts': "export * from './helpers';",
      'packages/lib/src/utils/helpers.ts': `
        import { thing } from './thing';
        export { thing };
      `,
    });

    const result = validateRepository({
      repositoryRoot,
      facades: { core: ['other'] },
      exceptions: [],
    });

    expect(result.violations).toEqual([
      "packages/lib/src/index.ts:2:9 re-exports other from 'other', but lib is not a facade for other",
      "packages/lib/src/index.ts:4:9 re-exports x from '../../other/src/index', a path outside lib; re-export the owner package entry instead",
      "packages/lib/src/utils/helpers.ts:3:18 re-exports thing from './thing' outside a package entry",
      "packages/lib/src/utils/index.ts:1:1 re-exports * from './helpers' outside a package entry",
    ]);
  });

  test('rejects facade re-exports from packages outside its owner list', async () => {
    const repositoryRoot = await createRepository({
      'packages/react/package.json': manifest('react-facade', exportsMap),
      'packages/react/src/index.ts': "export { t } from 'unlisted';",
    });

    const result = validateRepository({
      repositoryRoot,
      facades: { 'react-facade': ['owner'] },
      exceptions: [],
    });

    expect(result.violations).toHaveLength(1);
  });

  test('skips tests, generated directories and named exceptions', async () => {
    const repositoryRoot = await createRepository({
      'packages/api/package.json': manifest('api', exportsMap),
      'packages/api/src/index.ts': '',
      'packages/api/src/generated/index.ts': "export * from './client';",
      'packages/api/src/__tests__/a.test.ts': "export * from '../a';",
      'packages/api/src/b.test.ts': "export * from './a';",
      'packages/api/src/shared.ts': "export { a } from './a';",
    });

    const result = validateRepository({
      repositoryRoot,
      facades: {},
      exceptions: [{ path: 'packages/api/src/shared.ts', reason: 'Shared.' }],
    });

    expect(result.violations).toEqual([]);
    expect(result.sourceFileCount).toBe(2);
  });

  test('rejects exceptions without a reason or a file', async () => {
    const repositoryRoot = await createRepository({
      'packages/api/package.json': manifest('api', exportsMap),
      'packages/api/src/index.ts': '',
    });

    expect(() =>
      validateRepository({
        repositoryRoot,
        exceptions: [{ path: 'packages/api/src/index.ts', reason: '' }],
      })
    ).toThrow('needs a reason');
    expect(() =>
      validateRepository({
        repositoryRoot,
        exceptions: [{ path: 'packages/api/src/gone.ts', reason: 'Gone.' }],
      })
    ).toThrow('does not exist');
  });
});

describe('run', () => {
  test('prints each violation and fails', async () => {
    const repositoryRoot = await createRepository({
      'packages/lib/package.json': manifest('lib', { '.': './dist/index.js' }),
      'packages/lib/src/index.ts': '',
      'packages/lib/src/barrel.ts': "export * from './a';",
      ...Object.fromEntries(
        entryExceptions.map((exception) => [exception.path, ''])
      ),
    });
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(run(repositoryRoot)).toBe(1);
    expect(stderr.mock.calls.map(([line]) => line)).toContain(
      "- packages/lib/src/barrel.ts:1:1 re-exports * from './a' outside a package entry"
    );
  });
});
