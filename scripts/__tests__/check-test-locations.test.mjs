import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  findMisplacedTestFiles,
  isMisplacedTestFile,
  listRepositoryFiles,
  run,
} from '../check-test-locations.mjs';

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
    path.join(tmpdir(), 'check-test-locations-')
  );
  temporaryRoots.push(repositoryRoot);
  execFileSync('git', ['init', '-q'], { cwd: repositoryRoot });

  await Promise.all(
    Object.entries(files).map(async ([relativePath, contents]) => {
      const absolutePath = path.join(repositoryRoot, relativePath);
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, contents);
    })
  );

  return repositoryRoot;
}

describe('isMisplacedTestFile', () => {
  test.each([
    'packages/core/src/__tests__/locale.test.ts',
    'packages/react/src/__tests__/T.test.tsx',
    'scripts/__tests__/check.test.mjs',
    'packages/sanity/src/__tests__/nested/deep.test.ts',
    'packages/sanity/src/__tests__/__snapshots__/deep.test.ts.snap',
    'packages/core/src/locale.ts',
    'packages/core/src/testing.ts',
    'packages/core/src/test/helpers.ts',
    'tests/apps/next/e2e/main.spec.ts',
  ])('allows %s', (relativePath) => {
    expect(isMisplacedTestFile(relativePath)).toBe(false);
  });

  test.each([
    'packages/core/src/locale.test.ts',
    'packages/react/src/T.test.tsx',
    'scripts/check.test.mjs',
    'locale.test.ts',
    'tools/app/test/report.test.ts',
    'packages/core/src/__tests__.test.ts',
    'packages/core/src/not__tests__/locale.test.ts',
    'packages\\core\\src\\locale.test.ts',
  ])('rejects %s', (relativePath) => {
    expect(isMisplacedTestFile(relativePath)).toBe(true);
  });

  test('accepts Windows separators inside __tests__', () => {
    expect(isMisplacedTestFile('packages\\core\\__tests__\\a.test.ts')).toBe(
      false
    );
  });
});

describe('findMisplacedTestFiles', () => {
  test('returns only misplaced files, sorted', () => {
    expect(
      findMisplacedTestFiles([
        'b/b.test.ts',
        'a/__tests__/a.test.ts',
        'a/a.test.ts',
        'a/a.ts',
      ])
    ).toEqual(['a/a.test.ts', 'b/b.test.ts']);
  });
});

describe('run', () => {
  test('passes when every test is inside __tests__', async () => {
    const repositoryRoot = await createRepository({
      'src/__tests__/a.test.ts': '',
      'src/a.ts': '',
    });
    const stdout = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    expect(run(repositoryRoot)).toBe(0);
    expect(stdout).toHaveBeenCalledWith(
      expect.stringContaining('(2 files checked)')
    );
  });

  test('fails and lists untracked misplaced tests', async () => {
    const repositoryRoot = await createRepository({
      'src/__tests__/a.test.ts': '',
      'src/b.test.ts': '',
      'scripts/c.test.mjs': '',
    });
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(run(repositoryRoot)).toBe(1);
    const lines = stderr.mock.calls.map(([line]) => line);
    expect(lines).toContain('- scripts/c.test.mjs');
    expect(lines).toContain('- src/b.test.ts');
    expect(lines).not.toContain('- src/__tests__/a.test.ts');
  });

  test('ignores gitignored files', async () => {
    const repositoryRoot = await createRepository({
      '.gitignore': 'node_modules\n',
      'node_modules/pkg/index.test.js': '',
    });

    expect(listRepositoryFiles(repositoryRoot)).toEqual(['.gitignore']);
  });
});
