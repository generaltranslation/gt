import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  collectBinShimEntryPaths,
  collectEntryPaths,
  entrySourceStems,
  findUnexportedSourceRootFiles,
  findViolations,
  run,
  stripExtension,
} from '../check-src-entry-points.mjs';

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
  const repositoryRoot = await mkdtemp(
    path.join(tmpdir(), 'check-src-entry-points-')
  );
  temporaryRoots.push(repositoryRoot);
  execFileSync('git', ['init', '-q'], { cwd: repositoryRoot });

  await Promise.all(
    Object.entries(files).map(async ([relativePath, contents]) => {
      const absolutePath = path.join(repositoryRoot, relativePath);
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(
        absolutePath,
        typeof contents === 'string' ? contents : JSON.stringify(contents)
      );
    })
  );

  return repositoryRoot;
}

describe('stripExtension', () => {
  test.each([
    ['index.ts', 'index'],
    ['index.tsx', 'index'],
    ['index.server.mjs', 'index.server'],
    ['index.d.cts', 'index'],
    ['index.d.ts', 'index'],
    ['wasm.d.ts', 'wasm'],
    ['index.min.cjs', 'index'],
    ['utils/helper.ts', 'utils/helper'],
  ])('%s -> %s', (fileName, stem) => {
    expect(stripExtension(fileName)).toBe(stem);
  });
});

describe('entrySourceStems', () => {
  test.each([
    ['./dist/index.mjs', ['index']],
    ['./dist/index.d.cts', ['index']],
    ['dist/cli.js', ['cli']],
    ['./src/index.tsx', ['index']],
    ['./dist/module/index.js', ['module/index', 'index']],
    ['./dist/commonjs/index.js', ['commonjs/index', 'index']],
    ['./dist/src/index.d.ts', ['src/index', 'index']],
    ['./dist/client/index.js', ['client/index']],
    [
      './dist/internal/initializeGT.server.mjs',
      ['internal/initializeGT.server'],
    ],
    ['./dist/index.min.js', ['index']],
    ['./dist/openapi.json', []],
    ['./dist/parser.wasm', []],
    ['./dist/*.js', ['*']],
    ['./dist/utils/*.js', ['utils/*']],
    ['./package.json', []],
    ['./spec/openapi.json', []],
    ['bin/main.js', []],
  ])('%s', (entryPath, stems) => {
    expect(entrySourceStems(entryPath)).toEqual(stems);
  });
});

describe('collectEntryPaths', () => {
  test('reads every entry field, including nested conditions', () => {
    expect(
      collectEntryPaths({
        name: 'pkg',
        main: 'dist/index.cjs',
        bin: { tool: 'dist/cli.js' },
        exports: {
          '.': {
            browser: { import: './dist/index.client.mjs' },
            default: './dist/index.server.mjs',
          },
        },
        typesVersions: { '*': { types: ['./dist/types.d.cts'] } },
        files: ['dist/other.js'],
      })
    ).toEqual([
      'dist/index.cjs',
      'dist/cli.js',
      './dist/index.client.mjs',
      './dist/index.server.mjs',
      './dist/types.d.cts',
    ]);
  });
});

describe('collectBinShimEntryPaths', () => {
  test('returns the built files a bin shim imports', () => {
    const files = {
      'bin/main.js': "#!/usr/bin/env node\nimport '../dist/main.js';\n",
      'bin/other.cjs': "require('../dist/other.cjs');\n",
    };
    expect(
      collectBinShimEntryPaths(
        {
          bin: {
            a: 'bin/main.js',
            b: './bin/other.cjs',
            c: 'dist/cli.js',
            d: 'bin/missing.js',
          },
        },
        (file) => files[file]
      )
    ).toEqual(['dist/main.js', 'dist/other.cjs']);
  });

  test.each([
    ["await import('../dist/main.js');\n", ['dist/main.js']],
    ["export * from '../dist/main.js';\n", ['dist/main.js']],
    [
      "// import '../dist/old.js';\nimport '../dist/main.js';\n",
      ['dist/main.js'],
    ],
    ["/* require('../dist/old.cjs'); */\n", []],
    ["const name = 'import \\'../dist/old.js\\'';\n", []],
    ["import 'some-package';\n", []],
  ])('reads module references from the shim syntax: %j', (shim, entries) => {
    expect(
      collectBinShimEntryPaths({ bin: 'bin/main.js' }, () => shim)
    ).toEqual(entries);
  });
});

describe('findUnexportedSourceRootFiles', () => {
  test('allows root files that back an entry and ignores nested files', () => {
    expect(
      findUnexportedSourceRootFiles({
        packageJson: {
          exports: {
            '.': {
              react: { types: './dist/index.types.d.ts' },
              default: './dist/index.server.js',
            },
            './plugin': './dist/module/plugin.js',
          },
          bin: { tool: './dist/cli.js' },
        },
        sourceFiles: [
          'index.types.ts',
          'index.server.ts',
          'plugin.ts',
          'cli.ts',
          'helpers.ts',
          'types.ts',
          'utils/helpers.ts',
          '__tests__/index.test.ts',
        ],
      })
    ).toEqual(['helpers.ts', 'types.ts']);
  });

  test('resolves a nested entry to its nested source before the root', () => {
    expect(
      findUnexportedSourceRootFiles({
        packageJson: { exports: { './client': './dist/client/index.js' } },
        sourceFiles: ['client/index.ts', 'index.ts'],
      })
    ).toEqual(['index.ts']);
  });

  test('a root wildcard export covers every root file', () => {
    expect(
      findUnexportedSourceRootFiles({
        packageJson: { exports: { './*': './dist/*.js' } },
        sourceFiles: ['index.ts', 'main.ts'],
      })
    ).toEqual([]);
  });

  test('a nested wildcard export does not cover root files', () => {
    expect(
      findUnexportedSourceRootFiles({
        packageJson: { exports: { './utils/*': './dist/utils/*.js' } },
        sourceFiles: ['utils/a.ts', 'helper.ts'],
      })
    ).toEqual(['helper.ts']);
  });

  test('extra entry paths cover root files', () => {
    expect(
      findUnexportedSourceRootFiles({
        packageJson: { main: 'dist/index.js', bin: 'bin/main.js' },
        sourceFiles: ['index.ts', 'main.ts', 'helper.ts'],
        extraEntryPaths: ['dist/main.js'],
      })
    ).toEqual(['helper.ts']);
  });

  test.each([
    [
      'an asset output',
      { './openapi.json': './dist/openapi.json' },
      'openapi.ts',
    ],
    [
      'a nested entry outside an output-format directory',
      {
        './internal/initializeGT.server':
          './dist/internal/initializeGT.server.mjs',
      },
      'initializeGT.server.ts',
    ],
  ])('%s does not cover a root namesake', (_name, exports, rootFile) => {
    expect(
      findUnexportedSourceRootFiles({
        packageJson: { main: 'dist/index.js', exports },
        sourceFiles: ['index.ts', rootFile],
      })
    ).toEqual([rootFile]);
  });

  test('declaration files must also back an entry', () => {
    expect(
      findUnexportedSourceRootFiles({
        packageJson: { main: 'dist/index.js' },
        sourceFiles: ['index.ts', 'wasm.d.ts'],
      })
    ).toEqual(['wasm.d.ts']);
  });
});

describe('run', () => {
  test('passes when every root file is an entry point', async () => {
    const repositoryRoot = await createRepository({
      'packages/a/package.json': { exports: { '.': './dist/index.js' } },
      'packages/a/src/index.ts': '',
      'packages/a/src/utils/helper.ts': '',
    });
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    expect(run(repositoryRoot)).toBe(0);
  });

  test('fails and lists untracked root files that are not entry points', async () => {
    const repositoryRoot = await createRepository({
      'packages/a/package.json': { exports: { '.': './dist/index.js' } },
      'packages/a/src/index.ts': '',
      'packages/a/src/helper.ts': '',
      'packages/b/package.json': { main: 'dist/index.js' },
      'packages/b/src/index.ts': '',
      'packages/b/src/types.ts': '',
    });
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(run(repositoryRoot)).toBe(1);
    const lines = stderr.mock.calls.map(([line]) => line);
    expect(lines).toContain('- packages/a/src/helper.ts');
    expect(lines).toContain('- packages/b/src/types.ts');
    expect(lines).not.toContain('- packages/a/src/index.ts');
  });

  test('accepts a root file imported by a bin shim', async () => {
    const repositoryRoot = await createRepository({
      'packages/a/package.json': { main: 'dist/index.js', bin: 'bin/main.js' },
      'packages/a/bin/main.js': "import '../dist/main.js';\n",
      'packages/a/src/index.ts': '',
      'packages/a/src/main.ts': '',
    });

    expect(findViolations(repositoryRoot)).toEqual([]);
  });

  test('skips tracked files deleted from the working tree and keeps untracked ones', async () => {
    const repositoryRoot = await createRepository({
      'packages/a/package.json': { main: 'dist/index.js' },
      'packages/a/src/index.ts': '',
      'packages/a/src/moved.ts': '',
    });
    execFileSync('git', ['add', '-A'], { cwd: repositoryRoot });
    await rm(path.join(repositoryRoot, 'packages/a/src/moved.ts'));
    await writeFile(path.join(repositoryRoot, 'packages/a/src/helper.ts'), '');

    expect(findViolations(repositoryRoot)).toEqual([
      'packages/a/src/helper.ts',
    ]);
  });

  test('ignores gitignored files', async () => {
    const repositoryRoot = await createRepository({
      '.gitignore': 'packages/a/src/generated.ts\n',
      'packages/a/package.json': { main: 'dist/index.js' },
      'packages/a/src/index.ts': '',
      'packages/a/src/generated.ts': '',
    });

    expect(findViolations(repositoryRoot)).toEqual([]);
  });
});
