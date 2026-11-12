import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'node:path';
import { clearLocaleDirs } from '../clearLocaleDirs.js';

describe('clearLocaleDirs', () => {
  let testDir: string;
  const inTestDir = (file: string) => path.join(testDir, ...file.split('/'));

  /** Writes the files and returns their absolute paths, as the CLI passes them. */
  async function writeFiles(files: string[]): Promise<Set<string>> {
    for (const file of files) {
      await fs.mkdir(path.dirname(inTestDir(file)), { recursive: true });
      await fs.writeFile(inTestDir(file), 'content');
    }
    return new Set(files.map(inTestDir));
  }

  /** Every remaining file and empty directory, relative to the test directory. */
  async function remaining(): Promise<string[]> {
    const entries = await fs.readdir(testDir, {
      recursive: true,
      withFileTypes: true,
    });
    const directories = entries.filter((entry) => entry.isDirectory());
    const files = entries.filter((entry) => !entry.isDirectory());
    const toRelative = (entry: (typeof entries)[number]) =>
      path
        .relative(testDir, path.join(entry.parentPath, entry.name))
        .split(path.sep)
        .join('/');
    const filePaths = files.map(toRelative);
    const emptyDirectories = directories
      .map(toRelative)
      .filter(
        (directory) =>
          !filePaths.some((file) => file.startsWith(`${directory}/`)) &&
          !directories.some((other) =>
            toRelative(other).startsWith(`${directory}/`)
          )
      )
      .map((directory) => `${directory}/`);
    return [...filePaths, ...emptyDirectories].sort();
  }

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'clear-locale-test-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('deletes each locale directory with everything in it and nothing else', async () => {
    const filePaths = await writeFiles([
      'snippets/es/file1.mdx',
      'snippets/es/file2.mdx',
      'snippets/es/api-test/introduction.mdx',
      'snippets/fr/file.mdx',
      'snippets/shared.mdx',
      'docs/v2/de/guides/advanced/chapter1.mdx',
      'content/zh-CN/file.mdx',
      'content/pt-BR/file.mdx',
      // No path segment is a locale, so this directory is left alone.
      'components/button/file.tsx',
    ]);
    // A file the caller did not list is still removed with its locale directory.
    await writeFiles(['snippets/es/untracked.mdx']);

    await clearLocaleDirs(filePaths, ['es', 'fr', 'de', 'zh-CN', 'pt-BR']);

    expect(await remaining()).toEqual([
      'components/button/file.tsx',
      'content/',
      'docs/v2/',
      'snippets/shared.mdx',
    ]);
  });

  it('ignores locale directories that no longer exist', async () => {
    await expect(
      clearLocaleDirs(new Set([inTestDir('snippets/es/file.mdx')]), ['es'])
    ).resolves.toBeUndefined();
  });

  describe('with exclude patterns', () => {
    it('keeps files matching [locale] patterns and removes emptied directories', async () => {
      const filePaths = await writeFiles([
        'content/es/file1.mdx',
        'content/es/intro.mdx',
        'content/es/exact.mdx',
        'content/es/keep-this.mdx',
        'content/es/keep-that.mdx',
        'content/es/preserved/keep-me.mdx',
        'content/es/static/logo.png',
        'content/es/will-be-empty/file.mdx',
        'content/fr/file2.mdx',
        'content/fr/preserved/keep-me.mdx',
      ]);

      await clearLocaleDirs(
        filePaths,
        ['es', 'fr'],
        [
          inTestDir('content/[locale]/preserved/**'),
          inTestDir('content/[locale]/static/**'),
          inTestDir('content/[locale]/keep-*.mdx'),
          inTestDir('content/[locale]/exact.mdx'),
        ]
      );

      expect(await remaining()).toEqual([
        'content/es/exact.mdx',
        'content/es/keep-that.mdx',
        'content/es/keep-this.mdx',
        'content/es/preserved/keep-me.mdx',
        'content/es/static/logo.png',
        'content/fr/preserved/keep-me.mdx',
      ]);
    });

    it('resolves relative [locales] patterns against the working directory for every locale', async () => {
      const filePaths = await writeFiles([
        'content/es/file1.mdx',
        'content/es/static/keep-es.png',
        'content/fr/file2.mdx',
        'content/fr/static/keep-fr.png',
      ]);

      await clearLocaleDirs(
        filePaths,
        ['es', 'fr'],
        ['content/[locales]/static/**'],
        testDir
      );

      expect(await remaining()).toEqual([
        'content/es/static/keep-es.png',
        'content/fr/static/keep-fr.png',
      ]);
    });
  });
});
