import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import os from 'node:os';
import {
  readLockfile,
  writeLockfile,
  findOrCreateEntry,
  buildEntryMap,
  writeStagedEntries,
  getStagedEntriesFromLockfile,
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
      const { data, entryMap, originalV1 } = readLockfile(settings('brc_main'));

      // Mutate — add a translation
      const entry = findOrCreateEntry(entryMap, data.entries, 'file1', 'ver1');
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
    it('buildEntryMap provides O(1) lookup by fileId', () => {
      const entries: DownloadedVersionEntry[] = [
        { fileId: 'a', versionId: 'v1', translations: {} },
        { fileId: 'b', versionId: 'v2', translations: {} },
      ];
      const map = buildEntryMap(entries);

      expect(map.get('b')?.versionId).toBe('v2');
      expect(map.get('c')).toBeUndefined();
    });

    it('findOrCreateEntry creates a new entry if not found', () => {
      const entries: DownloadedVersionEntry[] = [];
      const map = buildEntryMap(entries);

      const entry = findOrCreateEntry(map, entries, 'f1', 'v1');

      expect(entries).toHaveLength(1);
      expect(entry.fileId).toBe('f1');
      expect(entry.versionId).toBe('v1');
      expect(entry.translations).toEqual({});
      expect(map.get('f1')).toBe(entry);
    });

    it('findOrCreateEntry returns existing entry if found', () => {
      const entries: DownloadedVersionEntry[] = [
        {
          fileId: 'f1',
          versionId: 'v1',
          translations: { ja: { updatedAt: 'x' } },
        },
      ];
      const map = buildEntryMap(entries);

      const entry = findOrCreateEntry(map, entries, 'f1', 'v1');

      expect(entries).toHaveLength(1);
      expect(entry.translations.ja).toEqual({ updatedAt: 'x' });
    });

    it('findOrCreateEntry replaces entry when versionId changes', () => {
      const entries: DownloadedVersionEntry[] = [
        {
          fileId: 'f1',
          versionId: 'v1',
          translations: { ja: { updatedAt: 'old' } },
        },
      ];
      const map = buildEntryMap(entries);

      const entry = findOrCreateEntry(map, entries, 'f1', 'v2');

      // Should replace, not append
      expect(entries).toHaveLength(1);
      expect(entry.versionId).toBe('v2');
      expect(entry.translations).toEqual({});
      // Map should return the updated entry
      expect(map.get('f1')?.versionId).toBe('v2');
    });
  });

  describe('writeStagedEntries', () => {
    it('writes staged entries to an empty lockfile', () => {
      writeStagedEntries(settings('brc_main'), [
        { fileId: 'f1', versionId: 'v1', fileName: 'src/page.mdx' },
        { fileId: 'f2', versionId: 'v2', fileName: 'src/other.mdx' },
      ]);

      const written = readLockFile();
      expect(written.version).toBe(2);
      expect(written.entries).toHaveLength(2);
      expect(written.entries[0]).toMatchObject({
        fileId: 'f1',
        versionId: 'v1',
        fileName: 'src/page.mdx',
        staged: true,
        translations: {},
      });
      expect(written.entries[1]).toMatchObject({
        fileId: 'f2',
        staged: true,
      });
    });

    it('preserves existing translations when versionId is unchanged', () => {
      writeLockFile({
        version: 2,
        branchId: 'brc_main',
        entries: [
          {
            fileId: 'f1',
            versionId: 'v1',
            fileName: 'src/page.mdx',
            translations: {
              es: { updatedAt: '2025-01-01T00:00:00Z', postProcessHash: 'h1' },
            },
          },
        ],
      });

      writeStagedEntries(settings('brc_main'), [
        { fileId: 'f1', versionId: 'v1', fileName: 'src/page.mdx' },
      ]);

      const written = readLockFile();
      expect(written.entries).toHaveLength(1);
      expect(written.entries[0].staged).toBe(true);
      // Existing translations preserved
      expect(written.entries[0].translations.es.updatedAt).toBe(
        '2025-01-01T00:00:00Z'
      );
      expect(written.entries[0].translations.es.postProcessHash).toBe('h1');
    });

    it('replaces entry and wipes translations when versionId changes', () => {
      writeLockFile({
        version: 2,
        branchId: 'brc_main',
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

      writeStagedEntries(settings('brc_main'), [
        { fileId: 'f1', versionId: 'v2', fileName: 'src/page.mdx' },
      ]);

      const written = readLockFile();
      expect(written.entries).toHaveLength(1);
      expect(written.entries[0].versionId).toBe('v2');
      expect(written.entries[0].staged).toBe(true);
      expect(written.entries[0].translations).toEqual({});
    });

    it('uses branchId parameter over settings._branchId', () => {
      writeStagedEntries(
        settings(), // no branchId in settings
        [{ fileId: 'f1', versionId: 'v1', fileName: 'en.json' }],
        'brc_from_workflow'
      );

      const written = readLockFile();
      expect(written.version).toBe(2);
      expect(written.branchId).toBe('brc_from_workflow');
      expect(written.entries[0].staged).toBe(true);
    });

    it('falls back to settings branchId when parameter is not provided', () => {
      writeStagedEntries(settings('brc_from_settings'), [
        { fileId: 'f1', versionId: 'v1', fileName: 'en.json' },
      ]);

      const written = readLockFile();
      expect(written.branchId).toBe('brc_from_settings');
    });

    it('does not clobber non-staged entries', () => {
      writeLockFile({
        version: 2,
        branchId: 'brc_main',
        entries: [
          {
            fileId: 'existing',
            versionId: 'v_existing',
            fileName: 'src/existing.mdx',
            translations: {
              es: { updatedAt: '2025-01-01T00:00:00Z' },
            },
          },
        ],
      });

      writeStagedEntries(settings('brc_main'), [
        { fileId: 'new', versionId: 'v_new', fileName: 'src/new.mdx' },
      ]);

      const written = readLockFile();
      expect(written.entries).toHaveLength(2);
      // Existing entry untouched (except staged flag not set on it)
      const existing = written.entries.find(
        (e: DownloadedVersionEntry) => e.fileId === 'existing'
      );
      expect(existing?.translations.es.updatedAt).toBe('2025-01-01T00:00:00Z');
      // New entry added
      const newEntry = written.entries.find(
        (e: DownloadedVersionEntry) => e.fileId === 'new'
      );
      expect(newEntry?.staged).toBe(true);
    });
  });

  describe('getStagedEntriesFromLockfile', () => {
    it('returns only staged entries', () => {
      writeLockFile({
        version: 2,
        branchId: 'brc_main',
        entries: [
          {
            fileId: 'f1',
            versionId: 'v1',
            fileName: 'src/page.mdx',
            staged: true,
            translations: {},
          },
          {
            fileId: 'f2',
            versionId: 'v2',
            fileName: 'src/downloaded.mdx',
            translations: {
              es: { updatedAt: '2025-01-01T00:00:00Z' },
            },
          },
          {
            fileId: 'f3',
            versionId: 'v3',
            fileName: 'src/also-staged.mdx',
            staged: true,
            translations: {},
          },
        ],
      });

      const result = getStagedEntriesFromLockfile(settings('brc_main'));

      expect(Object.keys(result)).toHaveLength(2);
      expect(result['f1']).toEqual({
        versionId: 'v1',
        fileName: 'src/page.mdx',
      });
      expect(result['f3']).toEqual({
        versionId: 'v3',
        fileName: 'src/also-staged.mdx',
      });
      expect(result['f2']).toBeUndefined();
    });

    it('returns empty object when no entries are staged', () => {
      writeLockFile({
        version: 2,
        branchId: 'brc_main',
        entries: [
          {
            fileId: 'f1',
            versionId: 'v1',
            fileName: 'src/page.mdx',
            translations: {
              es: { updatedAt: '2025-01-01T00:00:00Z' },
            },
          },
        ],
      });

      const result = getStagedEntriesFromLockfile(settings('brc_main'));
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('returns empty object when lockfile does not exist', () => {
      const result = getStagedEntriesFromLockfile(settings('brc_main'));
      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe('V1 lockfile upgrade on staged writes', () => {
    it('upgrades V1 to V2 when staging entries', () => {
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
        },
      });

      writeStagedEntries(settings('brc_main'), [
        { fileId: 'file2', versionId: 'ver2', fileName: 'src/new.mdx' },
      ]);

      const written = readLockFile();
      // Should have been upgraded to V2 since staged entries are present
      expect(written.version).toBe(2);
      expect(written.entries).toHaveLength(2);

      const existing = written.entries.find(
        (e: DownloadedVersionEntry) => e.fileId === 'file1'
      );
      expect(existing?.versionId).toBe('ver1');
      expect(existing?.translations.ja.updatedAt).toBe('2025-01-01T00:00:00Z');

      const staged = written.entries.find(
        (e: DownloadedVersionEntry) => e.fileId === 'file2'
      );
      expect(staged?.staged).toBe(true);
      expect(staged?.fileName).toBe('src/new.mdx');
    });

    it('staged entries survive V2 round-trip after upgrade', () => {
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
        },
      });

      // Stage an entry (upgrades to V2)
      writeStagedEntries(settings('brc_main'), [
        { fileId: 'file2', versionId: 'ver2', fileName: 'src/new.mdx' },
      ]);

      // Read back and verify staged entries are retrievable
      const result = getStagedEntriesFromLockfile(settings('brc_main'));
      expect(result['file2']).toEqual({
        versionId: 'ver2',
        fileName: 'src/new.mdx',
      });
    });

    it('preserves V1 format when writing non-staged entries', () => {
      const v1Content = {
        version: 1,
        entries: {
          brc_main: {
            file1: {
              ver1: {
                ja: { updatedAt: '2025-01-01T00:00:00Z' },
              },
            },
          },
          brc_other: {
            file2: {
              ver2: {
                fr: { updatedAt: '2025-02-01T00:00:00Z' },
              },
            },
          },
        },
      };
      writeLockFile(v1Content);

      // Read, mutate (no staging), write back
      const { data, entryMap, originalV1 } = readLockfile(settings('brc_main'));
      const entry = findOrCreateEntry(entryMap, data.entries, 'file1', 'ver1');
      entry.translations.es = { updatedAt: '2025-06-01T00:00:00Z' };
      writeLockfile(data, originalV1);

      const written = readLockFile();
      // Should stay V1 since no staged entries
      expect(written.version).toBe(1);
      expect(written.entries.brc_other).toBeDefined();
    });
  });
});
