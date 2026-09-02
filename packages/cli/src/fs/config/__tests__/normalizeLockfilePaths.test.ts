import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hashStringSync } from '../../../utils/hash.js';
import {
  type DownloadedVersions,
  normalizeLockfilePaths,
} from '../downloadedVersions.js';

function lockfile(fileId: string, fileName: string): DownloadedVersions {
  return {
    version: 2,
    branchId: 'brc_test',
    entries: [
      {
        fileId,
        versionId: 'v1',
        fileName,
        translations: {
          es: { fileName: 'content\\es\\page.mdx' },
        },
      },
    ],
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('normalizeLockfilePaths', () => {
  it('normalizes source and translation paths from any host platform', () => {
    const data = lockfile('opaque-id', 'src\\content\\page.mdx');

    normalizeLockfilePaths(data);

    expect(data.entries[0]).toMatchObject({
      fileId: 'opaque-id',
      fileName: 'src/content/page.mdx',
      translations: {
        es: { fileName: 'content/es/page.mdx' },
      },
    });
  });

  it('re-keys a legacy ID derived from the backslash path', () => {
    const windowsPath = 'src\\content\\page.mdx';
    const data = lockfile(hashStringSync(windowsPath), windowsPath);

    normalizeLockfilePaths(data);
    normalizeLockfilePaths(data);

    expect(data.entries[0]).toMatchObject({
      fileId: hashStringSync('src/content/page.mdx'),
      previousFileId: hashStringSync(windowsPath),
      fileName: 'src/content/page.mdx',
    });
  });

  it('does not create a duplicate ID when both path styles exist', () => {
    const windowsPath = 'src\\content\\page.mdx';
    const portablePath = 'src/content/page.mdx';
    const data = lockfile(hashStringSync(windowsPath), windowsPath);
    data.entries.push({
      fileId: hashStringSync(portablePath),
      versionId: 'v1',
      fileName: portablePath,
      translations: {},
    });

    normalizeLockfilePaths(data);

    expect(data.entries.map((entry) => entry.fileId)).toEqual([
      hashStringSync(windowsPath),
      hashStringSync(portablePath),
    ]);
    expect(data.entries[0].fileName).toBe(windowsPath);
  });

  it('preserves POSIX paths containing literal backslashes', () => {
    const literalPath = 'src/literal\\page.mdx';
    const data = lockfile(hashStringSync(literalPath), literalPath);
    data.entries[0].translations.es.fileName = 'content/es/literal\\page.mdx';

    normalizeLockfilePaths(data);

    expect(data.entries[0]).toEqual({
      fileId: hashStringSync(literalPath),
      versionId: 'v1',
      fileName: literalPath,
      translations: {
        es: { fileName: 'content/es/literal\\page.mdx' },
      },
    });
  });

  it('preserves an existing all-backslash POSIX filename', () => {
    const literalPath = 'literal\\page.mdx';
    const data = lockfile(hashStringSync(literalPath), literalPath);
    vi.spyOn(fs, 'existsSync').mockImplementation(
      (candidate) => candidate === path.resolve(literalPath)
    );

    normalizeLockfilePaths(data);

    expect(data.entries[0]).toMatchObject({
      fileId: hashStringSync(literalPath),
      fileName: literalPath,
    });
  });

  it('leaves portable paths and their IDs unchanged', () => {
    const portablePath = 'src/content/page.mdx';
    const data = lockfile(hashStringSync(portablePath), portablePath);
    data.entries[0].translations.es.fileName = 'content/es/page.mdx';

    normalizeLockfilePaths(data);

    expect(data.entries[0]).toEqual({
      fileId: hashStringSync(portablePath),
      versionId: 'v1',
      fileName: portablePath,
      translations: {
        es: { fileName: 'content/es/page.mdx' },
      },
    });
  });
});
