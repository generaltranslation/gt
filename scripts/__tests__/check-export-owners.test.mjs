import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { validateWorkspace } from '../check-export-owners.mjs';

const temporaryRoots = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true }))
  );
});

async function createWorkspace(files, links = {}) {
  const repositoryRoot = await mkdtemp(path.join(tmpdir(), 'check-owners-'));
  temporaryRoots.push(repositoryRoot);
  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = path.join(repositoryRoot, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, contents);
  }
  // Workspace packages resolve each other through node_modules symlinks.
  for (const [from, packageNames] of Object.entries(links)) {
    for (const packageName of packageNames) {
      const link = path.join(
        repositoryRoot,
        'packages',
        from,
        'node_modules',
        packageName
      );
      await mkdir(path.dirname(link), { recursive: true });
      await symlink(path.join(repositoryRoot, 'packages', packageName), link);
    }
  }
  return repositoryRoot;
}

const manifest = (name, subpaths) =>
  JSON.stringify({
    name,
    exports: Object.fromEntries(
      Object.entries(subpaths).map(([subpath, file]) => [
        subpath,
        { types: file },
      ])
    ),
  });

const ownerAndFacade = {
  'packages/owner/package.json': manifest('owner', {
    '.': './dist/index.d.ts',
    './extra': './dist/extra.d.ts',
  }),
  'packages/owner/dist/index.d.ts':
    "export declare const one: number;\nexport { two } from './extra';\n",
  'packages/owner/dist/extra.d.ts': 'export declare const two: number;\n',
  'packages/facade/package.json': manifest('facade', {
    '.': './dist/index.d.ts',
  }),
  'packages/facade/dist/index.d.ts':
    "export { one } from 'owner';\nexport declare const own: number;\n",
};

describe('validateWorkspace', () => {
  test('reports a declaration exported from two subpaths', async () => {
    const repositoryRoot = await createWorkspace(ownerAndFacade, {
      facade: ['owner'],
    });

    expect(
      validateWorkspace({ repositoryRoot, duplicates: [], imports: [] })
        .violations
    ).toEqual([
      'owner exports one declaration as two from . and two from ./extra; export it from one subpath',
    ]);
    expect(
      validateWorkspace({
        repositoryRoot,
        duplicates: [
          {
            packageName: 'owner',
            subpaths: ['.', './extra'],
            names: ['two'],
            reason: 'test',
          },
        ],
        imports: [],
      }).violations
    ).toEqual([]);
  });

  test('reports a renamed export of the same declaration', async () => {
    const repositoryRoot = await createWorkspace({
      ...ownerAndFacade,
      'packages/owner/dist/index.d.ts':
        "export declare const one: number;\nexport { two as renamed } from './extra';\n",
    });

    expect(
      validateWorkspace({ repositoryRoot, duplicates: [], imports: [] })
        .violations
    ).toEqual([
      'owner exports one declaration as renamed from . and two from ./extra; export it from one subpath',
    ]);
  });

  test('checks every export condition of a subpath', async () => {
    const repositoryRoot = await createWorkspace({
      'packages/cond/package.json': JSON.stringify({
        name: 'cond',
        exports: {
          '.': {
            'react-server': { types: './dist/rsc.d.ts' },
            default: { types: './dist/index.d.ts' },
          },
          './server': { types: './dist/server.d.ts' },
        },
      }),
      'packages/cond/dist/index.d.ts': 'export declare const other: number;\n',
      'packages/cond/dist/rsc.d.ts': "export { only } from './server';\n",
      'packages/cond/dist/server.d.ts': 'export declare const only: number;\n',
    });

    expect(
      validateWorkspace({ repositoryRoot, duplicates: [], imports: [] })
        .violations
    ).toEqual([
      'cond exports one declaration as only from . and only from ./server; export it from one subpath',
    ]);
  });

  test('reports a first-party import through a package that is not the owner', async () => {
    const repositoryRoot = await createWorkspace(
      {
        ...ownerAndFacade,
        'packages/app/package.json': manifest('app', {}),
        'packages/app/src/index.ts': `
import { one } from 'facade';
import { own } from 'facade';
import { one as direct } from 'owner';
export { one } from 'facade';
`,
        'packages/app/src/__fixtures__/user.ts':
          "import { one } from 'facade';",
      },
      { facade: ['owner'], app: ['owner', 'facade'] }
    );
    const duplicates = [
      {
        packageName: 'owner',
        subpaths: ['.', './extra'],
        names: '*',
        reason: 'test',
      },
    ];

    expect(
      validateWorkspace({ repositoryRoot, duplicates, imports: [] }).violations
    ).toEqual([
      "packages/app/src/index.ts:2:1 imports one from 'facade', but owner defines it; import it from owner",
      "packages/app/src/index.ts:5:1 imports one from 'facade', but owner defines it; import it from owner",
    ]);
    expect(
      validateWorkspace({
        repositoryRoot,
        duplicates,
        imports: [
          { importers: ['app'], via: 'facade', owner: 'owner', reason: 'test' },
        ],
      }).violations
    ).toEqual([]);
    expect(
      validateWorkspace({
        repositoryRoot,
        duplicates,
        imports: [
          { importers: ['app'], via: 'facade', owner: 'other', reason: 'test' },
        ],
      }).violations
    ).toHaveLength(2);
  });

  test('skips packages whose declarations are not built', async () => {
    const repositoryRoot = await createWorkspace({
      'packages/unbuilt/package.json': manifest('unbuilt', {
        '.': './dist/index.d.ts',
      }),
    });

    expect(
      validateWorkspace({ repositoryRoot, duplicates: [], imports: [] })
    ).toEqual({
      checkedPackageCount: 0,
      skippedPackages: ['unbuilt'],
      violations: [],
    });
  });

  test('requires a reason for every exception', () => {
    expect(() =>
      validateWorkspace({
        duplicates: [{ packageName: 'x', subpaths: [], names: '*' }],
      })
    ).toThrow('Every exception needs a reason');
  });
});
