import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import os from 'node:os';
import {
  readLockfile,
  writeLockfile,
  findOrCreateEntry,
  buildEntryMap,
  activateCurrentFileIdentity,
  writeStagedEntries,
  getStagedEntriesFromLockfile,
  migrateLockfileFileIds,
  DownloadedVersionEntry,
} from '../downloadedVersions.js';
import { createMockSettings } from '../../../api/__mocks__/settings.js';
import { hashStringSync } from '../../../utils/hash.js';

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

    it('normalizes Windows paths from a v2 lockfile', () => {
      writeLockFile({
        version: 2,
        branchId: 'brc_abc',
        entries: [
          {
            fileId: 'f1',
            versionId: 'v1',
            fileName: 'src\\content\\page.mdx',
            staged: true,
            translations: {
              es: { fileName: 'content\\es\\page.mdx' },
            },
          },
        ],
      });

      const { data } = readLockfile(settings('brc_abc'));

      expect(data.entries[0].fileName).toBe('src/content/page.mdx');
      expect(data.entries[0].translations.es.fileName).toBe(
        'content/es/page.mdx'
      );
    });

    it('re-keys path-derived file IDs when normalizing Windows paths', () => {
      const windowsFileName = 'src\\content\\page.mdx';
      const posixFileName = 'src/content/page.mdx';
      writeLockFile({
        version: 2,
        branchId: 'brc_abc',
        entries: [
          {
            fileId: hashStringSync(windowsFileName),
            versionId: 'v1',
            fileName: windowsFileName,
            translations: {
              es: {
                fileName: 'content\\es\\page.mdx',
                postProcessHash: 'translation-hash',
              },
            },
          },
        ],
      });

      const { data, entryMap } = readLockfile(settings('brc_abc'));
      const normalizedFileId = hashStringSync(posixFileName);

      expect(data.entries[0]).toMatchObject({
        fileId: normalizedFileId,
        previousFileId: hashStringSync(windowsFileName),
        fileName: posixFileName,
        translations: {
          es: {
            fileName: 'content/es/page.mdx',
            postProcessHash: 'translation-hash',
          },
        },
      });
      expect(entryMap.get(normalizedFileId)).toBe(data.entries[0]);
      expect(entryMap.get(hashStringSync(windowsFileName))).toBe(
        data.entries[0]
      );
    });

    it('does not mutate caller data while normalizing a write', () => {
      const windowsFileName = 'src\\content\\page.mdx';
      const data = {
        version: 2 as const,
        branchId: 'brc_abc',
        entries: [
          {
            fileId: hashStringSync(windowsFileName),
            versionId: 'v1',
            fileName: windowsFileName,
            translations: {},
          },
        ],
      };

      writeLockfile(data, null);

      expect(data.entries[0]).toEqual({
        fileId: hashStringSync(windowsFileName),
        versionId: 'v1',
        fileName: windowsFileName,
        translations: {},
      });
      expect(readLockFile().entries[0]).toMatchObject({
        fileId: hashStringSync('src/content/page.mdx'),
        previousFileId: hashStringSync(windowsFileName),
      });
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

    it('writes lockfile paths with forward slashes', () => {
      writeLockfile(
        {
          version: 2,
          branchId: 'brc_123',
          entries: [
            {
              fileId: 'f1',
              versionId: 'v1',
              fileName: 'src\\content\\page.mdx',
              translations: {
                es: { fileName: 'content\\es\\page.mdx' },
              },
            },
          ],
        },
        null
      );

      const written = readLockFile();
      expect(written.entries[0].fileName).toBe('src/content/page.mdx');
      expect(written.entries[0].translations.es.fileName).toBe(
        'content/es/page.mdx'
      );
    });

    it('keeps migrated entry key order stable across no-op writes', () => {
      const windowsFileName = 'src\\content\\page.mdx';
      writeLockfile(
        {
          version: 2,
          branchId: 'brc_main',
          entries: [
            {
              fileId: hashStringSync(windowsFileName),
              versionId: 'v1',
              fileName: windowsFileName,
              staged: true,
              translations: {
                es: { fileName: 'content\\es\\page.mdx' },
              },
            },
          ],
        },
        null
      );
      const firstWrite = fs.readFileSync(
        path.join(tempDir, 'gt-lock.json'),
        'utf8'
      );

      const { data, originalV1 } = readLockfile(settings('brc_main'));
      writeLockfile(data, originalV1);

      expect(fs.readFileSync(path.join(tempDir, 'gt-lock.json'), 'utf8')).toBe(
        firstWrite
      );
    });

    it('preserves malformed translation maps while writing unrelated entries', () => {
      writeLockFile({
        version: 2,
        branchId: 'brc_main',
        entries: [
          {
            fileId: 'malformed',
            versionId: 'v1',
            translations: null,
          },
        ],
      });

      writeStagedEntries(settings('brc_main'), [
        { fileId: 'valid', versionId: 'v2', fileName: 'src/valid.md' },
      ]);

      expect(readLockFile().entries).toEqual([
        {
          fileId: 'malformed',
          versionId: 'v1',
          translations: null,
        },
        {
          fileId: 'valid',
          versionId: 'v2',
          translations: {},
          fileName: 'src/valid.md',
          staged: true,
        },
      ]);
    });

    it('does not mutate malformed translation arrays while cloning', () => {
      const malformedTranslations = [
        { fileName: 'content\\es\\page.mdx' },
      ] as unknown as DownloadedVersionEntry['translations'];
      const data = {
        version: 2 as const,
        branchId: 'brc_main',
        entries: [
          {
            fileId: 'malformed',
            versionId: 'v1',
            fileName: 'src/page.mdx',
            translations: malformedTranslations,
          },
        ],
      };

      writeLockfile(data, null);

      expect(
        (malformedTranslations as unknown as { fileName: string }[])[0].fileName
      ).toBe('content\\es\\page.mdx');
      expect(readLockFile().entries[0].translations[0].fileName).toBe(
        'content/es/page.mdx'
      );
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

    it('indexes a migrated entry by both current and previous file IDs', () => {
      const entry: DownloadedVersionEntry = {
        fileId: 'current',
        previousFileId: 'previous',
        versionId: 'v1',
        translations: {},
      };
      const map = buildEntryMap([entry]);

      expect(map.get('current')).toBe(entry);
      expect(map.get('previous')).toBe(entry);
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

    it('activates the current identity and removes the legacy map alias', () => {
      const entry: DownloadedVersionEntry = {
        fileId: 'current',
        previousFileId: 'legacy',
        versionId: 'v1',
        translations: {
          es: { postProcessHash: 'legacy-hash' },
        },
      };
      const map = buildEntryMap([entry]);

      activateCurrentFileIdentity(entry, 'current', map);

      expect(entry.previousFileId).toBeUndefined();
      expect(entry.translations).toEqual({});
      expect(map.get('current')).toBe(entry);
      expect(map.has('legacy')).toBe(false);
    });

    it('does not remove a distinct entry that owns the legacy map key', () => {
      const current: DownloadedVersionEntry = {
        fileId: 'current',
        previousFileId: 'legacy',
        versionId: 'v2',
        translations: { es: { postProcessHash: 'old-hash' } },
      };
      const legacy: DownloadedVersionEntry = {
        fileId: 'legacy',
        versionId: 'v1',
        translations: {},
      };
      const map = buildEntryMap([current, legacy]);

      activateCurrentFileIdentity(current, 'current', map);

      expect(map.get('legacy')).toBe(legacy);
      expect(current.previousFileId).toBeUndefined();
      expect(current.translations).toEqual({});
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

    it('drops legacy metadata after staging succeeds for the current identity', () => {
      writeLockFile({
        version: 2,
        branchId: 'brc_main',
        entries: [
          {
            fileId: 'portable-id',
            previousFileId: 'windows-id',
            versionId: 'v1',
            fileName: 'src/page.mdx',
            translations: {
              es: {
                updatedAt: '2025-01-01T00:00:00Z',
                postProcessHash: 'legacy-hash',
              },
            },
          },
        ],
      });

      writeStagedEntries(settings('brc_main'), [
        {
          fileId: 'portable-id',
          versionId: 'v1',
          fileName: 'src/page.mdx',
        },
      ]);

      expect(readLockFile().entries).toEqual([
        {
          fileId: 'portable-id',
          versionId: 'v1',
          translations: {},
          fileName: 'src/page.mdx',
          staged: true,
        },
      ]);
      expect(getStagedEntriesFromLockfile(settings('brc_main'))).toEqual({
        'portable-id': {
          versionId: 'v1',
          fileName: 'src/page.mdx',
        },
      });
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

    it('uses the previous server ID for a migrated staged entry', () => {
      writeLockFile({
        version: 2,
        branchId: 'brc_main',
        entries: [
          {
            fileId: 'portable-id',
            previousFileId: 'windows-id',
            versionId: 'v1',
            fileName: 'src/page.mdx',
            staged: true,
            translations: {},
          },
        ],
      });

      expect(getStagedEntriesFromLockfile(settings('brc_main'))).toEqual({
        'windows-id': {
          versionId: 'v1',
          fileName: 'src/page.mdx',
        },
      });
    });

    it('returns empty object when lockfile does not exist', () => {
      const result = getStagedEntriesFromLockfile(settings('brc_main'));
      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe('migrateLockfileFileIds', () => {
    it('clears a V2 legacy alias after the server accepts the move', () => {
      writeLockFile({
        version: 2,
        branchId: 'brc_main',
        entries: [
          {
            fileId: 'portable-id',
            previousFileId: 'windows-id',
            versionId: 'v1',
            fileName: 'src/page.mdx',
            translations: {
              ja: { updatedAt: '2025-01-01T00:00:00Z' },
            },
          },
        ],
      });

      expect(
        migrateLockfileFileIds('brc_main', [
          {
            oldFileId: 'windows-id',
            newFileId: 'portable-id',
            newFileName: 'src/page.mdx',
          },
        ])
      ).toBe(1);

      expect(readLockFile().entries).toEqual([
        {
          fileId: 'portable-id',
          versionId: 'v1',
          translations: {
            ja: { updatedAt: '2025-01-01T00:00:00Z' },
          },
          fileName: 'src/page.mdx',
        },
      ]);
    });

    it('removes a stale legacy entry when the accepted target has a newer version', () => {
      writeLockFile({
        version: 2,
        branchId: 'brc_main',
        entries: [
          {
            fileId: 'windows-id',
            versionId: 'old-version',
            fileName: 'src\\page.mdx',
            translations: {
              ja: { updatedAt: '2025-01-01T00:00:00Z' },
            },
          },
          {
            fileId: 'portable-id',
            versionId: 'new-version',
            fileName: 'src/page.mdx',
            translations: {
              fr: { updatedAt: '2026-01-01T00:00:00Z' },
            },
          },
        ],
      });

      expect(
        migrateLockfileFileIds('brc_main', [
          {
            oldFileId: 'windows-id',
            newFileId: 'portable-id',
            newFileName: 'src/page.mdx',
          },
        ])
      ).toBe(1);

      expect(readLockFile().entries).toEqual([
        {
          fileId: 'portable-id',
          versionId: 'new-version',
          translations: {
            fr: { updatedAt: '2026-01-01T00:00:00Z' },
          },
          fileName: 'src/page.mdx',
        },
      ]);
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

    it('migrates a V1 lock key after the server accepts a path move', () => {
      writeLockFile({
        version: 1,
        entries: {
          brc_main: {
            'windows-id': {
              ver1: {
                ja: { updatedAt: '2025-01-01T00:00:00Z' },
              },
            },
          },
        },
      });

      expect(
        migrateLockfileFileIds('brc_main', [
          {
            oldFileId: 'windows-id',
            newFileId: 'portable-id',
            newFileName: 'src/page.mdx',
          },
        ])
      ).toBe(1);

      const written = readLockFile();
      expect(written.version).toBe(1);
      expect(written.entries.brc_main['windows-id']).toBeUndefined();
      expect(written.entries.brc_main['portable-id'].ver1.ja.updatedAt).toBe(
        '2025-01-01T00:00:00Z'
      );
    });

    it('migrates V1 keys without dropping versions, locales, or legacy fields', () => {
      writeLockFile({
        version: 1,
        entries: {
          brc_main: {
            'windows-id': {
              version1: {
                ja: {
                  updatedAt: '2026-01-02T00:00:00Z',
                  fileName: 'ja\\page.md',
                  sourceHash: 'source-ja',
                },
                es: {
                  updatedAt: '2025-01-01T00:00:00Z',
                  postProcessHash: 'post-es',
                },
              },
              version2: {
                fr: {
                  updatedAt: '2026-02-01T00:00:00Z',
                  sourceHash: 'source-fr',
                },
              },
            },
            'portable-id': {
              version1: {
                ja: {
                  updatedAt: '2026-01-01T00:00:00Z',
                  postProcessHash: 'target-post-ja',
                },
              },
              version3: {
                de: { updatedAt: '2026-03-01T00:00:00Z' },
              },
            },
          },
          brc_other: {
            untouched: {
              otherVersion: {
                ko: { updatedAt: '2026-04-01T00:00:00Z' },
              },
            },
          },
        },
      });

      expect(
        migrateLockfileFileIds('brc_main', [
          {
            oldFileId: 'windows-id',
            newFileId: 'portable-id',
            newFileName: 'src/page.md',
          },
        ])
      ).toBe(1);

      const written = readLockFile();
      expect(written.version).toBe(1);
      expect(written.entries.brc_main['windows-id']).toBeUndefined();
      expect(written.entries.brc_main['portable-id']).toEqual({
        version1: {
          ja: {
            updatedAt: '2026-01-02T00:00:00Z',
            postProcessHash: 'target-post-ja',
            fileName: 'ja\\page.md',
            sourceHash: 'source-ja',
          },
          es: {
            updatedAt: '2025-01-01T00:00:00Z',
            postProcessHash: 'post-es',
          },
        },
        version2: {
          fr: {
            updatedAt: '2026-02-01T00:00:00Z',
            sourceHash: 'source-fr',
          },
        },
        version3: {
          de: { updatedAt: '2026-03-01T00:00:00Z' },
        },
      });
      expect(written.entries.brc_other.untouched).toEqual({
        otherVersion: {
          ko: { updatedAt: '2026-04-01T00:00:00Z' },
        },
      });
    });
  });
});
