import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import os from 'node:os';
import {
  readLockfile,
  writeLockfile,
  findEntry,
  findOrCreateEntry,
  DownloadedVersionEntry,
} from '../downloadedVersions.js';
import { createMockSettings } from '../../../api/__mocks__/settings.js';

describe('readLockfile / writeLockfile', () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'lockfile-'))
    );
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const writeLockFile = (content: Record<string, unknown>) => {
    fs.writeFileSync(
      path.join(tempDir, 'gt-lock.json'),
      JSON.stringify(content, null, 2)
    );
  };

  const readLockFile = () => {
    return JSON.parse(
      fs.readFileSync(path.join(tempDir, 'gt-lock.json'), 'utf8')
    );
  };

  const settings = (branchId?: string) =>
    createMockSettings({ _branchId: branchId });

  describe('readLockfile', () => {
    it('returns empty v2 when no lockfile exists', () => {
      const { data, originalV1 } = readLockfile(settings('brc_123'));

      expect(data.version).toBe(2);
      expect(data.branchId).toBe('brc_123');
      expect(data.entries).toEqual([]);
      expect(originalV1).toBeNull();
    });

    it('reads a v2 lockfile directly', () => {
      writeLockFile({
        version: 2,
        branchId: 'brc_abc',
        entries: [
          {
            fileId: 'f1',
            versionId: 'v1',
            translations: {
              es: { updatedAt: '2025-01-01T00:00:00Z' },
            },
          },
        ],
      });

      const { data, originalV1 } = readLockfile(settings('brc_abc'));

      expect(data.version).toBe(2);
      expect(data.entries).toHaveLength(1);
      expect(data.entries[0].fileId).toBe('f1');
      expect(data.entries[0].translations.es.updatedAt).toBe(
        '2025-01-01T00:00:00Z'
      );
      expect(originalV1).toBeNull();
    });

    it('updates branchId on v2 file to current branch', () => {
      writeLockFile({
        version: 2,
        branchId: 'brc_old',
        entries: [],
      });

      const { data } = readLockfile(settings('brc_new'));

      expect(data.branchId).toBe('brc_new');
    });

    it('converts v1 lockfile to v2 for the current branch', () => {
      writeLockFile({
        version: 1,
        entries: {
          brc_main: {
            file1: {
              ver1: {
                ja: {
                  updatedAt: '2025-01-01T00:00:00Z',
                  postProcessHash: 'hash123',
                },
              },
            },
          },
        },
      });

      const { data, originalV1 } = readLockfile(settings('brc_main'));

      expect(data.version).toBe(2);
      expect(data.branchId).toBe('brc_main');
      expect(data.entries).toHaveLength(1);
      expect(data.entries[0].fileId).toBe('file1');
      expect(data.entries[0].versionId).toBe('ver1');
      expect(data.entries[0].translations.ja.postProcessHash).toBe('hash123');
      expect(originalV1).not.toBeNull();
    });

    it('picks latest versionId when v1 has multiple versions per file', () => {
      writeLockFile({
        version: 1,
        entries: {
          brc_main: {
            file1: {
              old_ver: {
                ja: { updatedAt: '2024-01-01T00:00:00Z' },
              },
              new_ver: {
                ja: { updatedAt: '2025-06-01T00:00:00Z' },
              },
            },
          },
        },
      });

      const { data } = readLockfile(settings('brc_main'));

      expect(data.entries[0].versionId).toBe('new_ver');
    });

    it('falls back to first branch when branchId is not set', () => {
      writeLockFile({
        version: 1,
        entries: {
          brc_only: {
            file1: {
              ver1: {
                en: { updatedAt: '2025-01-01T00:00:00Z' },
              },
            },
          },
        },
      });

      const { data } = readLockfile(settings()); // no branchId

      expect(data.entries).toHaveLength(1);
      expect(data.entries[0].fileId).toBe('file1');
    });
  });

  describe('writeLockfile', () => {
    it('writes v2 format when originalV1 is null', () => {
      const data = {
        version: 2 as const,
        branchId: 'brc_123',
        entries: [
          {
            fileId: 'f1',
            versionId: 'v1',
            translations: {
              es: { updatedAt: '2025-01-01T00:00:00Z' },
            },
          },
        ],
      };

      writeLockfile(data, null);

      const written = readLockFile();
      expect(written.version).toBe(2);
      expect(written.branchId).toBe('brc_123');
      expect(written.entries).toHaveLength(1);
    });

    it('writes v1 format when originalV1 is provided, preserving other branches', () => {
      const originalV1 = {
        version: 1,
        entries: {
          brc_other: {
            otherFile: {
              otherVer: {
                fr: { updatedAt: '2025-01-01T00:00:00Z' },
              },
            },
          },
          brc_main: {
            oldFile: {
              oldVer: {
                ja: { updatedAt: '2024-01-01T00:00:00Z' },
              },
            },
          },
        },
      };

      const data = {
        version: 2 as const,
        branchId: 'brc_main',
        entries: [
          {
            fileId: 'newFile',
            versionId: 'newVer',
            translations: {
              ja: { updatedAt: '2025-06-01T00:00:00Z' },
            },
          },
        ],
      };

      writeLockfile(data, originalV1);

      const written = readLockFile();
      // Should be v1 format
      expect(written.version).toBe(1);
      // Other branch should be preserved
      expect(written.entries.brc_other).toBeDefined();
      expect(written.entries.brc_other.otherFile).toBeDefined();
      // Current branch should be updated
      expect(written.entries.brc_main.newFile.newVer.ja.updatedAt).toBe(
        '2025-06-01T00:00:00Z'
      );
      // Old data for current branch should be replaced
      expect(written.entries.brc_main.oldFile).toBeUndefined();
    });
  });

  describe('round-trip: read v1, mutate, write back', () => {
    it('preserves other branches after a full read-mutate-write cycle', () => {
      writeLockFile({
        version: 1,
        entries: {
          brc_main: {
            file1: {
              ver1: {
                ja: { updatedAt: '2025-01-01T00:00:00Z' },
              },
            },
          },
          brc_feature: {
            file2: {
              ver2: {
                fr: { updatedAt: '2025-02-01T00:00:00Z' },
              },
            },
          },
        },
      });

      // Read as v2
      const { data, originalV1 } = readLockfile(settings('brc_main'));

      // Mutate — add a translation
      const entry = findOrCreateEntry(data.entries, 'file1', 'ver1');
      entry.translations.es = { updatedAt: '2025-06-01T00:00:00Z' };

      // Write back
      writeLockfile(data, originalV1);

      // Verify
      const written = readLockFile();
      expect(written.version).toBe(1);
      // New translation added
      expect(written.entries.brc_main.file1.ver1.es.updatedAt).toBe(
        '2025-06-01T00:00:00Z'
      );
      // Original translation preserved
      expect(written.entries.brc_main.file1.ver1.ja.updatedAt).toBe(
        '2025-01-01T00:00:00Z'
      );
      // Other branch untouched
      expect(written.entries.brc_feature.file2.ver2.fr.updatedAt).toBe(
        '2025-02-01T00:00:00Z'
      );
    });
  });

  describe('lookup helpers', () => {
    it('findEntry returns the matching entry', () => {
      const entries = [
        { fileId: 'a', versionId: 'v1', translations: {} },
        { fileId: 'b', versionId: 'v2', translations: {} },
      ];

      expect(findEntry(entries, 'b')?.versionId).toBe('v2');
      expect(findEntry(entries, 'c')).toBeUndefined();
    });

    it('findOrCreateEntry creates a new entry if not found', () => {
      const entries: DownloadedVersionEntry[] = [];

      const entry = findOrCreateEntry(entries, 'f1', 'v1');

      expect(entries).toHaveLength(1);
      expect(entry.fileId).toBe('f1');
      expect(entry.versionId).toBe('v1');
      expect(entry.translations).toEqual({});
    });

    it('findOrCreateEntry returns existing entry if found', () => {
      const entries = [
        { fileId: 'f1', versionId: 'v1', translations: { ja: { updatedAt: 'x' } } },
      ];

      const entry = findOrCreateEntry(entries, 'f1', 'v1');

      expect(entries).toHaveLength(1);
      expect(entry.translations.ja).toEqual({ updatedAt: 'x' });
    });
  });
});
